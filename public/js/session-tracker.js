/* =================================================== */
/* FILE: public/js/session-tracker.js (NEW FILE)     */
/* This script's only job is to report user activity */
/* to the real-time monitoring system.               */
/* =================================================== */

(function() {
    // Check if a token exists before trying to connect
    const token = localStorage.getItem('authToken');
    if (!token) {
        return; // Don't do anything if the user isn't logged in
    }

    // Connect to the Socket.IO server
    const socket = io();

    // As soon as the connection is established, authenticate this client
    socket.on('connect', () => {
        socket.emit('client_auth', token);
    });

    // We don't need any other listeners here. This script is for reporting only.
    // The connection will automatically be closed when the user navigates away or closes the tab.
})();