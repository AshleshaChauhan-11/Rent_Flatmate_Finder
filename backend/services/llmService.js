const db = require('../config/db');

// Fallback scoring rule
function calculateRuleBasedScore(listing, profile) {
    let score = 0;
    
    // Location match
    const listLoc = listing.location.toLowerCase();
    const prefLoc = profile.preferred_location.toLowerCase();
    if (listLoc === prefLoc) {
        score += 50;
    } else if (listLoc.includes(prefLoc) || prefLoc.includes(listLoc)) {
        score += 25;
    } else {
        const listWords = listLoc.split(/[,\s]+/);
        const prefWords = prefLoc.split(/[,\s]+/);
        const commonWords = listWords.filter(w => w && prefWords.includes(w));
        if (commonWords.length > 0) {
            score += 15;
        }
    }

    // Budget match
    const rent = parseFloat(listing.rent);
    const min = parseFloat(profile.budget_range_min);
    const max = parseFloat(profile.budget_range_max);

    if (rent >= min && rent <= max) {
        score += 50;
    } else {
        // Within 20% tolerance
        const tolerance = max * 0.20;
        if (rent > max && rent <= (max + tolerance)) {
            score += 25;
        } else if (rent < min && rent >= (min - tolerance)) {
            score += 25;
        }
    }

    const explanation = `Calculated using rule-based fallback. Location score evaluated based on matching keywords. Budget scored against preferred range $${min}-$${max}.`;
    return { score, explanation };
}

// Compute compatibility using Gemini API
async function computeCompatibilityScore(listing, profile) {
    // Check if score already exists
    const existing = await db.getAsync(
        'SELECT * FROM compatibility_scores WHERE listing_id = ? AND tenant_profile_id = ?',
        [listing.id, profile.id]
    );

    if (existing) {
        return existing;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let scoreData = null;
    let isFallback = 0;

    if (apiKey) {
        try {
            const promptText = `Given this room listing: ${JSON.stringify(listing)} and this tenant profile: ${JSON.stringify(profile)}, compute a compatibility score from 0 to 100 based on budget and location match. Return JSON: { "score": number, "explanation": "string" }`;
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            if (response.ok) {
                const data = await response.json();
                const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (contentText) {
                    const parsed = JSON.parse(contentText);
                    if (parsed && typeof parsed.score === 'number' && typeof parsed.explanation === 'string') {
                        scoreData = { score: parsed.score, explanation: parsed.explanation };
                    }
                }
            } else {
                console.error("Gemini API Error Status:", response.status);
            }
        } catch (error) {
            console.error("Gemini API Request Failed", error);
        }
    }

    if (!scoreData) {
        scoreData = calculateRuleBasedScore(listing, profile);
        isFallback = 1;
    }

    // Save to database
    const result = await db.runAsync(
        'INSERT INTO compatibility_scores (listing_id, tenant_profile_id, score, explanation, is_fallback) VALUES (?, ?, ?, ?, ?)',
        [listing.id, profile.id, scoreData.score, scoreData.explanation, isFallback]
    );

    return {
        id: result.lastID,
        listing_id: listing.id,
        tenant_profile_id: profile.id,
        score: scoreData.score,
        explanation: scoreData.explanation,
        is_fallback: isFallback
    };
}

module.exports = { computeCompatibilityScore, calculateRuleBasedScore };
