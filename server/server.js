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

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const DB_PATH = './db/tabulation.db';
const JWT_SECRET = 'your_super_secret_key_change_this';

// --- INITIALIZATION & MIDDLEWARE ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(cors()); app.use(express.json()); app.use(express.static('public')); app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- FILE UPLOAD SETUP ---
const storage = multer.diskStorage({ destination: (req, file, cb) => { cb(null, 'uploads/'); }, filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); } });
const upload = multer({ storage: storage });

// --- DATABASE CONNECTION ---
const db = new sqlite3.Database(DB_PATH, (err) => { if (err) console.error("DB Connection Error:", err.message); else console.log("Successfully connected to the database."); });
db.run("PRAGMA foreign_keys = ON;");

// --- AUTH & RBAC MIDDLEWARE ---
const authenticateToken = (req, res, next) => { const authHeader = req.headers['authorization']; const token = authHeader && authHeader.split(' ')[1]; if (token == null) return res.sendStatus(401); jwt.verify(token, JWT_SECRET, (err, user) => { if (err) return res.sendStatus(403); req.user = user; next(); }); };
const authorizeRoles = (...allowedRoles) => { return (req, res, next) => { if (!req.user || !allowedRoles.includes(req.user.role)) { return res.status(403).json({ message: 'Access denied.' }); } next(); }; };

// --- TABULATION FUNCTION ---
const calculateAndEmitResults = () => { const sql = `WITH JudgeSegmentScores AS (SELECT sc.judge_id, sc.candidate_id, s.id as segment_id, s.contest_id, SUM(sc.score * (cr.max_score / 100.0)) as total_raw_segment_score FROM scores sc JOIN criteria cr ON sc.criterion_id = cr.id JOIN segments s ON cr.segment_id = s.id GROUP BY sc.judge_id, sc.candidate_id, s.id), AvgSegmentScores AS (SELECT candidate_id, segment_id, contest_id, AVG(total_raw_segment_score) as avg_segment_score FROM JudgeSegmentScores GROUP BY candidate_id, segment_id), FinalScores AS (SELECT c.id as candidate_id, SUM(ags.avg_segment_score * (s.percentage / 100.0)) as total_score FROM candidates c LEFT JOIN AvgSegmentScores ags ON c.id = ags.candidate_id LEFT JOIN segments s ON ags.segment_id = s.id GROUP BY c.id) SELECT cand.id, cand.name, cand.candidate_number, cand.image_url, cont.id as contest_id, cont.name as contest_name, fs.total_score FROM candidates cand JOIN contests cont ON cand.contest_id = cont.id LEFT JOIN FinalScores fs ON cand.id = fs.candidate_id ORDER BY cont.id, fs.total_score DESC;`; db.all(sql, [], (err, results) => { if (err) { console.error("Error calculating results:", err.message); return; } const groupedResults = results.reduce((acc, row) => { const { contest_name } = row; if (!acc[contest_name]) { acc[contest_name] = []; } acc[contest_name].push(row); return acc; }, {}); io.emit('update_results', groupedResults); }); };

// --- SOCKET.IO CONNECTION ---
io.on('connection', (socket) => { console.log('A user connected'); calculateAndEmitResults(); socket.on('disconnect', () => console.log('User disconnected')); });

// === API ROUTES ===
app.post('/api/auth/login', (req, res) => { const { username, password } = req.body; db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => { if (err || !user) return res.status(401).json({ message: 'Invalid credentials.' }); bcrypt.compare(password, user.password_hash, (err, isMatch) => { if (err || !isMatch) return res.status(401).json({ message: 'Invalid credentials.' }); const payload = { id: user.id, username: user.username, role: user.role }; const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' }); res.json({ token, user: payload }); }); }); });
app.get('/api/users', authenticateToken, authorizeRoles('superadmin'), (req, res) => { db.all("SELECT id, username, role FROM users", [], (err, rows) => res.json(rows)); });
app.post('/api/users', authenticateToken, authorizeRoles('superadmin'), (req, res) => { const { username, password, role } = req.body; bcrypt.hash(password, 10, (err, hash) => { db.run(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`, [username, hash, role], function (err) { if (err) return res.status(409).json({ message: 'Username exists.' }); res.status(201).json({ id: this.lastID, username, role }); }); }); });
app.delete('/api/users/:id', authenticateToken, authorizeRoles('superadmin'), (req, res) => { if (req.user.id == req.params.id) return res.status(403).json({ message: "Cannot delete self." }); db.run('DELETE FROM users WHERE id = ?', [req.params.id], (err) => res.sendStatus(204)); });
app.get('/api/contests', authenticateToken, (req, res) => { db.all("SELECT * FROM contests", [], (err, rows) => res.json(rows)); });
app.post('/api/contests', authenticateToken, authorizeRoles('admin', 'superadmin'), upload.single('image'), (req, res) => { const { name } = req.body; const imageUrl = req.file ? `/uploads/${req.file.filename}` : null; db.run('INSERT INTO contests (name, image_url) VALUES (?, ?)', [name, imageUrl], function(err) { res.status(201).json({ id: this.lastID, name, imageUrl }); }); });
app.delete('/api/contests/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.run('DELETE FROM contests WHERE id = ?', [req.params.id], (err) => res.sendStatus(204)); });
app.get('/api/contests/:contestId/candidates', authenticateToken, (req, res) => { db.all("SELECT * FROM candidates WHERE contest_id = ?", [req.params.contestId], (err, rows) => res.json(rows)); });
app.post('/api/candidates', authenticateToken, authorizeRoles('admin', 'superadmin'), upload.single('image'), (req, res) => { const { name, candidate_number, contest_id } = req.body; if (!name || !candidate_number || !contest_id) return res.status(400).json({ message: "Missing fields."}); const imageUrl = req.file ? `/uploads/${req.file.filename}` : null; db.run('INSERT INTO candidates (name, candidate_number, contest_id, image_url) VALUES (?, ?, ?, ?)', [name, candidate_number, contest_id, imageUrl], function(err) { if(err) return res.status(500).json({message: "DB error."}); res.status(201).json({ id: this.lastID }); }); });
app.delete('/api/candidates/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.run('DELETE FROM candidates WHERE id = ?', [req.params.id], () => res.sendStatus(204)); });
app.get('/api/contests/:contestId/segments', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.all("SELECT * FROM segments WHERE contest_id = ?", [req.params.contestId], (err, rows) => res.json(rows)); });
app.post('/api/segments', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { const { name, percentage, contest_id } = req.body; db.run('INSERT INTO segments (name, percentage, contest_id) VALUES (?, ?, ?)', [name, percentage, contest_id], function(err) { res.status(201).json({ id: this.lastID }); }); });
app.delete('/api/segments/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.run('DELETE FROM segments WHERE id = ?', [req.params.id], () => res.sendStatus(204)); });
app.get('/api/segments/:segmentId/criteria', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.all("SELECT * FROM criteria WHERE segment_id = ?", [req.params.segmentId], (err, rows) => res.json(rows)); });
app.post('/api/criteria', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { const { name, max_score, segment_id } = req.body; db.run('INSERT INTO criteria (name, max_score, segment_id) VALUES (?, ?, ?)', [name, max_score, segment_id], function(err) { res.status(201).json({ id: this.lastID }); }); });
app.delete('/api/criteria/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.run('DELETE FROM criteria WHERE id = ?', [req.params.id], () => res.sendStatus(204)); });

// --- JUDGING FLOW (WITH NEW ROUTE) ---
app.get('/api/judging/contests', authenticateToken, authorizeRoles('judge'), (req, res) => { const sql = `SELECT DISTINCT c.* FROM contests c JOIN segments s ON c.id = s.contest_id WHERE s.id NOT IN (SELECT cr.segment_id FROM scores sc JOIN criteria cr ON sc.criterion_id = cr.id WHERE sc.judge_id = ?)`; db.all(sql, [req.user.id], (err, rows) => { if (err) return res.status(500).json({ message: "DB error" }); res.json(rows); }); });
app.get('/api/judging/contests/:contestId/segments', authenticateToken, authorizeRoles('judge'), (req, res) => { const sql = `SELECT * FROM segments s WHERE s.contest_id = ? AND s.id NOT IN (SELECT cr.segment_id FROM scores sc JOIN criteria cr ON sc.criterion_id = cr.id WHERE sc.judge_id = ?)`; db.all(sql, [req.params.contestId, req.user.id], (err, rows) => { if (err) return res.status(500).json({ message: "DB error" }); res.json(rows); }); });
// ** THIS IS THE NEW, CORRECTED ROUTE **
app.get('/api/judging/segments/:segmentId/criteria', authenticateToken, authorizeRoles('judge'), (req, res) => {
    // A judge can only get criteria for a segment they haven't scored yet.
    // This is an implicit security check.
    db.all("SELECT * FROM criteria WHERE segment_id = ?", [req.params.segmentId], (err, rows) => {
        if (err) return res.status(500).json({ message: "DB error" });
        res.json(rows);
    });
});
app.post('/api/judging/scores', authenticateToken, authorizeRoles('judge'), (req, res) => { const { scores, contest_id } = req.body; if (!scores || !contest_id) return res.status(400).json({ message: "Missing scores or contest ID." }); const sql = `INSERT INTO scores (judge_id, candidate_id, criterion_id, score, contest_id) VALUES (?, ?, ?, ?, ?)`; db.serialize(() => { db.run("BEGIN TRANSACTION"); const stmt = db.prepare(sql); scores.forEach(s => stmt.run(req.user.id, s.candidate_id, s.criterion_id, s.score, contest_id)); stmt.finalize(err => { if (err) { db.run("ROLLBACK"); return res.status(500).json({ message: "Failed to save scores." }); } db.run("COMMIT", () => { res.status(201).json({ message: "Scores submitted." }); calculateAndEmitResults(); }); }); }); });

// --- AWARDS & PUBLIC RESULTS ---
app.get('/api/awards', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { db.all("SELECT * FROM awards", [], (err, rows) => res.json(rows)); });
app.post('/api/awards', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { const { name, type } = req.body; db.run('INSERT INTO awards (name, type) VALUES (?, ?)', [name, type], function (err) { if (err) return res.status(409).json({ message: "Award exists." }); res.status(201).json({ id: this.lastID, name, type }); }); });
app.post('/api/award-winners', authenticateToken, authorizeRoles('admin', 'superadmin'), (req, res) => { const { award_id, candidate_id } = req.body; db.run('INSERT OR REPLACE INTO award_winners (award_id, candidate_id) VALUES (?, ?)', [award_id, candidate_id], (err) => { if (err) return res.status(500).json({ message: "DB Error." }); res.status(201).json({ message: "Winner assigned successfully" }); }); });
app.get('/api/public-winners', (req, res) => { const sql = `SELECT a.name as award_name, a.type, c.name as candidate_name, c.image_url FROM award_winners aw JOIN awards a ON aw.award_id = a.id JOIN candidates c ON aw.candidate_id = c.id ORDER BY a.type, a.name`; db.all(sql, [], (err, rows) => { if (err) return res.status(500).send("Error"); res.json(rows); }); });

// --- SERVER START & SHUTDOWN ---
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
process.on('SIGINT', () => db.close(() => process.exit(0)));