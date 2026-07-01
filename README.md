# Rent & Flatmate Finder Platform

An AI-Powered platform where owners list rooms and tenants find their perfect match through compatibility scoring.

## Setup Guide

### Prerequisites
- Node.js v18+ (Required for native `fetch`)
- npm

### Installation
1. Clone the repository and navigate to the root directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Set up your `.env` variables (e.g. `GEMINI_API_KEY`). If the Gemini API key is missing or invalid, the app will gracefully fall back to a rule-based matching system.
5. Start the server (this will automatically initialize and seed the SQLite database):
   ```bash
   npm start
   ```

## Database Schema (SQLite)

- `users` (id, email, password_hash, role: enum('tenant', 'owner', 'admin'), name, created_at)
- `listings` (id, owner_id, location, rent, available_from, room_type, furnishing_status, photos, is_filled, created_at)
- `tenant_profiles` (id, tenant_id, preferred_location, budget_range_min, budget_range_max, move_in_date, created_at)
- `compatibility_scores` (id, listing_id, tenant_profile_id, score, explanation, is_fallback, created_at)
- `interests` (id, listing_id, tenant_id, status: enum('pending', 'accepted', 'declined'), created_at)
- `messages` (id, interest_id, sender_id, content, created_at)

## API Docs

- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- **Tenant**: `POST /api/tenant/profile`, `GET /api/tenant/listings`, `POST /api/tenant/interest`, `GET /api/tenant/interests`
- **Owner**: `POST /api/owner/listings`, `GET /api/owner/listings`, `PUT /api/owner/listings/:id/filled`, `GET /api/owner/interests`, `PUT /api/owner/interests/:id/status`
- **Admin**: `GET /api/admin/stats`, `GET /api/admin/users`, `DELETE /api/admin/users/:id`, `GET /api/admin/listings`, `DELETE /api/admin/listings/:id`
- **Chat**: `GET /api/chat/:interestId` (REST for history), `ws://[host]/ws?token=[token]` (WebSocket for real-time)

## LLM Prompt & Example I/O

**Prompt String Used:**
`Given this room listing: ${JSON.stringify(listing)} and this tenant profile: ${JSON.stringify(profile)}, compute a compatibility score from 0 to 100 based on budget and location match. Return JSON: { "score": number, "explanation": "string" }`

**Example Input:**
Listing: `{"id":1, "location":"New York", "rent":1200, "room_type":"Private Room"}`
Profile: `{"id":1, "preferred_location":"New York", "budget_range_min":1000, "budget_range_max":1500}`

**Example Output:**
```json
{
  "score": 95,
  "explanation": "Perfect location match in New York, and the rent of $1200 is well within the budget range of $1000 to $1500."
}
```
