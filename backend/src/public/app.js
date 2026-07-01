const API_BASE = '/api';

class App {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user'));
        this.ws = null;
        this.currentChatInterestId = null;

        this.init();
    }

    async init() {
        if (this.token && this.user) {
            // Verify token / refresh profile
            try {
                const res = await this.api('/auth/me');
                this.user = res;
                localStorage.setItem('user', JSON.stringify(res));
                this.renderNav();
                this.routeDashboard();
            } catch (err) {
                this.logout();
            }
        } else {
            this.renderNav();
            this.renderAuth();
        }
    }

    async api(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers }
        });
        
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'API Error');
        return data;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.getElementById('toast-container').appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    renderNav() {
        const links = document.getElementById('nav-links');
        if (this.user) {
            links.innerHTML = `
                <span class="mr-4 text-muted">Hi, ${this.user.name}</span>
                <button class="btn-secondary" onclick="app.logout()">Logout</button>
            `;
        } else {
            links.innerHTML = '';
        }
        lucide.createIcons();
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.renderNav();
        this.renderAuth();
    }

    // --- Routing ---

    routeDashboard() {
        if (this.user.role === 'tenant') this.renderTenantDash();
        else if (this.user.role === 'owner') this.renderOwnerDash();
        else if (this.user.role === 'admin') this.renderAdminDash();
    }

    // --- Auth View ---

    renderAuth() {
        const root = document.getElementById('app-root');
        const tpl = document.getElementById('tpl-auth').content.cloneNode(true);
        root.innerHTML = '';
        root.appendChild(tpl);
        this.toggleAuthMode('login');
    }

    toggleAuthMode(mode) {
        this.authMode = mode;
        const form = document.getElementById('auth-form');
        const regFields = document.getElementById('register-fields');
        const title = document.getElementById('auth-title');
        const btn = document.getElementById('auth-submit');
        const tabs = document.querySelectorAll('.auth-tabs button');
        
        tabs.forEach(t => t.classList.remove('active'));
        
        if (mode === 'register') {
            regFields.style.display = 'block';
            title.textContent = 'Create an Account';
            btn.textContent = 'Register';
            tabs[1].classList.add('active');
        } else {
            regFields.style.display = 'none';
            title.textContent = 'Welcome Back';
            btn.textContent = 'Login';
            tabs[0].classList.add('active');
        }
    }

    async handleAuth(e) {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;

        try {
            if (this.authMode === 'register') {
                const name = document.getElementById('auth-name').value;
                const role = document.getElementById('auth-role').value;
                await this.api('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ email, password, name, role })
                });
                this.showToast('Registration successful! Please login.', 'success');
                this.toggleAuthMode('login');
            } else {
                const res = await this.api('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                this.token = res.token;
                this.user = res.user;
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                this.init(); // re-init to fetch full profile and route
            }
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // --- Tenant Dashboard ---

    renderTenantDash() {
        const root = document.getElementById('app-root');
        const tpl = document.getElementById('tpl-tenant-dash').content.cloneNode(true);
        root.innerHTML = '';
        root.appendChild(tpl);
        lucide.createIcons();
        this.loadTenantListings();
        this.initWebSocket();
    }

    switchTenantTab(tab, btn) {
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (tab === 'listings') this.loadTenantListings();
        else this.loadTenantInterests();
    }

    async loadTenantListings() {
        const area = document.getElementById('tenant-content-area');
        area.innerHTML = '<p>Loading...</p>';
        try {
            const listings = await this.api('/tenant/listings');
            if (listings.length === 0) {
                area.innerHTML = '<p>No listings found.</p>';
                return;
            }
            
            let html = '<div class="grid-cards">';
            listings.forEach(l => {
                const c = l.compatibility;
                html += `
                    <div class="card glass-panel">
                        <div class="flex justify-between items-start">
                            <h3>${l.location}</h3>
                            <span class="badge badge-score">${c.score}% Match</span>
                        </div>
                        <p class="text-xl font-bold text-primary">$${l.rent}/mo</p>
                        <p class="text-sm text-muted">${l.room_type} • ${l.furnishing_status}</p>
                        <p class="text-sm">Available: ${l.available_from}</p>
                        <div class="mt-2 text-xs text-muted">
                            <strong>AI Note:</strong> ${c.explanation}
                        </div>
                        <button class="btn-primary mt-2" onclick="app.sendInterest(${l.id})">Express Interest</button>
                    </div>
                `;
            });
            html += '</div>';
            area.innerHTML = html;
        } catch (err) {
            area.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }

    async loadTenantInterests() {
        const area = document.getElementById('tenant-content-area');
        area.innerHTML = '<p>Loading...</p>';
        try {
            const interests = await this.api('/tenant/interests');
            if (interests.length === 0) {
                area.innerHTML = '<p>No interests sent yet.</p>';
                return;
            }
            
            let html = '<div class="grid-cards">';
            interests.forEach(i => {
                html += `
                    <div class="card glass-panel">
                        <h3>${i.location}</h3>
                        <p>Owner: ${i.owner_name}</p>
                        <p>Rent: $${i.rent}</p>
                        <p>Status: <span class="badge badge-status-${i.status}">${i.status.toUpperCase()}</span></p>
                        ${i.status === 'accepted' ? `<button class="btn-secondary mt-2" onclick="app.openChat(${i.id})"><i data-lucide="message-square"></i> Chat</button>` : ''}
                    </div>
                `;
            });
            html += '</div>';
            area.innerHTML = html;
            lucide.createIcons();
        } catch (err) {
            area.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }

    async sendInterest(listingId) {
        try {
            await this.api('/tenant/interest', {
                method: 'POST',
                body: JSON.stringify({ listing_id: listingId })
            });
            this.showToast('Interest sent successfully!', 'success');
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // --- Profile Modal ---
    
    showProfileModal() {
        document.getElementById('profile-modal').classList.remove('hidden');
        if (this.user.profile) {
            document.getElementById('prof-location').value = this.user.profile.preferred_location;
            document.getElementById('prof-min').value = this.user.profile.budget_range_min;
            document.getElementById('prof-max').value = this.user.profile.budget_range_max;
            document.getElementById('prof-date').value = this.user.profile.move_in_date;
        }
    }

    async saveProfile(e) {
        e.preventDefault();
        const profile = {
            preferred_location: document.getElementById('prof-location').value,
            budget_range_min: document.getElementById('prof-min').value,
            budget_range_max: document.getElementById('prof-max').value,
            move_in_date: document.getElementById('prof-date').value
        };

        try {
            await this.api('/tenant/profile', {
                method: 'POST',
                body: JSON.stringify(profile)
            });
            this.showToast('Profile saved!', 'success');
            this.closeModal('profile-modal');
            this.init(); // reload user data
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // --- Owner Dashboard ---

    renderOwnerDash() {
        const root = document.getElementById('app-root');
        const tpl = document.getElementById('tpl-owner-dash').content.cloneNode(true);
        root.innerHTML = '';
        root.appendChild(tpl);
        lucide.createIcons();
        this.loadOwnerListings();
        this.initWebSocket();
    }

    switchOwnerTab(tab, btn) {
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (tab === 'listings') this.loadOwnerListings();
        else this.loadOwnerInterests();
    }

    async loadOwnerListings() {
        const area = document.getElementById('owner-content-area');
        area.innerHTML = '<p>Loading...</p>';
        try {
            const listings = await this.api('/owner/listings');
            if (listings.length === 0) {
                area.innerHTML = '<p>No listings created yet.</p>';
                return;
            }
            
            let html = '<div class="grid-cards">';
            listings.forEach(l => {
                html += `
                    <div class="card glass-panel">
                        <div class="flex justify-between items-start">
                            <h3>${l.location}</h3>
                            ${l.is_filled ? '<span class="badge">Filled</span>' : '<span class="badge badge-status-accepted">Active</span>'}
                        </div>
                        <p class="text-xl font-bold text-primary">$${l.rent}/mo</p>
                        <p class="text-sm text-muted">${l.room_type} • ${l.furnishing_status}</p>
                        ${!l.is_filled ? `<button class="btn-secondary mt-2 text-sm" onclick="app.markFilled(${l.id})">Mark as Filled</button>` : ''}
                    </div>
                `;
            });
            html += '</div>';
            area.innerHTML = html;
        } catch (err) {
            area.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }

    async loadOwnerInterests() {
        const area = document.getElementById('owner-content-area');
        area.innerHTML = '<p>Loading...</p>';
        try {
            const interests = await this.api('/owner/interests');
            if (interests.length === 0) {
                area.innerHTML = '<p>No interest requests yet.</p>';
                return;
            }
            
            let html = '<div class="grid-cards">';
            interests.forEach(i => {
                html += `
                    <div class="card glass-panel">
                        <div class="flex justify-between">
                            <h3>${i.location}</h3>
                            <span class="badge badge-status-${i.status}">${i.status.toUpperCase()}</span>
                        </div>
                        <p>Tenant: ${i.tenant_name}</p>
                        <p class="text-sm text-muted">${i.tenant_email}</p>
                        
                        ${i.status === 'pending' ? `
                            <div class="flex gap-2 mt-2">
                                <button class="btn-primary w-full" onclick="app.updateInterest(${i.id}, 'accepted')">Accept</button>
                                <button class="btn-secondary w-full" onclick="app.updateInterest(${i.id}, 'declined')">Decline</button>
                            </div>
                        ` : ''}
                        
                        ${i.status === 'accepted' ? `<button class="btn-secondary mt-2" onclick="app.openChat(${i.id})"><i data-lucide="message-square"></i> Chat</button>` : ''}
                    </div>
                `;
            });
            html += '</div>';
            area.innerHTML = html;
            lucide.createIcons();
        } catch (err) {
            area.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }

    async markFilled(id) {
        try {
            await this.api(`/owner/listings/${id}/filled`, { method: 'PUT' });
            this.showToast('Listing marked as filled', 'success');
            this.loadOwnerListings();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    async updateInterest(id, status) {
        try {
            await this.api(`/owner/interests/${id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            this.showToast(`Interest ${status}`, 'success');
            this.loadOwnerInterests();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // --- Listing Modal ---

    showListingModal() {
        document.getElementById('listing-modal').classList.remove('hidden');
    }

    async saveListing(e) {
        e.preventDefault();
        const payload = {
            location: document.getElementById('list-location').value,
            rent: parseFloat(document.getElementById('list-rent').value),
            available_from: document.getElementById('list-date').value,
            room_type: document.getElementById('list-type').value,
            furnishing_status: document.getElementById('list-furnish').value
        };

        try {
            await this.api('/owner/listings', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            this.showToast('Listing posted!', 'success');
            this.closeModal('listing-modal');
            this.loadOwnerListings();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    }

    // --- Admin Dashboard ---

    renderAdminDash() {
        const root = document.getElementById('app-root');
        const tpl = document.getElementById('tpl-admin-dash').content.cloneNode(true);
        root.innerHTML = '';
        root.appendChild(tpl);
        this.loadAdminStats();
        this.loadAdminUsers();
    }

    async loadAdminStats() {
        try {
            const stats = await this.api('/admin/stats');
            document.getElementById('admin-stats').innerHTML = `
                <div class="stat-card glass-panel"><h3>${stats.users}</h3><p>Total Users</p></div>
                <div class="stat-card glass-panel"><h3>${stats.listings}</h3><p>Listings</p></div>
                <div class="stat-card glass-panel"><h3>${stats.interests}</h3><p>Interests</p></div>
                <div class="stat-card glass-panel"><h3>${stats.messages}</h3><p>Chat Messages</p></div>
                <div class="stat-card glass-panel"><h3>${stats.scores}</h3><p>Scores Computed</p></div>
                <div class="stat-card glass-panel"><h3>${stats.fallbackScores}</h3><p>Fallback Executed</p></div>
            `;
        } catch(err) {
            console.error(err);
        }
    }

    switchAdminTab(tab, btn) {
        document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (tab === 'users') this.loadAdminUsers();
        else this.loadAdminListings();
    }

    async loadAdminUsers() {
        const area = document.getElementById('admin-content-area');
        try {
            const users = await this.api('/admin/users');
            let html = '<div class="glass-panel" style="padding:1rem"><table width="100%" style="text-align:left; border-collapse:collapse;"><tr><th>ID</th><th>Name</th><th>Role</th><th>Email</th><th>Action</th></tr>';
            users.forEach(u => {
                html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.1)"><td style="padding:0.5rem">${u.id}</td><td>${u.name}</td><td>${u.role}</td><td>${u.email}</td><td><button class="btn-icon" onclick="app.deleteUser(${u.id})"><i data-lucide="trash" class="text-danger"></i></button></td></tr>`;
            });
            html += '</table></div>';
            area.innerHTML = html;
            lucide.createIcons();
        } catch(err) {
            area.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }

    async loadAdminListings() {
        const area = document.getElementById('admin-content-area');
        try {
            const listings = await this.api('/admin/listings');
            let html = '<div class="glass-panel" style="padding:1rem"><table width="100%" style="text-align:left; border-collapse:collapse;"><tr><th>ID</th><th>Location</th><th>Rent</th><th>Filled</th><th>Action</th></tr>';
            listings.forEach(l => {
                html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.1)"><td style="padding:0.5rem">${l.id}</td><td>${l.location}</td><td>$${l.rent}</td><td>${l.is_filled}</td><td><button class="btn-icon" onclick="app.deleteListing(${l.id})"><i data-lucide="trash" class="text-danger"></i></button></td></tr>`;
            });
            html += '</table></div>';
            area.innerHTML = html;
            lucide.createIcons();
        } catch(err) {
            area.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }

    async deleteUser(id) {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await this.api(`/admin/users/${id}`, { method: 'DELETE' });
            this.showToast('User deleted', 'success');
            this.loadAdminUsers();
            this.loadAdminStats();
        } catch(err) {
            this.showToast(err.message, 'error');
        }
    }

    async deleteListing(id) {
        if (!confirm('Are you sure you want to delete this listing?')) return;
        try {
            await this.api(`/admin/listings/${id}`, { method: 'DELETE' });
            this.showToast('Listing deleted', 'success');
            this.loadAdminListings();
            this.loadAdminStats();
        } catch(err) {
            this.showToast(err.message, 'error');
        }
    }

    // --- Chat ---
    
    initWebSocket() {
        if (this.ws) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${this.token}`);
        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.error) {
                console.error('WS Error:', msg.error);
                return;
            }
            if (msg.type === 'message' && this.currentChatInterestId === msg.data.interest_id) {
                this.renderMessage(msg.data);
            }
        };
        this.ws.onclose = () => {
            console.log('WS connection closed. Reconnecting in 5s...');
            setTimeout(() => { this.ws = null; this.initWebSocket(); }, 5000);
        };
    }

    async openChat(interestId) {
        this.currentChatInterestId = interestId;
        document.getElementById('chat-modal').classList.remove('hidden');
        const container = document.getElementById('chat-messages');
        container.innerHTML = '<p>Loading chat...</p>';

        try {
            const messages = await this.api(`/chat/${interestId}`);
            container.innerHTML = '';
            messages.forEach(m => this.renderMessage(m));
            this.scrollToBottom();
        } catch (err) {
            container.innerHTML = `<p class="text-danger">${err.message}</p>`;
        }
    }

    closeChat() {
        document.getElementById('chat-modal').classList.add('hidden');
        this.currentChatInterestId = null;
    }

    sendChatMessage(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input-text');
        const content = input.value.trim();
        if (!content || !this.currentChatInterestId || !this.ws) return;

        this.ws.send(JSON.stringify({
            interestId: this.currentChatInterestId,
            content
        }));
        input.value = '';
    }

    renderMessage(msg) {
        const container = document.getElementById('chat-messages');
        const isMine = msg.sender_id === this.user.id;
        const div = document.createElement('div');
        div.className = `msg ${isMine ? 'msg-mine' : 'msg-theirs'}`;
        div.textContent = msg.content;
        container.appendChild(div);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const container = document.getElementById('chat-messages');
        container.scrollTop = container.scrollHeight;
    }

    closeModal(id) {
        document.getElementById(id).classList.add('hidden');
    }
}

const app = new App();
