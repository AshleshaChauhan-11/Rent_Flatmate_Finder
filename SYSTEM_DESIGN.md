# System Design Write-Up: Rent & Flatmate Finder Platform

## 1. Compatibility Scoring Design

The scoring system evaluates how well a tenant's preferences match a room listing across two dimensions: **location proximity** and **budget fit**.

**Architecture:** The scoring engine follows a compute-once, cache-always pattern. When a tenant browses listings, the system first checks the `compatibility_scores` table for a pre-computed score for that listing–tenant pair. If cached, it is returned immediately without invoking the LLM, reducing API costs and latency. If no score exists, one is computed via the LLM and persisted.

**Score Invalidation:** Scores are invalidated only when a tenant updates their profile. Upon update, all existing scores for that tenant are deleted, forcing fresh recomputation on the next browse. This ensures scores reflect current preferences without recomputing on every page load.

**Ranking:** All non-filled listings matching optional filters (location, max rent) are fetched, scored against the tenant's profile, and sorted descending by compatibility score — most relevant matches first.

**Data Model:** The `compatibility_scores` table stores listing ID, tenant profile ID, score (0–100), explanation, an `is_fallback` flag, and a timestamp. A `UNIQUE(listing_id, tenant_profile_id)` constraint prevents duplicates.

## 2. LLM Integration and Fallback Strategy

**Primary Path — Groq API (Llama 3.1 8B):** The platform uses the Groq inference API with the `llama-3.1-8b-instant` model. The LLM receives a structured prompt containing the listing (location, rent, room type, furnishing) and tenant profile (preferred location, budget range, move-in date), and returns a JSON object with a numeric `score` and `explanation`. The `response_format: { type: 'json_object' }` parameter enforces structured output, eliminating parsing failures.

**Fallback Path — Rule-Based Scoring:** If the API key is missing, the API errors, or parsing fails, the system degrades to a deterministic rule-based scorer. It evaluates location via string comparison (exact = 50 pts, substring = 25 pts, keyword overlap = 15 pts) and budget fit (within range = 50 pts, within 20% tolerance = 25 pts). Fallback scores are flagged with `is_fallback = 1`, allowing the admin to track LLM vs. fallback usage.

**Error Isolation:** All LLM calls are wrapped in try-catch. Network failures, timeouts, and malformed responses are logged, and the fallback scorer is invoked, ensuring zero downtime regardless of LLM availability.

## 3. Real-Time Chat Implementation

**Technology:** Chat uses the native `ws` WebSocket library on top of the HTTP server, avoiding Socket.IO overhead while maintaining full-duplex communication.

**Connection Lifecycle:** Clients connect with a JWT token as a query parameter (`ws://host?token=<jwt>`). The server verifies the token and stores authenticated connections in an in-memory `Map<userId, WebSocket>` for O(1) recipient lookup.

**Message Flow:** When a user sends a message (`interestId` + `content`), the server validates the interest has `accepted` status and the sender is a participant. Valid messages are persisted to the `messages` table, then broadcast to both sender and recipient (if online) as JSON with a `type: 'message'` discriminator.

**History & Cleanup:** A REST endpoint (`GET /api/chat/:interestId`) loads message history for offline messages. On disconnect, the server removes the user from the connections map only if the instance matches, handling reconnection race conditions.

## 4. Notification Flow

**Triggers:** Two email notification events exist:

1. **High-Score Interest Alert (to Owner):** When a tenant sends interest, the system checks the compatibility score. If ≥ 80, an email notifies the owner with the tenant's name, score, and listing location — prioritizing attention toward the best matches.

2. **Interest Status Update (to Tenant):** When an owner accepts or declines, an email informs the tenant of the decision with the property location and owner's name, prompting them to start chatting or continue browsing.

**Transport Architecture:** The email service uses Nodemailer with configurable SMTP. If credentials are provided via environment variables, real emails are sent. If not configured, a mock transport logs emails to the console — allowing developers to verify logic without an external service.

**Error Handling:** Email sending never blocks the parent request. If SMTP fails, the error is logged but the interest or status update completes successfully. Email is a best-effort side effect, not a critical-path operation.
