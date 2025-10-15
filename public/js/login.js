document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = ''; // Clear previous errors

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed.');
        }

        // Store the token and user info
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // *** THE FIX IS HERE ***
        // Check the user's role and redirect to the correct dashboard
        if (data.user.role === 'judge') {
            window.location.href = '/judge-dashboard.html';
        } else { // For 'admin' and 'superadmin'
            window.location.href = '/dashboard.html';
        }

    } catch (error) {
        errorMessage.textContent = error.message;
    }
});