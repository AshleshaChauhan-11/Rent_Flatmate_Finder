const db = require('../config/db');

const getChatMessages = async (req, res) => {
    const { interestId } = req.params;
    try {
        // Check if interest is accepted and user is part of it
        const interest = await db.getAsync(`
            SELECT i.*, l.owner_id 
            FROM interests i 
            JOIN listings l ON i.listing_id = l.id 
            WHERE i.id = ? AND i.status = 'accepted'
        `, [interestId]);

        if (!interest) {
            return res.status(404).json({ error: 'Accepted interest not found' });
        }

        if (interest.tenant_id !== req.user.id && interest.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized to view this chat' });
        }

        const messages = await db.allAsync('SELECT * FROM messages WHERE interest_id = ? ORDER BY created_at ASC', [interestId]);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = { getChatMessages };
