/* =================================================== */
/* FILE: public/js/session-tracker.js (MODIFIED)     */
/* This script now creates a GLOBAL socket connection  */
/* for all other scripts on the page to use.         */
/* =================================================== */

(function() {
    // Check if a socket connection already exists to prevent duplicates
    if (window.socket) {
        return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
        return; // Don't connect if the user isn't logged in
    }

    // Create the socket and attach it to the global window object
    window.socket = io();

    // As soon as the connection is established, authenticate this client
    window.socket.on('connect', () => {
        console.log('✅ Global socket connected. Authenticating...');
        window.socket.emit('client_auth', token);
    });

    // Optional: Add a listener for disconnects for debugging
    window.socket.on('disconnect', () => {
        console.log('⚠️ Global socket disconnected.');
    });

    // --- FIX: Listen for the force_logout event from the server ---
    window.socket.on('force_logout', () => {
        alert("This account has been signed in from another device or location. You have been logged out.");
        localStorage.clear();
        window.location.href = '/login.html';
    });
})();