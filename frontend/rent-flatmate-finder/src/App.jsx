import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = 'http://localhost:3000/api';
const WS_BASE = 'ws://localhost:3000';

function App() {
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Auth State
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // login / register
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('tenant');

  // Navigation
  const [activeTab, setActiveTab] = useState('');

  // Tenant Workspaces State
  const [tenantProfile, setTenantProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [tenantInterests, setTenantInterests] = useState([]);
  // Profile edit fields
  const [prefLocation, setPrefLocation] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  // Browsing filters
  const [filterLoc, setFilterLoc] = useState('');
  const [filterBudget, setFilterBudget] = useState('');

  // Owner Workspaces State
  const [ownerListings, setOwnerListings] = useState([]);
  const [ownerInterests, setOwnerInterests] = useState([]);
  // New listing fields
  const [listLoc, setListLoc] = useState('');
  const [listRent, setListRent] = useState('');
  const [listAvailable, setListAvailable] = useState('');
  const [listRoomType, setListRoomType] = useState('Private Room');
  const [listFurnish, setListFurnish] = useState('Furnished');
  const [listPhoto, setListPhoto] = useState('');

  // Admin Workspace State
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminListings, setAdminListings] = useState([]);

  // Chat State
  const [activeChat, setActiveChat] = useState(null); // { interestId, recipientName, recipientRole, listingLoc }
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const wsRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Initialize Dark Mode from body class
  useEffect(() => {
    const isDark = document.body.classList.contains('theme-dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
  };

  // Fetch current user details
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchUserProfile();
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  const showErr = (msg) => {
    setErrorMsg(msg);
    setSuccessMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setErrorMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchUserProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        setToken('');
        return;
      }
      const data = await res.json();
      setUser(data);
      // Set default tab based on role
      if (data.role === 'tenant') {
        setActiveTab(data.profile ? 'browse' : 'profile');
        setTenantProfile(data.profile);
        if (data.profile) {
          setPrefLocation(data.profile.preferred_location);
          setBudgetMin(data.profile.budget_range_min.toString());
          setBudgetMax(data.profile.budget_range_max.toString());
          setMoveInDate(data.profile.move_in_date);
          fetchTenantListings(token);
        }
        fetchTenantInterests(token);
      } else if (data.role === 'owner') {
        setActiveTab('listings');
        fetchOwnerListings(token);
        fetchOwnerInterests(token);
      } else if (data.role === 'admin') {
        setActiveTab('stats');
        fetchAdminData(token);
      }
    } catch (e) {
      console.error(e);
      setToken('');
    }
  };

  // --- Auth Handlers ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return showErr('Please enter both email and password.');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) return showErr(data.error || 'Login failed');
      setToken(data.token);
      showSuccess(`Welcome back, ${data.user.name}!`);
    } catch (err) {
      showErr('Network error. Failed to connect to server.');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regName || !regRole) {
      return showErr('All registration fields are required.');
    }
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, password: regPassword, name: regName, role: regRole })
      });
      const data = await res.json();
      if (!res.ok) return showErr(data.error || 'Registration failed');
      
      // Auto login after registration
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, password: regPassword })
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        setToken(loginData.token);
        showSuccess('Account registered successfully!');
      } else {
        setAuthMode('login');
        showSuccess('Registration complete. Please log in.');
      }
    } catch (err) {
      showErr('Network error. Failed to register.');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setTenantProfile(null);
    setListings([]);
    setTenantInterests([]);
    setOwnerListings([]);
    setOwnerInterests([]);
    setAdminStats(null);
    setAdminUsers([]);
    setAdminListings([]);
    if (wsRef.current) wsRef.current.close();
    setActiveChat(null);
    showSuccess('Logged out successfully.');
  };

  // --- Tenant Handlers ---
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!prefLocation || !budgetMin || !budgetMax || !moveInDate) {
      return showErr('Please fill out all profile fields.');
    }
    try {
      const res = await fetch(`${API_BASE}/tenant/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          preferred_location: prefLocation,
          budget_range_min: parseFloat(budgetMin),
          budget_range_max: parseFloat(budgetMax),
          move_in_date: moveInDate
        })
      });
      const data = await res.json();
      if (!res.ok) return showErr(data.error || 'Failed to save profile');
      showSuccess('Profile updated successfully.');
      fetchUserProfile(); // Reload profile
    } catch (e) {
      showErr('Database error saving profile.');
    }
  };

  const fetchTenantListings = async (authToken, loc = '', budget = '') => {
    try {
      let url = `${API_BASE}/tenant/listings`;
      const params = [];
      if (loc) params.push(`location=${encodeURIComponent(loc)}`);
      if (budget) params.push(`maxRent=${encodeURIComponent(budget)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTenantInterests = async (authToken) => {
    try {
      const res = await fetch(`${API_BASE}/tenant/interests`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTenantInterests(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendInterest = async (listingId) => {
    try {
      const res = await fetch(`${API_BASE}/tenant/interest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ listing_id: listingId })
      });
      const data = await res.json();
      if (!res.ok) return showErr(data.error || 'Failed to send interest request');
      showSuccess('Interest expressed! Owner will be notified.');
      fetchTenantInterests(token);
      fetchTenantListings(token, filterLoc, filterBudget);
    } catch (err) {
      showErr('Network error sending interest request.');
    }
  };

  const applyTenantFilters = (e) => {
    e.preventDefault();
    fetchTenantListings(token, filterLoc, filterBudget);
  };

  // --- Owner Handlers ---
  const fetchOwnerListings = async (authToken) => {
    try {
      const res = await fetch(`${API_BASE}/owner/listings`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOwnerListings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOwnerInterests = async (authToken) => {
    try {
      const res = await fetch(`${API_BASE}/owner/interests`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOwnerInterests(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!listLoc || !listRent || !listAvailable) {
      return showErr('Location, Rent and Available Date are required.');
    }
    try {
      const res = await fetch(`${API_BASE}/owner/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          location: listLoc,
          rent: parseFloat(listRent),
          available_from: listAvailable,
          room_type: listRoomType,
          furnishing_status: listFurnish,
          photos: listPhoto
        })
      });
      const data = await res.json();
      if (!res.ok) return showErr(data.error || 'Failed to create listing');
      showSuccess('Listing posted successfully!');
      setListLoc('');
      setListRent('');
      setListAvailable('');
      setListPhoto('');
      fetchOwnerListings(token);
    } catch (err) {
      showErr('Network error posting listing.');
    }
  };

  const handleMarkFilled = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/owner/listings/${id}/filled`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showSuccess('Listing marked as filled and hidden from search.');
        fetchOwnerListings(token);
      }
    } catch (err) {
      showErr('Error marking listing as filled.');
    }
  };

  const handleInterestStatus = async (interestId, status) => {
    try {
      const res = await fetch(`${API_BASE}/owner/interests/${interestId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showSuccess(`Interest request ${status}.`);
        fetchOwnerInterests(token);
      } else {
        const data = await res.json();
        showErr(data.error || 'Failed to update interest request status');
      }
    } catch (err) {
      showErr('Error updating interest status.');
    }
  };

  // --- Admin Handlers ---
  const fetchAdminData = async (authToken) => {
    try {
      // stats
      let res = await fetch(`${API_BASE}/admin/stats`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) setAdminStats(await res.json());

      // users
      res = await fetch(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) setAdminUsers(await res.json());

      // listings
      res = await fetch(`${API_BASE}/admin/listings`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) setAdminListings(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user? This will delete all their listings, profiles, and chats.')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showSuccess('User deleted successfully.');
        fetchAdminData(token);
      }
    } catch (err) {
      showErr('Error deleting user.');
    }
  };

  const handleDeleteListing = async (id) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/listings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showSuccess('Listing deleted successfully.');
        fetchAdminData(token);
      }
    } catch (err) {
      showErr('Error deleting listing.');
    }
  };

  // --- Real-time WebSocket Chat Handlers ---
  const startChat = async (interestId, recipientName, recipientRole, listingLoc) => {
    setActiveChat({ interestId, recipientName, recipientRole, listingLoc });
    setChatMessages([]);

    try {
      // 1. Fetch message history
      const res = await fetch(`${API_BASE}/chat/${interestId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setChatMessages(await res.json());
      }
      
      // 2. Setup WebSocket Connection
      if (wsRef.current) wsRef.current.close();
      
      const wsUrl = `${WS_BASE}/?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'message') {
            const newMsg = payload.data;
            if (newMsg.interest_id === interestId) {
              setChatMessages((prev) => [...prev, newMsg]);
            }
          }
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      ws.onclose = () => {
        console.log('WS connection closed.');
      };

    } catch (err) {
      console.error('Error starting chat session:', err);
    }
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const payload = {
      interestId: activeChat.interestId,
      content: chatInput.trim()
    };
    wsRef.current.send(JSON.stringify(payload));
    setChatInput('');
  };

  const closeChat = () => {
    if (wsRef.current) wsRef.current.close();
    setActiveChat(null);
    setChatMessages([]);
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  return (
    <div className="app-container">
      {/* Navbar */}
      <header className="navbar">
        <a href="#" className="brand" onClick={(e) => e.preventDefault()}>
          <h1>Flatmate Finder</h1>
        </a>
        <div className="nav-user">
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          
          {user && (
            <>
              <span className="user-name">Hey, <strong>{user.name}</strong></span>
              <span className={`role-badge ${user.role}`}>{user.role}</span>
              <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 16px' }} onClick={handleLogout}>Logout</button>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace App Grid */}
      <main className="main-content">
        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="alert alert-danger">
            <span>⚠️</span> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success">
            <span>✅</span> {successMsg}
          </div>
        )}

        {/* Unauthenticated View */}
        {!user && (
          <div className="auth-wrapper">
            <div className="auth-card">
              <div className="auth-header">
                <h2>{authMode === 'login' ? 'Welcome Back' : 'Join Flatmate Finder'}</h2>
                <p>{authMode === 'login' ? 'Log in to connect with flatmates and list rooms.' : 'Create an account to begin matching.'}</p>
              </div>

              {authMode === 'login' ? (
                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="name@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>Log In</button>
                  <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
                    Don't have an account?{' '}
                    <button type="button" className="btn-link" onClick={() => setAuthMode('register')}>Register here</button>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleRegister}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Alex Smith"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="name@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Min 6 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">I am registering as a...</label>
                    <select
                      className="form-select"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                    >
                      <option value="tenant">Tenant (Looking for a room)</option>
                      <option value="owner">Property Owner / Room Lister</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>Create Account</button>
                  <p style={{ marginTop: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
                    Already have an account?{' '}
                    <button type="button" className="btn-link" onClick={() => setAuthMode('login')}>Log in here</button>
                  </p>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Authenticated Workspace */}
        {user && (
          <div>
            {/* Navigation Tabs based on Role */}
            <div className="tab-container">
              {user.role === 'tenant' && (
                <>
                  <button
                    className={`tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('browse'); fetchTenantListings(token, filterLoc, filterBudget); }}
                  >
                    🔍 Find Rooms
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'interests' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('interests'); fetchTenantInterests(token); }}
                  >
                    ❤️ My Expressions
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                    onClick={() => setActiveTab('profile')}
                  >
                    👤 My Profile Preferences
                  </button>
                </>
              )}

              {user.role === 'owner' && (
                <>
                  <button
                    className={`tab-btn ${activeTab === 'listings' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('listings'); fetchOwnerListings(token); }}
                  >
                    🏢 My Room Listings
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'interests' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('interests'); fetchOwnerInterests(token); }}
                  >
                    📩 Incoming Interests
                  </button>
                </>
              )}

              {user.role === 'admin' && (
                <>
                  <button
                    className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('stats'); fetchAdminData(token); }}
                  >
                    📊 Stats Dashboard
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('users'); fetchAdminData(token); }}
                  >
                    👥 Manage Users
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'listings' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('listings'); fetchAdminData(token); }}
                  >
                    🏡 Manage Listings
                  </button>
                </>
              )}
            </div>

            {/* TAB CONTENTS */}

            {/* 1. Tenant Browse Tab */}
            {user.role === 'tenant' && activeTab === 'browse' && (
              <div>
                {!tenantProfile ? (
                  <div className="empty-state">
                    <h3>No Tenant Profile Found</h3>
                    <p style={{ marginBottom: '16px' }}>Please complete your profile configuration first so our AI model can compute compatibility match scores.</p>
                    <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setActiveTab('profile')}>Create Profile Preferences</button>
                  </div>
                ) : (
                  <>
                    <form className="filter-card" onSubmit={applyTenantFilters}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Search Location</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. New York, Brooklyn..."
                          value={filterLoc}
                          onChange={(e) => setFilterLoc(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Max Budget ($)</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="e.g. 2000"
                          value={filterBudget}
                          onChange={(e) => setFilterBudget(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="btn btn-primary">Filter</button>
                    </form>

                    {listings.length === 0 ? (
                      <div className="empty-state">
                        <h3>No listings found</h3>
                        <p>Try resetting or adjusting your search filters.</p>
                      </div>
                    ) : (
                      <div className="listings-grid">
                        {listings.map((l) => {
                          const isHigh = l.compatibility?.score >= 80;
                          const isMedium = l.compatibility?.score >= 50 && l.compatibility?.score < 80;
                          
                          // Check if interest already expressed
                          const matchedInterest = tenantInterests.find((i) => i.location === l.location && i.rent === l.rent);
                          
                          return (
                            <div className="listing-card" key={l.id}>
                              <div className="listing-image-container">
                                {l.photos ? (
                                  <img src={l.photos.split(',')[0]} className="listing-img" alt={l.location} />
                                ) : (
                                  <div className="listing-img-placeholder">
                                    🏡 {l.room_type}
                                  </div>
                                )}
                                <div className="price-tag">${l.rent}/mo</div>
                              </div>
                              <div className="listing-content">
                                <h3 className="listing-title">{l.location}</h3>
                                <div className="listing-details">
                                  <div>🔑 {l.room_type}</div>
                                  <div>🛋️ {l.furnishing_status}</div>
                                  <div>📅 From: {l.available_from}</div>
                                </div>

                                {l.compatibility && (
                                  <div className={`compatibility-box ${isHigh ? 'high' : isMedium ? 'medium' : ''}`}>
                                    <div className="compatibility-header">
                                      <span>AI Match Score:</span>
                                      <span className={`score-badge ${isHigh ? 'high' : isMedium ? 'medium' : 'low'}`}>
                                        {l.compatibility.score}%
                                      </span>
                                    </div>
                                    <p className="compatibility-explanation">"{l.compatibility.explanation}"</p>
                                  </div>
                                )}

                                <div style={{ marginTop: 'auto' }}>
                                  {matchedInterest ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <div style={{ textAlign: 'center' }}>
                                        <span className={`status-pill ${matchedInterest.status}`}>{matchedInterest.status}</span>
                                      </div>
                                      {matchedInterest.status === 'accepted' && (
                                        <button 
                                          className="btn btn-success" 
                                          onClick={() => startChat(matchedInterest.id, matchedInterest.owner_name, 'Owner', l.location)}
                                        >
                                          💬 Chat with Owner
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <button className="btn btn-primary" onClick={() => handleSendInterest(l.id)}>Express Interest</button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 2. Tenant Expressions Tab */}
            {user.role === 'tenant' && activeTab === 'interests' && (
              <div>
                {tenantInterests.length === 0 ? (
                  <div className="empty-state">
                    <h3>No Expressions of Interest Sent</h3>
                    <p>Go to "Find Rooms" to search and express interest in room listings.</p>
                  </div>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Room Location</th>
                          <th>Monthly Rent</th>
                          <th>Owner Name</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenantInterests.map((interest) => (
                          <tr key={interest.id}>
                            <td><strong>{interest.location}</strong></td>
                            <td>${interest.rent}/mo</td>
                            <td>{interest.owner_name}</td>
                            <td>
                              <span className={`status-pill ${interest.status}`}>{interest.status}</span>
                            </td>
                            <td>
                              {interest.status === 'accepted' ? (
                                <button
                                  className="btn btn-success"
                                  style={{ padding: '6px 12px', width: 'auto', fontSize: '13px' }}
                                  onClick={() => startChat(interest.id, interest.owner_name, 'Owner', interest.location)}
                                >
                                  💬 Open Chat
                                </button>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Chat opens upon acceptance</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 3. Tenant Profile Tab */}
            {user.role === 'tenant' && activeTab === 'profile' && (
              <div className="profile-card">
                <h2>Define Roommate Preferences</h2>
                <form onSubmit={handleSaveProfile}>
                  <div className="form-group">
                    <label className="form-label">Preferred Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. New York, Brooklyn, Queens"
                      value={prefLocation}
                      onChange={(e) => setPrefLocation(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Minimum Budget ($)</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="e.g. 500"
                        value={budgetMin}
                        onChange={(e) => setBudgetMin(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Maximum Budget ($)</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="e.g. 2000"
                        value={budgetMax}
                        onChange={(e) => setBudgetMax(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preferred Move-in Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={moveInDate}
                      onChange={(e) => setMoveInDate(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>Save Profile Settings</button>
                </form>
              </div>
            )}

            {/* 4. Owner listings */}
            {user.role === 'owner' && activeTab === 'listings' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
                {/* Form column */}
                <div>
                  <div className="listing-form-card" style={{ width: '100%', maxWidth: 'none' }}>
                    <h2>Create New Room Listing</h2>
                    <form onSubmit={handleCreateListing}>
                      <div className="form-group">
                        <label className="form-label">Location / Address</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. New York, Manhattan"
                          value={listLoc}
                          onChange={(e) => setListLoc(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Monthly Rent ($)</label>
                          <input
                            type="number"
                            className="form-control"
                            placeholder="e.g. 1200"
                            value={listRent}
                            onChange={(e) => setListRent(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Available From</label>
                          <input
                            type="date"
                            className="form-control"
                            value={listAvailable}
                            onChange={(e) => setListAvailable(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Room Type</label>
                          <select
                            className="form-select"
                            value={listRoomType}
                            onChange={(e) => setListRoomType(e.target.value)}
                          >
                            <option value="Private Room">Private Room</option>
                            <option value="Shared Room">Shared Room</option>
                            <option value="Entire Apartment">Entire Apartment</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Furnishing Status</label>
                          <select
                            className="form-select"
                            value={listFurnish}
                            onChange={(e) => setListFurnish(e.target.value)}
                          >
                            <option value="Furnished">Furnished</option>
                            <option value="Semi-Furnished">Semi-Furnished</option>
                            <option value="Unfurnished">Unfurnished</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Photo URLs (comma separated)</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="http://example.com/image.jpg"
                          value={listPhoto}
                          onChange={(e) => setListPhoto(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>Post Listing</button>
                    </form>
                  </div>
                </div>

                {/* List column */}
                <div>
                  <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>My Active Rooms</h2>
                  {ownerListings.length === 0 ? (
                    <div className="empty-state" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                      <h3>No listings posted yet</h3>
                      <p>Use the form on the left to add your first room listing.</p>
                    </div>
                  ) : (
                    <div className="listings-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                      {ownerListings.map((l) => (
                        <div className="listing-card" key={l.id}>
                          <div className="listing-image-container" style={{ height: '140px' }}>
                            {l.photos ? (
                              <img src={l.photos.split(',')[0]} className="listing-img" alt={l.location} />
                            ) : (
                              <div className="listing-img-placeholder" style={{ fontSize: '18px' }}>
                                🏡 {l.room_type}
                              </div>
                            )}
                            <div className="price-tag" style={{ fontSize: '13px', padding: '4px 8px' }}>${l.rent}/mo</div>
                            <span className={`listing-badge ${l.is_filled ? 'filled' : 'active'}`}>
                              {l.is_filled ? 'Filled' : 'Active'}
                            </span>
                          </div>
                          <div className="listing-content" style={{ padding: '16px' }}>
                            <h3 className="listing-title" style={{ fontSize: '16px' }}>{l.location}</h3>
                            <div className="listing-details" style={{ fontSize: '12px', marginBottom: '12px' }}>
                              <div>🔑 {l.room_type}</div>
                              <div>🛋️ {l.furnishing_status}</div>
                            </div>
                            {!l.is_filled && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '13px' }}
                                onClick={() => handleMarkFilled(l.id)}
                              >
                                Mark as Filled
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. Owner Incoming Interests */}
            {user.role === 'owner' && activeTab === 'interests' && (
              <div>
                {ownerInterests.length === 0 ? (
                  <div className="empty-state">
                    <h3>No Incoming Interest Requests</h3>
                    <p>Wait for tenants to view your rooms and show interest.</p>
                  </div>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Listing Location</th>
                          <th>Tenant Name</th>
                          <th>Tenant Email</th>
                          <th>Interest Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ownerInterests.map((interest) => (
                          <tr key={interest.id}>
                            <td><strong>{interest.location}</strong></td>
                            <td>{interest.tenant_name}</td>
                            <td>{interest.tenant_email}</td>
                            <td>
                              <span className={`status-pill ${interest.status}`}>{interest.status}</span>
                            </td>
                            <td>
                              {interest.status === 'pending' ? (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    className="btn btn-success"
                                    style={{ padding: '6px 12px', width: 'auto', fontSize: '13px' }}
                                    onClick={() => handleInterestStatus(interest.id, 'accepted')}
                                  >
                                    Accept
                                  </button>
                                  <button
                                    className="btn btn-danger"
                                    style={{ padding: '6px 12px', width: 'auto', fontSize: '13px' }}
                                    onClick={() => handleInterestStatus(interest.id, 'declined')}
                                  >
                                    Decline
                                  </button>
                                </div>
                              ) : interest.status === 'accepted' ? (
                                <button
                                  className="btn btn-success"
                                  style={{ padding: '6px 12px', width: 'auto', fontSize: '13px' }}
                                  onClick={() => startChat(interest.id, interest.tenant_name, 'Tenant', interest.location)}
                                >
                                  💬 Open Chat
                                </button>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Declined Request</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 6. Admin Stats Tab */}
            {user.role === 'admin' && activeTab === 'stats' && adminStats && (
              <div>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-val">{adminStats.users}</div>
                    <div className="stat-lbl">Total Users</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">{adminStats.owners}</div>
                    <div className="stat-lbl">Owners</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">{adminStats.tenants}</div>
                    <div className="stat-lbl">Tenants</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">{adminStats.listings}</div>
                    <div className="stat-lbl">Listings</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">{adminStats.filledListings}</div>
                    <div className="stat-lbl">Filled Listings</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">{adminStats.interests}</div>
                    <div className="stat-lbl">Interests</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">{adminStats.scores}</div>
                    <div className="stat-lbl">Scored pairs</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val">{adminStats.fallbackScores}</div>
                    <div className="stat-lbl">Fallback Rules</div>
                  </div>
                </div>

                <div className="empty-state" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                  <h3>System Status Online</h3>
                  <p>All core modules (Role authorization, SQLite persistent database, Real-time WebSockets and LLM fallbacks) are functioning normally.</p>
                </div>
              </div>
            )}

            {/* 7. Admin Users Tab */}
            {user.role === 'admin' && activeTab === 'users' && (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((u) => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td><strong>{u.name}</strong></td>
                        <td>{u.email}</td>
                        <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                        <td>
                          {u.role !== 'admin' ? (
                            <button
                              className="btn btn-danger"
                              style={{ padding: '4px 10px', fontSize: '12px', width: 'auto' }}
                              onClick={() => handleDeleteUser(u.id)}
                            >
                              Delete User
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>System Admin (Protected)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 8. Admin Listings Tab */}
            {user.role === 'admin' && activeTab === 'listings' && (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Location</th>
                      <th>Owner ID</th>
                      <th>Rent</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminListings.map((l) => (
                      <tr key={l.id}>
                        <td>#{l.id}</td>
                        <td><strong>{l.location}</strong></td>
                        <td>#{l.owner_id}</td>
                        <td>${l.rent}/mo</td>
                        <td>
                          <span className={`status-pill ${l.is_filled ? 'declined' : 'accepted'}`}>
                            {l.is_filled ? 'Filled' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 10px', fontSize: '12px', width: 'auto' }}
                            onClick={() => handleDeleteListing(l.id)}
                          >
                            Delete Listing
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Real-time Chat Overlay Modal */}
      {activeChat && (
        <div className="chat-overlay">
          <div className="chat-window">
            <div className="chat-header">
              <div className="chat-header-info">
                <h3>Chatting with {activeChat.recipientName} ({activeChat.recipientRole})</h3>
                <p>Listing: {activeChat.listingLoc}</p>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ width: 'auto', padding: '6px 12px' }}
                onClick={closeChat}
              >
                Close ✕
              </button>
            </div>

            <div className="chat-body">
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '14px', marginTop: 'auto', marginBottom: 'auto' }}>
                  No messages yet. Send a message to start the conversation!
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isOutgoing = msg.sender_id === user.id;
                  const messageTime = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                  
                  return (
                    <div className={`chat-msg ${isOutgoing ? 'outgoing' : 'incoming'}`} key={msg.id}>
                      <div>{msg.content}</div>
                      <span className="chat-msg-time">{messageTime}</span>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            <form className="chat-footer" onSubmit={sendChatMessage}>
              <input
                type="text"
                className="chat-input"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary chat-send-btn">Send</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
