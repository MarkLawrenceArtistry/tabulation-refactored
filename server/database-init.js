const sqlite3 = require('sqlite3').verbose();
const DB_PATH = './db/tabulation.db';
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) { console.error("Error opening database " + err.message); }
    else { console.log("Connected to the SQLite database for initialization."); }
});

db.serialize(() => {
    console.log("Dropping old tables if they exist...");
    db.run(`DROP TABLE IF EXISTS award_winners`);
    db.run(`DROP TABLE IF EXISTS awards`);
    db.run(`DROP TABLE IF EXISTS admin_scores`);
    db.run(`DROP TABLE IF EXISTS scores`);
    db.run(`DROP TABLE IF EXISTS criteria`);
    db.run(`DROP TABLE IF EXISTS segments`);
    db.run(`DROP TABLE IF EXISTS candidates`);
    db.run(`DROP TABLE IF EXISTS contests`);
    db.run(`DROP TABLE IF EXISTS users`);
    
    console.log("Creating new tables with correct structure...");

    // Users & Contests are mostly the same
    db.run(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, active_session_id TEXT NULL)`);
    db.run(`CREATE TABLE contests (id INTEGER PRIMARY KEY, name TEXT NOT NULL, image_url TEXT)`);

    // Candidates now cascade delete with their contest
    db.run(`CREATE TABLE candidates (id INTEGER PRIMARY KEY, name TEXT NOT NULL, candidate_number INTEGER NOT NULL, image_url TEXT, branch TEXT, course TEXT, section TEXT, year_level TEXT, contest_id INTEGER NOT NULL, FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE)`);

    // Segments now belong to a contest and include a STATUS column
    db.run(`CREATE TABLE segments (id INTEGER PRIMARY KEY, name TEXT NOT NULL, percentage REAL NOT NULL, type TEXT NOT NULL DEFAULT 'judge', status TEXT NOT NULL DEFAULT 'closed', contest_id INTEGER NOT NULL, FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE)`);

    // Criteria now belong to a segment
    db.run(`CREATE TABLE criteria (id INTEGER PRIMARY KEY, name TEXT NOT NULL, max_score INTEGER NOT NULL, segment_id INTEGER NOT NULL, FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE)`);

    // Scores now have a direct link to the contest for easier querying
    db.run(`CREATE TABLE scores (id INTEGER PRIMARY KEY, judge_id INTEGER NOT NULL, candidate_id INTEGER NOT NULL, criterion_id INTEGER NOT NULL, contest_id INTEGER NOT NULL, score REAL NOT NULL, FOREIGN KEY (judge_id) REFERENCES users(id), FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE, FOREIGN KEY (criterion_id) REFERENCES criteria(id) ON DELETE CASCADE, FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE)`);
    db.run(`CREATE TABLE admin_scores (id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL, segment_id INTEGER NOT NULL, contest_id INTEGER NOT NULL, score REAL NOT NULL, FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE, FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE, FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE, UNIQUE(candidate_id, segment_id))`);

    // Awards are universal
    db.run(`CREATE TABLE awards (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, type TEXT NOT NULL)`);
    db.run(`CREATE TABLE award_winners (award_id INTEGER, candidate_id INTEGER, PRIMARY KEY (award_id, candidate_id), FOREIGN KEY (award_id) REFERENCES awards(id) ON DELETE CASCADE, FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE)`);

    console.log("All tables created successfully.");
});

db.close((err) => {
    if (err) { console.error(err.message); }
    console.log('Database initialization finished.');
});