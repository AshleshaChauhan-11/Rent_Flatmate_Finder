const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, '../../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run('PRAGMA foreign_keys = ON;', initSchema);
    }
});

function initSchema() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('owner', 'tenant', 'admin')),
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Listings Table
        db.run(`CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            location TEXT NOT NULL,
            rent REAL NOT NULL,
            available_from TEXT NOT NULL,
            room_type TEXT NOT NULL,
            furnishing_status TEXT NOT NULL,
            photos TEXT,
            is_filled INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Tenant Profiles Table
        db.run(`CREATE TABLE IF NOT EXISTS tenant_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id INTEGER UNIQUE NOT NULL,
            preferred_location TEXT NOT NULL,
            budget_range_min REAL NOT NULL,
            budget_range_max REAL NOT NULL,
            move_in_date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Compatibility Scores Table
        db.run(`CREATE TABLE IF NOT EXISTS compatibility_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL,
            tenant_profile_id INTEGER NOT NULL,
            score INTEGER NOT NULL,
            explanation TEXT,
            is_fallback INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_profile_id) REFERENCES tenant_profiles(id) ON DELETE CASCADE,
            UNIQUE(listing_id, tenant_profile_id)
        )`);

        // Interests Table
        db.run(`CREATE TABLE IF NOT EXISTS interests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL,
            tenant_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'declined')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(listing_id, tenant_id)
        )`);

        // Messages Table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            interest_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        seedAdmin();
    });
}

function seedAdmin() {
    db.get("SELECT id FROM users WHERE role = 'admin'", (err, row) => {
        if (!row) {
            const hash = bcrypt.hashSync('admin123', 10);
            db.run("INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)",
                ['admin@flatmatefinder.com', hash, 'admin', 'System Admin'], (err) => {
                    if (err) console.error('Error seeding admin', err);
                    else console.log('Seeded admin user (admin@flatmatefinder.com / admin123)');
                });
        }
    });
}

// Wrapper for promises to use async/await
db.getAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

db.allAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

db.runAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

module.exports = db;
