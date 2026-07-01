const db = require('../config/db');
const { computeCompatibilityScore } = require('../services/llmService');

const createListing = async (req, res) => {
    const { location, rent, available_from, room_type, furnishing_status, photos } = req.body;
    if (!location || !rent || !available_from || !room_type || !furnishing_status) {
        return res.status(400).json({ error: 'Missing required listing fields' });
    }

    try {
        const result = await db.runAsync(
            `INSERT INTO listings (owner_id, location, rent, available_from, room_type, furnishing_status, photos) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, location, rent, available_from, room_type, furnishing_status, photos || '']
        );
        res.status(201).json({ message: 'Listing created', listingId: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

const getOwnerListings = async (req, res) => {
    try {
        const listings = await db.allAsync('SELECT * FROM listings WHERE owner_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json(listings);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

const markAsFilled = async (req, res) => {
    try {
        await db.runAsync('UPDATE listings SET is_filled = 1 WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Listing marked as filled' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
};

const getTenantListings = async (req, res) => {
    try {
        const tenantProfile = await db.getAsync('SELECT * FROM tenant_profiles WHERE tenant_id = ?', [req.user.id]);
        if (!tenantProfile) {
            return res.status(400).json({ error: 'Create a tenant profile first to view scored listings' });
        }

        const listings = await db.allAsync('SELECT * FROM listings WHERE is_filled = 0 ORDER BY created_at DESC');
        const scoredListings = [];

        // Compute scores
        for (const listing of listings) {
            const scoreData = await computeCompatibilityScore(listing, tenantProfile);
            scoredListings.push({
                ...listing,
                compatibility: scoreData
            });
        }

        // Sort by score desc
        scoredListings.sort((a, b) => b.compatibility.score - a.compatibility.score);
        res.json(scoredListings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = { createListing, getOwnerListings, markAsFilled, getTenantListings };
