const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const { Server } = require("socket.io");
const crypto = require('crypto'); // <-- ADD THIS LINE
const sharp = require('sharp');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 5015;
const DB_PATH = './db/tabulation.db';
const JWT_SECRET = 'your_super_secret_key_change_this';

// --- INITIALIZATION & MIDDLEWARE ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const activeUsers = {}; // Stores { socketId: { username, role } }
const userSocketMap = {}; // <-- ADD THIS LINE: Maps { userId: socketId }
const serverStartTime = Date.now();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));

// --- FILE UPLOAD SETUP ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- DATABASE CONNECTION ---
const db = new sqlite3.Database(DB_PATH, (err) => { if (err) console.error("DB Connection Error:", err.message); else console.log("Successfully connected to the database."); });
db.run("PRAGMA foreign_keys = ON;");
db.run("PRAGMA journal_mode = WAL;");

const processImage = async (req, res, next) => {
    if (!req.file) {
        return next();
    }

    try {
        const newFilename = `${Date.now()}.webp`;
        const newPath = path.join(__dirname, '../uploads', newFilename);

        await sharp(req.file.buffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .toFormat('webp', { quality: 80 })
            .toFile(newPath);

        req.file.processedFilename = newFilename;
        next();
    } catch (error) {
        console.error('Image processing error:', error);
        res.status(500).json({ message: 'Error processing image.' });
    }
};

// --- AUTH & RBAC MIDDLEWARE ---
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.sendStatus(401); // No token
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // Token is invalid (bad signature, expired, etc.)
        }

        // Token signature is valid, now check if the session is the active one.
        const sql = "SELECT active_session_id FROM users WHERE id = ?";
        db.get(sql, [user.id], (dbErr, row) => {
            if (dbErr || !row) {
                return res.sendStatus(401); // User not found or DB error
            }

            // Compare session ID from token with the one in the database
            if (row.active_session_id !== user.sessionId) {
                // This token is from an old, invalidated session.
                return res.status(401).json({ message: "This session has been invalidated by a new login." });
            }

            // Both token and session are valid
            req.user = user;
            next();
        });
    });
};
const authorizeRoles = (...allowedRoles) => { return (req, res, next) => { if (!req.user || !allowedRoles.includes(req.user.role)) { return res.status(403).json({ message: 'Access denied.' }); } next(); }; };

// --- TABULATION FUNCTION ---
const calculateAndEmitResults = () => {
    const sql = `
        WITH JudgeRawSegmentScores AS (
            -- Step 1: For each judge, SUM the criteria scores for each candidate in a segment.
            SELECT 
                sc.judge_id,
                sc.candidate_id,
                s.id as segment_id,
                SUM(sc.score) as total_segment_score
            FROM scores sc
            JOIN criteria cr ON sc.criterion_id = cr.id
            JOIN segments s ON cr.segment_id = s.id
            WHERE s.type = 'judge'
            GROUP BY sc.judge_id, sc.candidate_id, s.id
        ),
        JudgeAverageSegmentScores AS (
            -- Step 2: Average the segment totals from all judges for each candidate.
            SELECT
                candidate_id,
                segment_id,
                AVG(total_segment_score) as final_segment_score
            FROM JudgeRawSegmentScores
            GROUP BY candidate_id, segment_id
        ),
        AdminSegmentScores AS (
            -- Step 3: Get the scores directly entered by admins.
            SELECT
                candidate_id,
                segment_id,
                score as final_segment_score
            FROM admin_scores
        ),
        CombinedScores AS (
            -- Step 4: Combine the judge averages and the admin scores into one table.
            SELECT candidate_id, segment_id, final_segment_score FROM JudgeAverageSegmentScores
            UNION ALL
            SELECT candidate_id, segment_id, final_segment_score FROM AdminSegmentScores
        ),
        FinalScores AS (
            -- Step 5: Apply the overall segment percentage to get the final score for each candidate.
            SELECT 
                c.id as candidate_id,
                SUM(cs.final_segment_score * (s.percentage / 100.0)) as total_score
            FROM candidates c
            LEFT JOIN CombinedScores cs ON c.id = cs.candidate_id
            LEFT JOIN segments s ON cs.segment_id = s.id
            GROUP BY c.id
        )
        -- Final Selection
        SELECT 
            cand.id, 
            cand.name as candidate_name, 
            cand.candidate_number, 
            cand.image_url, 
            cont.id as contest_id, 
            cont.name as contest_name, 
            fs.total_score 
        FROM candidates cand 
        JOIN contests cont ON cand.contest_id = cont.id 
        LEFT JOIN FinalScores fs ON cand.id = fs.candidate_id 
        ORDER BY cont.id, fs.total_score DESC;
    `;
    
    db.all(sql, [], (err, results) => {
        if (err) {
            console.error("Error calculating results:", err.message);
            return;
        }
        const groupedResults = results.reduce((acc, row) => {
            const { contest_name } = row;
            if (!acc[contest_name]) { acc[contest_name] = []; }
            acc[contest_name].push(row);
            return acc;
        }, {});
        io.emit('update_results', groupedResults); 
    });
};

// --- SOCKET.IO CONNECTION ---
// This function will gather all KPIs and broadcast them.
const emitKpiUpdate = () => {
    // Use callbacks as the sqlite3 library expects, avoiding the problematic try/catch
    db.get("SELECT COUNT(*) as count FROM scores", (err1, scoreCountResult) => {
        if (err1) {
            console.error("KPI Error getting score count:", err1.message);
            return;
        }

        db.get(`
            SELECT u.username as judge_name, c.name as candidate_name, s.score
            FROM scores s
            JOIN users u ON s.judge_id = u.id
            JOIN candidates c ON s.candidate_id = c.id
            ORDER BY s.id DESC LIMIT 1
        `, (err2, lastScoreResult) => {
            if (err2) {
                console.error("KPI Error getting last score:", err2.message);
                return;
            }

            const kpis = {
                activeUsers: Object.values(activeUsers),
                serverUptime: Math.floor((Date.now() - serverStartTime) / 1000),
                connectionCount: Object.keys(activeUsers).length,
                totalScoresSubmitted: scoreCountResult ? scoreCountResult.count : 0,
                lastScore: lastScoreResult || null // This will be null if no scores exist
            };

            // Emit only to admins/superadmins
            Object.keys(activeUsers).forEach(socketId => {
                const user = activeUsers[socketId];
                if (['admin', 'superadmin'].includes(user.role)) {
                    io.to(socketId).emit('kpi_update', kpis);
                }
            });
        });
    });
};
// --- SOCKET.IO CONNECTION ---
io.on('connection', (socket) => {
    console.log(`A user connected with socket ID: ${socket.id}`);
    calculateAndEmitResults();

    socket.on('client_auth', (token) => {
        if (token) {
            jwt.verify(token, JWT_SECRET, (err, user) => {
                if (!err) {
                    activeUsers[socket.id] = { username: user.username, role: user.role };
                    userSocketMap[user.id] = socket.id; // <-- Store the user-to-socket mapping
                    console.log(`Socket ${socket.id} authenticated as ${user.username} (ID: ${user.id})`);
                    emitKpiUpdate();
                }
            });
        }
    });

    socket.on('disconnect', () => {
        const disconnectedUser = activeUsers[socket.id];
        if (disconnectedUser) {
            console.log(`User ${disconnectedUser.username} disconnected.`);
            // Find the user ID to remove from the map
            const userId = Object.keys(userSocketMap).find(key => userSocketMap[key] === socket.id);
            if (userId) {
                delete userSocketMap[userId];
            }
        }
        delete activeUsers[socket.id];
        emitKpiUpdate();
    });
});

// === API ROUTES ===
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user) return res.status(401).json({ message: 'Invalid credentials.' });

        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
            if (err || !isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

            // --- SINGLE SESSION LOGIC ---
            // 1. Generate a new, unique session ID for this login.
            const newSessionId = crypto.randomBytes(16).toString('hex');

            // 2. Check if there's an old socket connection for this user and kick it out.
            const oldSocketId = userSocketMap[user.id];
            if (oldSocketId) {
                console.log(`Forcing logout for user ${user.username} on old socket ${oldSocketId}`);
                io.to(oldSocketId).emit('force_logout');
            }
            
            // 3. Update the database with the new active session ID.
            db.run("UPDATE users SET active_session_id = ? WHERE id = ?", [newSessionId, user.id], (updateErr) => {
                if (updateErr) {
                    return res.status(500).json({ message: "Failed to update session." });
                }

                // 4. Create the JWT with the new session ID included in the payload.
                const payload = {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    sessionId: newSessionId // <-- Crucial addition
                };
                const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
                res.json({ token, user: payload });
            });
        });
    });
});
app.get('/api/users', authenticateToken, authorizeRoles('superadmin'), (req, res) => { db.all("SELECT id, username, role FROM users", [], (err, rows) => res.json(rows)); });
app.post('/api/users', authenticateToken, authorizeRoles('superadmin'), (req, res) => { const { username, password, role } = req.body; bcrypt.hash(password, 10, (err, hash) => { db.run(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`, [username, hash, role], function (err) { if (err) return res.status(409).json({ message: 'Username exists.' }); res.status(201).json({ id: this.lastID, username, role }); }); }); });

app.delete('/api/users/:id', authenticateToken, authorizeRoles('superadmin'), (req, res) => {
    const targetUserId = req.params.id;
    if (req.user.id == targetUserId) {
        return res.status(403).json({ message: "Cannot delete yourself." });
    }

    // Check the role of the user being deleted
    db.get('SELECT role FROM users WHERE id = ?', [targetUserId], (err, userToDelete) => {
        if (err) return res.status(500).json({ message: "DB error." });
        if (!userToDelete) return res.status(404).json({ message: "User not found." });
        if (userToDelete.role === 'superadmin') {
            return res.status(403).json({ message: "Cannot delete another superadmin." });
        }

        // Proceed with deletion if not a superadmin
        db.run('DELETE FROM users WHERE id = ?', [targetUserId], (err) => {
            if (err) return res.status(500).json({ message: "Failed to delete user." });
            res.sendStatus(204);
        });
    });
});

// GET A SINGLE USER's DETAILS
app.get('/api/users/:id', authenticateToken, authorizeRoles('superadmin'), (req, res) => {
    const sql = "SELECT id, username, role FROM users WHERE id = ?";
    db.get(sql, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ message: "DB Error." });
        if (!row) return res.status(404).json({ message: "User not found." });
        res.json(row);
    });
});

// UPDATE A USER's DETAILS
app.put('/api/users/:id', authenticateToken, authorizeRoles('superadmin'), (req, res) => {
    const { username, role, password } = req.body;
    const userId = req.params.id;

    if (!username || !role) {
        return res.status(400).json({ message: "Username and role are required." });
    }

    // If a new password is provided, hash it. Otherwise, we don't update the password.
    if (password) {
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.status(500).json({ message: "Error hashing password." });
            
            const sql = `UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?`;
            db.run(sql, [username, role, hash, userId], function(err) {
                if (err) {
                    // This error typically means the username is already taken
                    if (err.message.includes('UNIQUE constraint failed')) {
                         return res.status(409).json({ message: 'Username already exists.' });
                    }
                    return res.status(500).json({ message: "DB Error updating user." });
                }
                res.json({ message: 'User updated successfully.' });
            });
        });
    } else {
        // No new password, so we only update username and role
        const sql = `UPDATE users SET username = ?, role = ? WHERE id = ?`;
        db.run(sql, [username, role, userId], function(err) {
             if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                     return res.status(409).json({ message: 'Username already exists.' });
                }
                return res.status(500).json({ message: "DB Error updating user." });
            }
            res.json({ message: 'User updated successfully.' });
        });
    }
});
app.get('/api/contests', authenticateToken, (req, res) => { db.all("SELECT * FROM contests", [], (err, rows) => res.json(rows)); });
app.post('/api/contests', authenticateToken, authorizeRoles('admin', 'superadmin'), upload.single('image'), processImage, (req, res) => { const { name } = req.body; const imageUrl = req.file ? `/uploads/${req.file.processedFilename}` : null; db.run('INSERT INTO contests (name, image_url) VALUES (?, ?)', [name, imageUrl], function(err) { res.status(201).json({ id: this.lastID, name, imageUrl }); }); });
app.delete('/api/contests/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.run('DELETE FROM contests WHERE id = ?', [req.params.id], (err) => res.sendStatus(204)); });
app.get('/api/contests/:contestId/candidates', authenticateToken, (req, res) => { db.all("SELECT * FROM candidates WHERE contest_id = ? ORDER BY COALESCE(display_order, candidate_number) ASC, candidate_number ASC", [req.params.contestId], (err, rows) => res.json(rows)); });
app.post('/api/candidates', authenticateToken, authorizeRoles('admin', 'superadmin'), upload.single('image'), processImage, (req, res) => {
    const { name, candidate_number, contest_id, branch, course, section, year_level } = req.body;
    if (!name || !candidate_number || !contest_id) return res.status(400).json({ message: "Missing required fields."});
    const imageUrl = req.file ? `/uploads/${req.file.processedFilename}` : null;
    const sql = `INSERT INTO candidates (name, candidate_number, contest_id, image_url, branch, course, section, year_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [name, candidate_number, contest_id, imageUrl, branch, course, section, year_level], function(err) {
        if(err) return res.status(500).json({message: "DB error creating candidate."});
        res.status(201).json({ id: this.lastID });
    });
});
app.delete('/api/candidates/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.run('DELETE FROM candidates WHERE id = ?', [req.params.id], () => res.sendStatus(204)); });
app.put('/api/candidates/batch-update', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    const { candidates } = req.body;
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({ message: 'Invalid payload.' });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare("UPDATE candidates SET display_order = ?, status = ? WHERE id = ?");
        candidates.forEach(c => {
            const orderValue = c.display_order && c.display_order.trim() !== '' ? parseInt(c.display_order, 10) : null;
            stmt.run(orderValue, c.status, c.id);
        });
        stmt.finalize(err => {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ message: "Failed to update candidates." });
            }
            db.run("COMMIT", () => {
                
                const firstCandidateId = candidates[0].id;
                db.get("SELECT contest_id FROM candidates WHERE id = ?", [firstCandidateId], (err, row) => {
                    if (row) {
                        io.emit('candidate_status_changed', { contest_id: row.contest_id });
                    }
                });
                io.emit('candidate_status_changed');
                res.json({ message: "Candidates updated successfully." });
            });
        });
    });
});
app.put('/api/contests/:contestId/candidates/status', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    const { status } = req.body;
    const contestId = req.params.contestId;
    if (!['open', 'closed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
    }
    const sql = `UPDATE candidates SET status = ? WHERE contest_id = ?`;
    db.run(sql, [status, contestId], function (err) {
        if (err) return res.status(500).json({ message: "DB Error updating statuses." });
        
        io.emit('candidate_status_changed', { contest_id: contestId });
        res.json({ message: `All candidates set to ${status}.` });
    });
});
app.post('/api/segments', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { const { name, percentage, type } = req.body; db.run('INSERT INTO segments (name, percentage, type) VALUES (?, ?, ?)', [name, percentage, type || 'judge'], function(err) { if(err) return res.status(500).json({message: "DB error"}); res.status(201).json({ id: this.lastID }); }); });
app.delete('/api/segments/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.run('DELETE FROM segments WHERE id = ?', [req.params.id], () => res.sendStatus(204)); });
app.put('/api/segments/:id/status', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    const { status } = req.body;
    if (!status || !['open', 'closed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status provided. Must be 'open' or 'closed'." });
    }

    db.run('UPDATE segments SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) {
            console.error("Error updating segment status:", err.message);
            return res.status(500).json({ message: 'DB Error updating segment status.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Segment not found.' });
        }
        
        // --- FIX: Notify all clients that a segment status has changed ---
        io.emit('segment_status_changed'); 
        
        res.json({ message: `Segment status updated to ${status}.` });
    });
});
app.get('/api/segments/:segmentId/criteria', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.all("SELECT * FROM criteria WHERE segment_id = ?", [req.params.segmentId], (err, rows) => res.json(rows)); });
app.post('/api/criteria', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { const { name, max_score, segment_id } = req.body; db.run('INSERT INTO criteria (name, max_score, segment_id) VALUES (?, ?, ?)', [name, max_score, segment_id], function(err) { res.status(201).json({ id: this.lastID }); }); });
app.delete('/api/criteria/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.run('DELETE FROM criteria WHERE id = ?', [req.params.id], () => res.sendStatus(204)); });
// ADD New route for global segments
app.get('/api/segments', authenticateToken, (req, res) => {
    db.all("SELECT * FROM segments ORDER BY id", [], (err, rows) => res.json(rows));
});

// ADD New main endpoint for judge dashboard
app.get('/api/judging/segments', authenticateToken, authorizeRoles('judge'), (req, res) => {
    const judgeId = req.user.id;
    const sql = `
        WITH
        OpenCandidates AS (
            SELECT id FROM candidates WHERE status = 'open'
        ),
        ScoredCandidatesPerSegment AS (
            SELECT
                cr.segment_id,
                COUNT(DISTINCT sc.candidate_id) as scored_count
            FROM scores sc
            JOIN criteria cr ON sc.criterion_id = cr.id
            WHERE sc.judge_id = ? AND sc.candidate_id IN (SELECT id FROM OpenCandidates)
            GROUP BY cr.segment_id
        ),
        OpenCandidateCount AS (
            SELECT COUNT(*) as total_open FROM OpenCandidates
        )
        SELECT
            s.*,
            CASE
                WHEN IFNULL(scps.scored_count, 0) = occ.total_open AND occ.total_open > 0 THEN 1
                ELSE 0
            END as is_judged
        FROM segments s
        CROSS JOIN OpenCandidateCount occ
        LEFT JOIN ScoredCandidatesPerSegment scps ON s.id = scps.segment_id
        WHERE s.type = 'judge' AND s.status = 'open'
    `;
    db.all(sql, [judgeId], (err, rows) => {
        if (err) return res.status(500).json({ message: "DB error" });
        res.json(rows);
    });
});

// ADD New endpoint for judging sheet to get ALL open candidates
app.get('/api/judging/candidates', authenticateToken, authorizeRoles('judge'), (req, res) => {
    const sql = `SELECT * FROM candidates WHERE status = 'open' ORDER BY COALESCE(display_order, candidate_number) ASC, candidate_number ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: "DB Error fetching candidates." });
        res.json(rows);
    });
});


app.put('/api/contests/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), upload.single('image'), processImage, (req, res) => {
    const { name } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.processedFilename}` : req.body.existing_image_url;
    db.run('UPDATE contests SET name = ?, image_url = ? WHERE id = ?', [name, imageUrl, req.params.id], function(err) {
        if (err) return res.status(500).json({ message: 'DB Error updating contest.' });
        res.json({ message: 'Contest updated successfully.' });
    });
});

app.put('/api/candidates/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), upload.single('image'), processImage, (req, res) => {
    const { name, candidate_number, branch, course, section, year_level } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.processedFilename}` : req.body.existing_image_url;
    const candidateId = req.params.id;

    const sql = `UPDATE candidates SET name = ?, candidate_number = ?, image_url = ?, branch = ?, course = ?, section = ?, year_level = ? WHERE id = ?`;
    
    db.run(sql, [name, candidate_number, imageUrl, branch, course, section, year_level, candidateId], function(err) {
        if (err) return res.status(500).json({ message: 'DB Error updating candidate.' });
        
        db.get('SELECT * FROM candidates WHERE id = ?', [candidateId], (err, updatedCandidate) => {
            if (updatedCandidate) {
                io.emit('candidate_data_updated', updatedCandidate);
            }
            res.json({ message: 'Candidate updated successfully.' });
        });
    });
});

app.put('/api/segments/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    const { name, percentage } = req.body;
    db.run('UPDATE segments SET name = ?, percentage = ? WHERE id = ?', [name, percentage, req.params.id], function(err) {
        if (err) return res.status(500).json({ message: 'DB Error updating segment.' });
        res.json({ message: 'Segment updated successfully.' });
    });
});

app.put('/api/criteria/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    const { name, max_score } = req.body;
    db.run('UPDATE criteria SET name = ?, max_score = ? WHERE id = ?', [name, max_score, req.params.id], function(err) {
        if (err) return res.status(500).json({ message: 'DB Error updating criterion.' });
        res.json({ message: 'Criterion updated successfully.' });
    });
});

// --- GET SINGLE ITEM ROUTES (for populating edit forms) ---
const createGetByIdRoute = (tableName) => {
    app.get(`/api/${tableName}/:id`, authenticateToken, (req, res) => {
        db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ message: `DB Error fetching ${tableName}.` });
            if (!row) return res.status(404).json({ message: 'Item not found.'});
            res.json(row);
        });
    });
};
createGetByIdRoute('contests');
createGetByIdRoute('candidates');
createGetByIdRoute('segments');
createGetByIdRoute('criteria');

// --- JUDGING FLOW (WITH NEW ROUTE) ---
app.get('/api/judging/segments/:segmentId/my-scores', authenticateToken, authorizeRoles('judge'), (req, res) => {
    const sql = `
        SELECT
            s.score,
            c.id as candidate_id,
            c.name as candidate_name,
            c.candidate_number,
            c.image_url,
            cr.name as criterion_name,
            cr.max_score
        FROM scores s
        JOIN candidates c ON s.candidate_id = c.id
        JOIN criteria cr ON s.criterion_id = cr.id
        WHERE cr.segment_id = ? AND s.judge_id = ? AND c.status = 'open'
        ORDER BY c.candidate_number, cr.id
    `;
    db.all(sql, [req.params.segmentId, req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: "DB error getting scores" });
        res.json(rows);
    });
});
app.get('/api/judging/segments/:segmentId/criteria', authenticateToken, authorizeRoles('judge'), (req, res) => {
    // A judge can only get criteria for a segment they haven't scored yet.
    // This is an implicit security check.
    db.all("SELECT * FROM criteria WHERE segment_id = ?", [req.params.segmentId], (err, rows) => {
        if (err) return res.status(500).json({ message: "DB error" });
        res.json(rows);
    });
});
app.get('/api/admin/judging-status-by-segment', authenticateToken, authorizeRoles('admin', 'superadmin'), async (req, res) => {
    const { segment_id } = req.query;
    if (!segment_id) return res.status(400).json({ message: "Segment ID is required." });

    const dbAll = (sql, params) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

    try {
        const judges = await dbAll("SELECT id, username FROM users WHERE role = 'judge'", []);
        const candidates = await dbAll("SELECT id, name, candidate_number FROM candidates WHERE status = 'open' ORDER BY display_order, candidate_number", []);
        
        const lockedScores = await dbAll(`
            SELECT DISTINCT judge_id, candidate_id
            FROM scores s JOIN criteria c ON s.criterion_id = c.id
            WHERE c.segment_id = ?`, [segment_id]
        );

        const lockedMap = lockedScores.reduce((acc, item) => {
            acc[`${item.judge_id}:${item.candidate_id}`] = true;
            return acc;
        }, {});

        res.json({ judges, candidates, lockedMap });
    } catch (error) {
        res.status(500).json({ message: 'DB Error' });
    }
});

// ADD: New route for a judge to get which candidates they've already locked in a segment
app.get('/api/judging/segments/:segmentId/locked-candidates', authenticateToken, authorizeRoles('judge'), (req, res) => {
    const sql = `
        SELECT DISTINCT s.candidate_id 
        FROM scores s JOIN criteria c ON s.criterion_id = c.id
        WHERE c.segment_id = ? AND s.judge_id = ?`;
    db.all(sql, [req.params.segmentId, req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: "DB error" });
        res.json(rows);
    });
});

// ADD: New route for submitting scores for a single candidate
app.post('/api/judging/scores-for-candidate', authenticateToken, authorizeRoles('judge'), (req, res) => {
    const { segment_id, candidate_id, scores } = req.body;
    const judge_id = req.user.id;

    db.get("SELECT contest_id FROM candidates WHERE id = ?", [candidate_id], (err, candidate) => {
        if (err || !candidate) return res.status(404).json({ message: "Candidate not found." });

        const contest_id = candidate.contest_id;
        const insertSql = `INSERT INTO scores (judge_id, candidate_id, criterion_id, score, contest_id) VALUES (?, ?, ?, ?, ?)`;
        
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            const stmt = db.prepare(insertSql);
            scores.forEach(s => stmt.run(judge_id, candidate_id, s.criterion_id, s.score, contest_id));
            stmt.finalize(err => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Failed to save scores." });
                }
               db.run("COMMIT", () => {
                    res.status(201).json({ message: "Scores locked." });
                    calculateAndEmitResults();
                    emitKpiUpdate();
                    io.emit('judging_progress_updated');
                });
            });
        });
    });
});

// ADD: New, more granular route for unlocking scores
app.delete('/api/admin/unlock-scores-for-candidate', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    const { judge_id, candidate_id, segment_id } = req.body;
    const sql = `DELETE FROM scores WHERE judge_id = ? AND candidate_id = ? AND criterion_id IN (SELECT id FROM criteria WHERE segment_id = ?)`;

    db.run(sql, [judge_id, candidate_id, segment_id], function(err) {
        if (err) {
            console.error("DB Error on unlock:", err.message);
            return res.status(500).json({ message: "DB Error" });
        }
        
        // Use a callback to ensure the emit happens after the DB operation
        calculateAndEmitResults();
        emitKpiUpdate();
        io.emit('judging_progress_updated');
        res.json({ message: 'Scores unlocked.' });
    });
});
app.get('/api/scores', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    const { contest_id, segment_id, criterion_id } = req.query;

    let sql = `
        SELECT 
            sc.id, sc.score,
            c.name as candidate_name,
            j.username as judge_name,
            cr.name as criterion_name,
            s.name as segment_name,
            co.name as contest_name
        FROM scores sc
        JOIN users j ON sc.judge_id = j.id
        JOIN candidates c ON sc.candidate_id = c.id
        JOIN criteria cr ON sc.criterion_id = cr.id
        JOIN segments s ON cr.segment_id = s.id
        JOIN contests co ON c.contest_id = co.id
        WHERE 1=1
    `;
    const params = [];

    if (contest_id) {
        sql += ` AND co.id = ?`;
        params.push(contest_id);
    }
    if (segment_id) {
        sql += ` AND s.id = ?`;
        params.push(segment_id);
    }
    if (criterion_id) {
        sql += ` AND cr.id = ?`;
        params.push(criterion_id);
    }

    sql += ` ORDER BY co.name, s.name, c.name, cr.name`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Error fetching scores:", err.message);
            return res.status(500).json({ message: "Database error while fetching scores." });
        }
        res.json(rows);
    });
});

app.get('/api/admin/kpis', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    // This is a simplified version of the logic in emitKpiUpdate for a single request
    db.get("SELECT COUNT(*) as count FROM scores", (err, scoreCountResult) => {
        db.get(`
            SELECT u.username as judge_name, c.name as candidate_name, s.score
            FROM scores s
            JOIN users u ON s.judge_id = u.id
            JOIN candidates c ON s.candidate_id = c.id
            ORDER BY s.id DESC LIMIT 1
        `, (err, lastScoreResult) => {
            const kpis = {
                activeUsers: Object.values(activeUsers),
                serverUptime: Math.floor((Date.now() - serverStartTime) / 1000),
                connectionCount: Object.keys(activeUsers).length,
                totalScoresSubmitted: scoreCountResult ? scoreCountResult.count : 0,
                lastScore: lastScoreResult || null
            };
            res.json(kpis);
        });
    });
});

// --- AWARDS & PUBLIC RESULTS ---
app.get('/api/awards', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.all("SELECT * FROM awards", [], (err, rows) => res.json(rows)); });
app.post('/api/awards', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { const { name, type } = req.body; db.run('INSERT INTO awards (name, type) VALUES (?, ?)', [name, type], function (err) { if (err) return res.status(409).json({ message: "Award exists." }); res.status(201).json({ id: this.lastID, name, type }); }); });
app.delete('/api/awards/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    db.run('DELETE FROM awards WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ message: "DB Error deleting award." });
        res.sendStatus(204);
    });
});
app.post('/api/award-winners', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { const { award_id, candidate_id } = req.body; db.run('INSERT OR REPLACE INTO award_winners (award_id, candidate_id) VALUES (?, ?)', [award_id, candidate_id], (err) => { if (err) return res.status(500).json({ message: "DB Error." }); res.status(201).json({ message: "Winner assigned successfully" }); }); });
app.get('/api/public-winners', (req, res) => { const sql = `SELECT a.name as award_name, a.type, c.name as candidate_name, c.image_url FROM award_winners aw JOIN awards a ON aw.award_id = a.id JOIN candidates c ON aw.candidate_id = c.id ORDER BY a.type, a.name`; db.all(sql, [], (err, rows) => { if (err) return res.status(500).send("Error"); res.json(rows); }); });

// --- FULL TABULATION REPORT ENDPOINT ---
app.get('/api/reports/full-tabulation', authenticateToken, authorizeRoles('admin', 'superadmin'), async (req, res) => {
    const { contest_id } = req.query;
    if (!contest_id) {
        return res.status(400).json({ message: "Contest ID is required." });
    }

    try {
        const dbAll = (sql, params) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        });

        const contestSql = `SELECT name FROM contests WHERE id = ?`;
        const segmentsSql = `SELECT id, name, percentage, type FROM segments ORDER BY id`;
        const criteriaSql = `SELECT id, name, max_score, segment_id FROM criteria ORDER BY segment_id, id`;
        const candidatesSql = `SELECT id, name, candidate_number FROM candidates WHERE contest_id = ? ORDER BY candidate_number`;
        const judgesSql = `SELECT id, username FROM users WHERE role = 'judge' ORDER BY id`;
        const scoresSql = `SELECT judge_id, candidate_id, criterion_id, score FROM scores WHERE contest_id = ?`;
        const adminScoresSql = `SELECT candidate_id, segment_id, score FROM admin_scores WHERE contest_id = ?`;

        const [
            contestRows,
            segments,
            criteria,
            candidates,
            judges,
            scores,
            adminScores
        ] = await Promise.all([
            dbAll(contestSql, [contest_id]),
            dbAll(segmentsSql, []),
            dbAll(criteriaSql, []),
            dbAll(candidatesSql, [contest_id]),
            dbAll(judgesSql, []),
            dbAll(scoresSql, [contest_id]),
            dbAll(adminScoresSql, [contest_id])
        ]);

        if (contestRows.length === 0) {
            return res.status(404).json({ message: "Contest not found." });
        }

        // --- Data Structuring ---
        const scoresMap = new Map(); // "judge_id:candidate_id:criterion_id" -> score
        scores.forEach(s => {
            scoresMap.set(`${s.judge_id}:${s.candidate_id}:${s.criterion_id}`, s.score);
        });
        
        const adminScoresMap = new Map(); // "candidate_id:segment_id" -> score
        adminScores.forEach(s => {
            adminScoresMap.set(`${s.candidate_id}:${s.segment_id}`, s.score);
        });

        const finalResultsSql = `
            WITH JudgeRawSegmentScores AS (
                SELECT 
                    sc.judge_id, sc.candidate_id, s.id as segment_id,
                    SUM(sc.score) as total_segment_score
                FROM scores sc
                JOIN criteria cr ON sc.criterion_id = cr.id
                JOIN segments s ON cr.segment_id = s.id
                WHERE s.type = 'judge' AND sc.contest_id = ?
                GROUP BY sc.judge_id, sc.candidate_id, s.id
            ),
            JudgeAverageSegmentScores AS (
                SELECT candidate_id, segment_id, AVG(total_segment_score) as final_segment_score
                FROM JudgeRawSegmentScores GROUP BY candidate_id, segment_id
            ),
            AdminSegmentScores AS (
                SELECT candidate_id, segment_id, score as final_segment_score
                FROM admin_scores WHERE contest_id = ?
            ),
            CombinedScores AS (
                SELECT candidate_id, segment_id, final_segment_score FROM JudgeAverageSegmentScores
                UNION ALL
                SELECT candidate_id, segment_id, final_segment_score FROM AdminSegmentScores
            ),
            FinalScores AS (
                SELECT 
                    c.id as candidate_id,
                    SUM(cs.final_segment_score * (s.percentage / 100.0)) as total_score
                FROM candidates c
                LEFT JOIN CombinedScores cs ON c.id = cs.candidate_id
                LEFT JOIN segments s ON cs.segment_id = s.id
                WHERE c.contest_id = ?
                GROUP BY c.id
            )
            SELECT candidate_id, total_score as final_score FROM FinalScores ORDER BY final_score DESC
        `;
        const finalScoresRaw = await dbAll(finalResultsSql, [contest_id, contest_id, contest_id]);
        
        const finalScoresMap = new Map();
        finalScoresRaw.forEach(fs => {
            finalScoresMap.set(fs.candidate_id, fs.final_score ? fs.final_score.toFixed(2) : '0.00');
        });


        const report = {
            contestName: contestRows[0].name,
            generatedDate: new Date().toLocaleString(),
            segments,
            criteria,
            candidates,
            judges,
            scoresMap: Object.fromEntries(scoresMap),
            adminScoresMap: Object.fromEntries(adminScoresMap),
            finalScores: Object.fromEntries(finalScoresMap)
        };

        res.json(report);

    } catch (error) {
        console.error("Error generating full tabulation report:", error);
        res.status(500).json({ message: "Failed to generate report." });
    }
});

// --- BACKUP & RESTORE ENDPOINTS ---
const archiver = require('archiver'); // Add this require statement at the top of your server.js file
const UPLOADS_PATH = path.join(__dirname, '../uploads')

app.get('/api/admin/backup', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const backupFilename = `tabulation_backup_${timestamp}.zip`;

    // Set headers to tell the browser it's a zip file download
    res.attachment(backupFilename);

    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    // Listen for all archive data to be written
    archive.on('finish', () => {
        console.log('Archive stream finished.');
    });

    // Good practice to catch warnings (e.g., stat failures and other non-blocking errors)
    archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
            console.warn('Archiver warning:', err);
        } else {
            throw err;
        }
    });

    // Good practice to catch this error explicitly
    archive.on('error', (err) => {
        throw err;
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // 1. Add the database file to the archive
    archive.file(DB_PATH, { name: 'tabulation.db' });

    // 2. Add the entire 'uploads' directory to a folder named 'uploads' inside the zip
    // Check if the uploads directory exists before trying to add it
    if (fs.existsSync(UPLOADS_PATH)) {
        archive.directory(UPLOADS_PATH, 'uploads');
    }
    
    // Finalize the archive (this is when it starts streaming the data)
    archive.finalize();
});

// For restore, we need a separate multer instance to handle the upload.
const restoreStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './'); // Save temporarily in the root project directory
    },
    filename: (req, file, cb) => {
        cb(null, 'backup_upload.tmp'); // Use a temporary name
    }
});
const uploadRestore = multer({ storage: restoreStorage });

app.post('/api/admin/restore', authenticateToken, authorizeRoles('admin', 'superadmin'), uploadRestore.single('backupFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No backup file was uploaded.' });
    }

    const tempPath = req.file.path;

    db.close((err) => {
        if (err) {
            console.error('Error closing database before restore:', err.message);
            return res.status(500).json({ message: 'Could not prepare for restore.' });
        }

        console.log('Database closed. Proceeding with file replacement.');

        fs.rename(tempPath, DB_PATH, (renameErr) => {
            if (renameErr) {
                console.error('Error replacing database file:', renameErr);
                fs.unlinkSync(tempPath);
                return res.status(500).json({ message: 'Failed to restore database file.' });
            }

            console.log('Database file replaced successfully. Server will now restart.');
            
            res.json({ message: 'Restore successful. The server is restarting now. Please wait about 10 seconds and then refresh your browser.' });

            setTimeout(() => {
                process.exit(1); 
            }, 1000);
        });
    });
});

// --- ADMIN-SCORED SEGMENT ENDPOINTS ---
app.get('/api/admin/special-scores', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    const { contest_id } = req.query;
    if (!contest_id) return res.status(400).json({ message: "Contest ID is required" });

    const sql = `
        SELECT 
            s.id as segment_id, 
            s.name as segment_name,
            c.id as candidate_id,
            c.name as candidate_name,
            c.candidate_number,
            asc.score
        FROM segments s
        CROSS JOIN candidates c 
        LEFT JOIN admin_scores asc ON asc.segment_id = s.id AND asc.candidate_id = c.id
        WHERE c.contest_id = ? AND s.type = 'admin'
        ORDER BY s.id, c.candidate_number
    `;
    db.all(sql, [contest_id], (err, rows) => {
        if(err) return res.status(500).json({ message: "DB error fetching scores." });
        res.json(rows);
    });
});

app.post('/api/admin/special-scores', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => {
    const { scores, contest_id } = req.body;
    if (!scores || !contest_id || !Array.isArray(scores)) {
        return res.status(400).json({ message: "Invalid payload." });
    }

    const sql = `INSERT OR REPLACE INTO admin_scores (candidate_id, segment_id, score, contest_id) VALUES (?, ?, ?, ?)`;
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(sql);
        scores.forEach(s => {
            const scoreValue = parseFloat(s.score);
            if (!isNaN(scoreValue)) {
                // THIS IS THE FIX: The parameter order now matches the SQL statement
                stmt.run(s.candidate_id, s.segment_id, scoreValue, contest_id);
            }
        });
        stmt.finalize(err => {
            if (err) {
                db.run("ROLLBACK");
                console.error("Error saving admin scores:", err.message);
                return res.status(500).json({ message: "Failed to save scores." });
            }
            db.run("COMMIT", (commitErr) => {
                if(commitErr) {
                    console.error("Error committing admin scores:", commitErr.message);
                    return res.status(500).json({ message: "Failed to commit scores." });
                }
                res.status(201).json({ message: "Scores saved successfully." });
                calculateAndEmitResults();
            });
        });
    });
});

// --- SERVER START & SHUTDOWN ---
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
process.on('SIGINT', () => db.close(() => process.exit(0)));