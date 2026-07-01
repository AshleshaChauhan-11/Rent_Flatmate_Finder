const http = require('http');

async function runTests() {
    console.log('Starting integration tests...');

    // We will start the server locally by requiring it.
    // However, our server.js calls server.listen() directly.
    // To avoid port conflicts or hanging the test script, we can just spawn it as a child process.
    const { spawn } = require('child_process');
    const path = require('path');
    
    // ensure database exists and is seeded by running it
    const serverProcess = spawn('node', [path.join(__dirname, 'src/server.js')], { stdio: 'inherit' });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        console.log('\n--- 1. Testing Registration ---');
        // Register Owner
        let res = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'owner1@test.com', password: 'pass', name: 'Owner 1', role: 'owner' })
        });
        console.log('Register Owner:', res.status, await res.text());

        // Register Tenant
        res = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'tenant1@test.com', password: 'pass', name: 'Tenant 1', role: 'tenant' })
        });
        console.log('Register Tenant:', res.status, await res.text());

        console.log('\n--- 2. Testing Login ---');
        // Login Owner
        res = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'owner1@test.com', password: 'pass' })
        });
        let data = await res.json();
        const ownerToken = data.token;
        console.log('Owner Token length:', ownerToken ? ownerToken.length : 'Fail');

        // Login Tenant
        res = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'tenant1@test.com', password: 'pass' })
        });
        data = await res.json();
        const tenantToken = data.token;
        console.log('Tenant Token length:', tenantToken ? tenantToken.length : 'Fail');

        console.log('\n--- 3. Testing Tenant Profile Creation ---');
        res = await fetch('http://localhost:3000/api/tenant/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tenantToken}` },
            body: JSON.stringify({ preferred_location: 'New York', budget_range_min: 1000, budget_range_max: 2000, move_in_date: '2026-08-01' })
        });
        console.log('Create Profile:', res.status, await res.text());

        console.log('\n--- 4. Testing Owner Listing Creation ---');
        res = await fetch('http://localhost:3000/api/owner/listings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
            body: JSON.stringify({ location: 'New York', rent: 1500, available_from: '2026-08-01', room_type: 'Private Room', furnishing_status: 'Furnished' })
        });
        data = await res.json();
        const listingId = data.listingId;
        console.log('Create Listing:', res.status, 'ID:', listingId);

        console.log('\n--- 5. Testing Tenant Browse Listings (triggers AI/Fallback Scoring) ---');
        res = await fetch('http://localhost:3000/api/tenant/listings', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tenantToken}` }
        });
        data = await res.json();
        console.log('Scored Listings found:', data.length);
        if (data.length > 0) {
            console.log('Top Match Score:', data[0].compatibility.score);
            console.log('Explanation:', data[0].compatibility.explanation);
        }

        console.log('\n--- 6. Testing Tenant Sending Interest ---');
        res = await fetch('http://localhost:3000/api/tenant/interest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tenantToken}` },
            body: JSON.stringify({ listing_id: listingId })
        });
        data = await res.json();
        const interestId = data.interestId;
        console.log('Send Interest:', res.status, 'Interest ID:', interestId);

        console.log('\n--- 7. Testing Owner Accepting Interest ---');
        res = await fetch(`http://localhost:3000/api/owner/interests/${interestId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ownerToken}` },
            body: JSON.stringify({ status: 'accepted' })
        });
        console.log('Accept Interest:', res.status, await res.text());

        console.log('\n--- 8. Testing Admin Stats ---');
        // Login Admin
        res = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@flatmatefinder.com', password: 'admin123' })
        });
        const adminToken = (await res.json()).token;

        res = await fetch('http://localhost:3000/api/admin/stats', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log('Admin Stats:', res.status, await res.json());

        console.log('\nTests Completed Successfully.');

    } catch (e) {
        console.error('Test Error:', e);
    } finally {
        serverProcess.kill();
        process.exit(0);
    }
}

runTests();
