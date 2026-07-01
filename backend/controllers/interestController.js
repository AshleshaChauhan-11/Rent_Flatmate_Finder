const db = require('../config/db');
const { sendEmail } = require('../services/emailService');

const sendInterest = async (req, res) => {
    const { listing_id } = req.body;
    const tenant_id = req.user.id;

    try {
        const listing = await db.getAsync('SELECT * FROM listings WHERE id = ?', [listing_id]);
        if (!listing) return res.status(404).json({ error: 'Listing not found' });

        const owner = await db.getAsync('SELECT * FROM users WHERE id = ?', [listing.owner_id]);
        const tenant = await db.getAsync('SELECT * FROM users WHERE id = ?', [tenant_id]);
        const tenantProfile = await db.getAsync('SELECT * FROM tenant_profiles WHERE tenant_id = ?', [tenant_id]);

        const result = await db.runAsync(
            'INSERT INTO interests (listing_id, tenant_id, status) VALUES (?, ?, ?)',
            [listing_id, tenant_id, 'pending']
        );

        // check score to send owner email if score > 80
        const scoreEntry = await db.getAsync(
            'SELECT score FROM compatibility_scores WHERE listing_id = ? AND tenant_profile_id = ?',
            [listing_id, tenantProfile.id]
        );

        if (scoreEntry && scoreEntry.score >= 80) {
            await sendEmail(
                owner.email, 
                'High Match Tenant Interest!', 
                `Tenant ${tenant.name} with an ${scoreEntry.score}% compatibility score just showed interest in your listing at ${listing.location}!`
            );
        }

        res.status(201).json({ message: 'Interest sent successfully', interestId: result.lastID });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Interest already sent' });
        }
        res.status(500).json({ error: 'Database error' });
    }
};

const getOwnerInterests = async (req, res) => {
    try {
        const query = `
            SELECT i.id, i.status, i.created_at, l.location, t.name as tenant_name, t.email as tenant_email
            FROM interests i
            JOIN listings l ON i.listing_id = l.id
            JOIN users t ON i.tenant_id = t.id
            WHERE l.owner_id = ?
            ORDER BY i.created_at DESC
        `;
        const interests = await db.allAsync(query, [req.user.id]);
        res.json(interests);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

const getTenantInterests = async (req, res) => {
    try {
        const query = `
            SELECT i.id, i.status, i.created_at, l.location, l.rent, u.name as owner_name
            FROM interests i
            JOIN listings l ON i.listing_id = l.id
            JOIN users u ON l.owner_id = u.id
            WHERE i.tenant_id = ?
            ORDER BY i.created_at DESC
        `;
        const interests = await db.allAsync(query, [req.user.id]);
        res.json(interests);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

const updateInterestStatus = async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    if (!['accepted', 'declined'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const interest = await db.getAsync(`
            SELECT i.*, l.location, t.email as tenant_email, o.name as owner_name 
            FROM interests i
            JOIN listings l ON i.listing_id = l.id
            JOIN users t ON i.tenant_id = t.id
            JOIN users o ON l.owner_id = o.id
            WHERE i.id = ? AND l.owner_id = ?
        `, [id, req.user.id]);

        if (!interest) {
            return res.status(404).json({ error: 'Interest request not found or unauthorized' });
        }

        await db.runAsync('UPDATE interests SET status = ? WHERE id = ?', [status, id]);

        // Email tenant about owner response
        await sendEmail(
            interest.tenant_email,
            `Interest ${status.toUpperCase()}!`,
            `Your interest in the property at ${interest.location} was ${status} by ${interest.owner_name}.`
        );

        res.json({ message: `Interest ${status}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = { sendInterest, getOwnerInterests, getTenantInterests, updateInterestStatus };
