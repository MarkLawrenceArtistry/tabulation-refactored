const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function normalizeParams(params) {
    if (params === undefined || params === null) return [];
    const arr = Array.isArray(params) ? params : [params];
    return arr.map((p) => (p === undefined ? null : p));
}

class SqliteCompatDatabase {
    constructor(dbPath, callback) {
        this._closed = false;
        try {
            const dir = path.dirname(dbPath);
            if (dir && dir !== '.') {
                fs.mkdirSync(dir, { recursive: true });
            }
            this._db = new DatabaseSync(dbPath);
            if (callback) callback(null);
        } catch (err) {
            if (callback) callback(err);
            else throw err;
        }
    }

    serialize(fn) {
        if (typeof fn === 'function') fn();
        return this;
    }

    run(sql, params = [], cb = null) {
        if (typeof params === 'function') {
            cb = params;
            params = [];
        }
        try {
            const result = this._db.prepare(sql).run(...normalizeParams(params));
            const context = {
                lastID: Number(result.lastInsertRowid ?? 0),
                changes: Number(result.changes ?? 0)
            };
            if (cb) cb.call(context, null);
        } catch (err) {
            if (cb) cb.call({ lastID: 0, changes: 0 }, err);
            else console.error('SQLite run error:', err.message);
        }
        return this;
    }

    get(sql, params = [], cb = null) {
        if (typeof params === 'function') {
            cb = params;
            params = [];
        }
        try {
            const row = this._db.prepare(sql).get(...normalizeParams(params));
            if (cb) cb(null, row);
        } catch (err) {
            if (cb) cb(err);
            else console.error('SQLite get error:', err.message);
        }
        return this;
    }

    all(sql, params = [], cb = null) {
        if (typeof params === 'function') {
            cb = params;
            params = [];
        }
        try {
            const rows = this._db.prepare(sql).all(...normalizeParams(params));
            if (cb) cb(null, rows);
        } catch (err) {
            if (cb) cb(err);
            else console.error('SQLite all error:', err.message);
        }
        return this;
    }

    prepare(sql) {
        const stmt = this._db.prepare(sql);
        let lastError = null;
        return {
            run(...args) {
                if (lastError) return this;
                const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
                try {
                    stmt.run(...normalizeParams(params));
                } catch (err) {
                    lastError = err;
                }
                return this;
            },
            finalize(cb) {
                if (cb) cb(lastError);
            }
        };
    }

    close(cb) {
        try {
            if (this._db && !this._closed) {
                this._db.close();
                this._closed = true;
            }
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
            else console.error('SQLite close error:', err.message);
        }
    }
}

function openDatabase(dbPath, callback) {
    return new SqliteCompatDatabase(dbPath, callback);
}

module.exports = { openDatabase };