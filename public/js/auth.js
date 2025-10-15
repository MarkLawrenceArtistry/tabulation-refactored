// This script will run on every protected page
(function() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        // If no token, redirect to login page
        console.log("No token found, redirecting to login.");
        window.location.href = '/login.html';
    }
    // If there's a token, we assume it's valid for now.
    // The server will validate it on every API call.
})();