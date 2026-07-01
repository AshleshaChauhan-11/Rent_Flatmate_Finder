const db = require('../../src/config/db');

const upsertProfile = async (req, res) => {
    const { preferred_location, budget_range_min, budget_range_max, move_in_date } = req.body;
    const tenant_id = req.user.id;

    if (!preferred_location || budget_range_min == null || budget_range_max == null || !move_in_date) {
        return res.status(400).json({ error: 'All profile fields are required' });
    }

    try {
        const existing = await db.getAsync('SELECT id FROM tenant_profiles WHERE tenant_id = ?', [tenant_id]);
        
        let profileId;
        if (existing) {
            await db.runAsync(
                `UPDATE tenant_profiles SET preferred_location = ?, budget_range_min = ?, budget_range_max = ?, move_in_date = ? WHERE tenant_id = ?`,
                [preferred_location, budget_range_min, budget_range_max, move_in_date, tenant_id]
            );
            profileId = existing.id;
            // Invalidate old scores since profile changed
            await db.runAsync('DELETE FROM compatibility_scores WHERE tenant_profile_id = ?', [existing.id]);
        } else {
            const result = await db.runAsync(
                `INSERT INTO tenant_profiles (tenant_id, preferred_location, budget_range_min, budget_range_max, move_in_date) VALUES (?, ?, ?, ?, ?)`,
                [tenant_id, preferred_location, budget_range_min, budget_range_max, move_in_date]
            );
            profileId = result.lastID;
        }

        res.json({ message: 'Profile saved successfully', profileId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

const getProfile = async (req, res) => {
    try {
        const profile = await db.getAsync('SELECT * FROM tenant_profiles WHERE tenant_id = ?', [req.user.id]);
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json(profile);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = { upsertProfile, getProfile };
