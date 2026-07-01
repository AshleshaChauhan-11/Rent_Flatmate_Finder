const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const register = async (req, res) => {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (!['tenant', 'owner', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.runAsync(
            'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, role, name]
        );
        res.status(201).json({ message: 'User registered successfully', userId: result.lastID });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Database error' });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    try {
        const user = await db.getAsync('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'supersecretkeychangeinprod',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

const getProfile = async (req, res) => {
    try {
        const user = await db.getAsync('SELECT id, email, role, name, created_at FROM users WHERE id = ?', [req.user.id]);
        if (req.user.role === 'tenant') {
            const profile = await db.getAsync('SELECT * FROM tenant_profiles WHERE tenant_id = ?', [req.user.id]);
            user.profile = profile || null;
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = { register, login, getProfile };
