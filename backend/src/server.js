require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

const db = require('./config/db'); // Initialize DB
const { authenticateToken, authorizeRoles } = require('./middleware/authMiddleware');

const authController = require('./controllers/authController');
const tenantController = require('./controllers/tenantController');
const listingController = require('./controllers/listingController');
const interestController = require('./controllers/interestController');
const adminController = require('./controllers/adminController');
const chatController = require('./controllers/chatController');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==== REST API ROUTES ====

// Auth
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', authenticateToken, authController.getProfile);

// Tenant
app.post('/api/tenant/profile', authenticateToken, authorizeRoles('tenant'), tenantController.upsertProfile);
app.get('/api/tenant/profile', authenticateToken, authorizeRoles('tenant'), tenantController.getProfile);
app.get('/api/tenant/listings', authenticateToken, authorizeRoles('tenant'), listingController.getTenantListings);
app.get('/api/tenant/interests', authenticateToken, authorizeRoles('tenant'), interestController.getTenantInterests);
app.post('/api/tenant/interest', authenticateToken, authorizeRoles('tenant'), interestController.sendInterest);

// Owner
app.post('/api/owner/listings', authenticateToken, authorizeRoles('owner'), listingController.createListing);
app.get('/api/owner/listings', authenticateToken, authorizeRoles('owner'), listingController.getOwnerListings);
app.put('/api/owner/listings/:id/filled', authenticateToken, authorizeRoles('owner'), listingController.markAsFilled);
app.get('/api/owner/interests', authenticateToken, authorizeRoles('owner'), interestController.getOwnerInterests);
app.put('/api/owner/interests/:id/status', authenticateToken, authorizeRoles('owner'), interestController.updateInterestStatus);

// Admin
app.get('/api/admin/stats', authenticateToken, authorizeRoles('admin'), adminController.getStats);
app.get('/api/admin/users', authenticateToken, authorizeRoles('admin'), adminController.getUsers);
app.delete('/api/admin/users/:id', authenticateToken, authorizeRoles('admin'), adminController.deleteUser);
app.get('/api/admin/listings', authenticateToken, authorizeRoles('admin'), adminController.getListings);
app.delete('/api/admin/listings/:id', authenticateToken, authorizeRoles('admin'), adminController.deleteListing);

// Chat
app.get('/api/chat/:interestId', authenticateToken, chatController.getChatMessages);

// ==== WEBSOCKET SERVER ====
const activeConnections = new Map(); // map userId -> ws

wss.on('connection', (ws, req) => {
    try {
        const url = new URL(req.url || '', 'http://localhost');
        const token = url.searchParams.get('token');

        if (!token) {
            ws.close(1008, 'Token missing');
            return;
        }

        const user = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkeychangeinprod');
        ws.userId = user.id;
        activeConnections.set(user.id, ws);

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);
                // data: { interestId, content }
                
                // Verify interest is accepted and user belongs to it
                const interest = await db.getAsync(`
                    SELECT i.*, l.owner_id 
                    FROM interests i 
                    JOIN listings l ON i.listing_id = l.id 
                    WHERE i.id = ? AND i.status = 'accepted'
                `, [data.interestId]);

                if (!interest || (interest.tenant_id !== user.id && interest.owner_id !== user.id)) {
                    ws.send(JSON.stringify({ error: 'Unauthorized or invalid chat' }));
                    return;
                }

                // Save message
                const result = await db.runAsync(
                    'INSERT INTO messages (interest_id, sender_id, content) VALUES (?, ?, ?)',
                    [data.interestId, user.id, data.content]
                );

                const msgResponse = {
                    id: result.lastID,
                    interest_id: data.interestId,
                    sender_id: user.id,
                    content: data.content,
                    created_at: new Date().toISOString()
                };

                // Send to sender
                ws.send(JSON.stringify({ type: 'message', data: msgResponse }));

                // Send to recipient
                const recipientId = (interest.tenant_id === user.id) ? interest.owner_id : interest.tenant_id;
                const recipientWs = activeConnections.get(recipientId);
                if (recipientWs && recipientWs.readyState === 1) { // 1 = OPEN
                    recipientWs.send(JSON.stringify({ type: 'message', data: msgResponse }));
                }

            } catch (err) {
                console.error('WS Message Error', err);
            }
        });

        ws.on('close', () => {
            if (activeConnections.get(user.id) === ws) {
                activeConnections.delete(user.id);
            }
        });

    } catch (err) {
        ws.close(1008, 'Invalid token or connection error');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
