const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const readline = require('readline');

const DB_PATH = './db/tabulation.db';
const db = new sqlite3.Database(DB_PATH);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const username = 'superadmin';
const role = 'superadmin';

rl.question(`Enter password for ${username}: `, (password) => {
    if (!password) {
        console.error('Password cannot be empty.');
        rl.close();
        db.close();
        return;
    }

    // Hash the password
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return;
        }

        const sql = `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`;

        db.run(sql, [username, hash, role], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    console.error(`Error: User '${username}' already exists.`);
                } else {
                    console.error('Database error:', err.message);
                }
            } else {
                console.log(`User '${username}' created successfully with ID: ${this.lastID}`);
            }
        });

        // Close resources
        rl.close();
        db.close();
    });
});