const db = require('../config/db');

const getStats = async (req, res) => {
    try {
        const users = await db.getAsync('SELECT COUNT(*) as count FROM users');
        const owners = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE role='owner'");
        const tenants = await db.getAsync("SELECT COUNT(*) as count FROM users WHERE role='tenant'");
        
        const listings = await db.getAsync('SELECT COUNT(*) as count FROM listings');
        const filledListings = await db.getAsync('SELECT COUNT(*) as count FROM listings WHERE is_filled = 1');
        
        const interests = await db.getAsync('SELECT COUNT(*) as count FROM interests');
        const messages = await db.getAsync('SELECT COUNT(*) as count FROM messages');
        
        const scores = await db.getAsync('SELECT COUNT(*) as count FROM compatibility_scores');
        const fallbackScores = await db.getAsync('SELECT COUNT(*) as count FROM compatibility_scores WHERE is_fallback = 1');

        res.json({
            users: users.count,
            owners: owners.count,
            tenants: tenants.count,
            listings: listings.count,
            filledListings: filledListings.count,
            interests: interests.count,
            messages: messages.count,
            scores: scores.count,
            fallbackScores: fallbackScores.count
        });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

const getUsers = async (req, res) => {
    try {
        const users = await db.allAsync('SELECT id, email, role, name, created_at FROM users');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

const deleteUser = async (req, res) => {
    try {
        // ON DELETE CASCADE takes care of associated records
        await db.runAsync('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

const getListings = async (req, res) => {
    try {
        const listings = await db.allAsync('SELECT * FROM listings');
        res.json(listings);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

const deleteListing = async (req, res) => {
    try {
        await db.runAsync('DELETE FROM listings WHERE id = ?', [req.params.id]);
        res.json({ message: 'Listing deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = { getStats, getUsers, deleteUser, getListings, deleteListing };
