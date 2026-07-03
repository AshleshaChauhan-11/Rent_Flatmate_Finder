# Rent & Flatmate Finder Platform

An AI-Powered platform where owners list rooms and tenants find their perfect match through LLM-based compatibility scoring, real-time chat, and email notifications.

**Live Demo:** [Click here to view](https://rent-flatmate-finder-ujf7-jlq38p5y4.vercel.app?_vercel_share=YZgJLwKi0Q1TAwJ7sPOiUmSA27rLaJyh)
---

## Table of Contents

- [Setup Guide](#setup-guide)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [LLM Prompt & Example I/O](#llm-prompt--example-io)
- [Tech Stack](#tech-stack)

---

## Setup Guide

### Prerequisites

- **Node.js** v18+ (required for native `fetch` API)
- **npm** v9+

### Backend Setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# Edit .env and add your GROQ_API_KEY (free at https://console.groq.com/keys)

# 4. Start the server (auto-creates SQLite database & seeds admin user)
npm start
```

The backend runs on **http://localhost:3000**

> **Default Admin Credentials:** `admin@flatmatefinder.com` / `admin123`

### Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd frontend/rent-flatmate-finder

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The frontend runs on **http://localhost:5173**

### Production Build

```bash
cd frontend/rent-flatmate-finder
npm run build
```

The built files are output to `dist/` and can be served statically or deployed to Vercel/Render.

---

## Environment Variables

Create a `.env` file in `backend/` (see `.env.example`):

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `3000`) |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens. Change in production! |
| `GROQ_API_KEY` | Yes* | Groq API key for LLM compatibility scoring. Free at https://console.groq.com/keys. *If missing, the app falls back to rule-based scoring.* |
| `SMTP_HOST` | No | SMTP server hostname for email notifications |
| `SMTP_PORT` | No | SMTP server port |
| `SMTP_USER` | No | SMTP auth username |
| `SMTP_PASS` | No | SMTP auth password |
| `SMTP_FROM` | No | "From" address for emails (default: `noreply@flatmatefinder.com`) |

> **Note:** If SMTP is not configured, emails are logged to the console instead of being sent.

---

## Database Schema

The application uses **SQLite** with the following schema. Tables are auto-created on server startup via `CREATE TABLE IF NOT EXISTS`. Foreign keys use `ON DELETE CASCADE`.

### Entity Relationship

```
users (1) ──── (N) listings
users (1) ──── (1) tenant_profiles
tenant_profiles (1) ──── (N) compatibility_scores ──── (N) listings
listings (1) ──── (N) interests ──── (N) users
interests (1) ──── (N) messages ──── (N) users
```

### Tables

#### `users`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `email` | TEXT | UNIQUE NOT NULL |
| `password_hash` | TEXT | NOT NULL (bcrypt) |
| `role` | TEXT | NOT NULL, CHECK IN ('owner', 'tenant', 'admin') |
| `name` | TEXT | NOT NULL |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `listings`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `owner_id` | INTEGER | NOT NULL, FK → users(id) CASCADE |
| `location` | TEXT | NOT NULL |
| `rent` | REAL | NOT NULL |
| `available_from` | TEXT | NOT NULL |
| `room_type` | TEXT | NOT NULL |
| `furnishing_status` | TEXT | NOT NULL |
| `photos` | TEXT | Comma-separated URLs |
| `is_filled` | INTEGER | DEFAULT 0 (0=available, 1=filled) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `tenant_profiles`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `tenant_id` | INTEGER | UNIQUE NOT NULL, FK → users(id) CASCADE |
| `preferred_location` | TEXT | NOT NULL |
| `budget_range_min` | REAL | NOT NULL |
| `budget_range_max` | REAL | NOT NULL |
| `move_in_date` | TEXT | NOT NULL |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `compatibility_scores`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `listing_id` | INTEGER | NOT NULL, FK → listings(id) CASCADE |
| `tenant_profile_id` | INTEGER | NOT NULL, FK → tenant_profiles(id) CASCADE |
| `score` | INTEGER | NOT NULL (0–100) |
| `explanation` | TEXT | LLM-generated explanation |
| `is_fallback` | INTEGER | DEFAULT 0 (1 = rule-based fallback) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| | | UNIQUE(listing_id, tenant_profile_id) |

#### `interests`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `listing_id` | INTEGER | NOT NULL, FK → listings(id) CASCADE |
| `tenant_id` | INTEGER | NOT NULL, FK → users(id) CASCADE |
| `status` | TEXT | NOT NULL, CHECK IN ('pending', 'accepted', 'declined') |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| | | UNIQUE(listing_id, tenant_id) |

#### `messages`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `interest_id` | INTEGER | NOT NULL, FK → interests(id) CASCADE |
| `sender_id` | INTEGER | NOT NULL, FK → users(id) CASCADE |
| `content` | TEXT | NOT NULL |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

---

## API Documentation

All API endpoints are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, name, role }` | Register a new user. Role: `tenant`, `owner`, or `admin` |
| POST | `/api/auth/login` | `{ email, password }` | Login. Returns JWT `token` and `user` object |
| GET | `/api/auth/me` | — | Get current user profile (includes tenant profile if applicable) |

### Tenant Routes (role: `tenant`)

| Method | Endpoint | Body / Query | Description |
|---|---|---|---|
| POST | `/api/tenant/profile` | `{ preferred_location, budget_range_min, budget_range_max, move_in_date }` | Create or update tenant profile. Invalidates old compatibility scores |
| GET | `/api/tenant/profile` | — | Get own tenant profile |
| GET | `/api/tenant/listings` | `?location=...&maxRent=...` | Browse available listings (not filled), ranked by AI compatibility score |
| POST | `/api/tenant/interest` | `{ listing_id }` | Send interest to an owner's listing |
| GET | `/api/tenant/interests` | — | View own sent interest requests and their statuses |

### Owner Routes (role: `owner`)

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/owner/listings` | `{ location, rent, available_from, room_type, furnishing_status, photos }` | Create a new listing |
| GET | `/api/owner/listings` | — | Get own listings |
| PUT | `/api/owner/listings/:id/filled` | — | Mark a listing as filled (hides from tenant search) |
| GET | `/api/owner/interests` | — | View incoming interest requests |
| PUT | `/api/owner/interests/:id/status` | `{ status }` | Accept or decline an interest. Status: `accepted` or `declined` |

### Admin Routes (role: `admin`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stats` | Platform statistics (users, listings, interests, messages, scores) |
| GET | `/api/admin/users` | List all users |
| DELETE | `/api/admin/users/:id` | Delete a user (cascades to all related data) |
| GET | `/api/admin/listings` | List all listings |
| DELETE | `/api/admin/listings/:id` | Delete a listing |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/chat/:interestId` | Get chat message history for an accepted interest |
| WS | `ws://localhost:3000?token=<jwt>` | WebSocket connection for real-time chat |

**WebSocket Message Format (send):**
```json
{ "interestId": 1, "content": "Hello, is the room still available?" }
```

**WebSocket Message Format (receive):**
```json
{
  "type": "message",
  "data": {
    "id": 5,
    "interest_id": 1,
    "sender_id": 2,
    "content": "Hello, is the room still available?",
    "created_at": "2026-07-02T14:30:00.000Z"
  }
}
```

---

## LLM Prompt & Example I/O

### Prompt Template

```
Given this room listing: {listing_json} and this tenant profile: {profile_json},
compute a compatibility score from 0 to 100 based on budget and location match.
Return JSON only, no extra text: { "score": number, "explanation": "string" }
```

**Model:** Groq `llama-3.1-8b-instant` (free tier)  
**Fallback:** Rule-based scoring if LLM is unavailable

### Example Input

**Listing:**
```json
{
  "id": 1,
  "location": "Mumbai, Andheri West",
  "rent": 15000,
  "room_type": "Private Room",
  "furnishing_status": "Semi-furnished",
  "available_from": "2026-08-01"
}
```

**Tenant Profile:**
```json
{
  "id": 1,
  "preferred_location": "Mumbai, Andheri",
  "budget_range_min": 10000,
  "budget_range_max": 18000,
  "move_in_date": "2026-08-01"
}
```

### Example LLM Output

```json
{
  "score": 92,
  "explanation": "Excellent match. The listing is in Andheri West, Mumbai which closely matches the tenant's preferred location of Andheri, Mumbai. The rent of ₹15,000 falls comfortably within the budget range of ₹10,000–₹18,000. The move-in date also aligns perfectly."
}
```

### Fallback Rule-Based Output (when LLM unavailable)

```json
{
  "score": 75,
  "explanation": "Calculated using rule-based fallback. Location score evaluated based on matching keywords. Budget scored against preferred range $10000-$18000."
}
```

> Scores are stored in the `compatibility_scores` table with an `is_fallback` flag (0 = LLM, 1 = rule-based) and are **not recomputed** on subsequent requests. They are invalidated only when a tenant updates their profile.

---

## Deployment Guide

This monorepo is designed to be deployed as two services: a persistent Node.js backend on **Railway** and a static React frontend on **Vercel**.

### 1. Backend Deployment (Railway)

Since the backend uses a file-based SQLite database and WebSockets, it requires a persistent server environment (not serverless).

1. Go to [Railway](https://railway.app) and sign in.
2. Click **New Project** -> **Deploy from GitHub repo** and select this repository.
3. Once selected, go to the Service settings:
   - **Root Directory**: `backend`
4. Under the **Variables** tab, add the following environment variables:
   - `PORT`: `3000` (Railway will bind this automatically)
   - `JWT_SECRET`: A secure random string
   - `GROQ_API_KEY`: Your Groq API Key
   - `SQLITE_DB_PATH`: `/data/database.sqlite` (Required for persistence)
5. Under the **Volume** tab:
   - Click **Add Volume** to attach a persistent volume to this service.
   - Mount path: `/data` (This ensures your SQLite database file persists across restarts).
6. Enable **Public Networking** to get your public API URL (e.g. `https://your-api.up.railway.app`).

### 2. Frontend Deployment (Vercel)

1. Go to [Vercel](https://vercel.com) and click **Add New** -> **Project**.
2. Import this GitHub repository.
3. In the project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend/rent-flatmate-finder`
4. Under **Environment Variables**, add the API URLs pointing to your Railway backend:
   - `VITE_API_URL`: `https://your-api.up.railway.app/api`
   - `VITE_WS_URL`: `wss://your-api.up.railway.app`
5. Click **Deploy**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8 |
| **Backend** | Node.js, Express 4 |
| **Database** | SQLite 3 (file-based) |
| **Auth** | JWT + bcrypt |
| **LLM** | Groq API (Llama 3.1 8B) |
| **Real-time** | WebSocket (ws library) |
| **Email** | Nodemailer (SMTP or console fallback) |
