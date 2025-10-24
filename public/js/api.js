async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    };

    const options = {
        method,
        headers
    };

    if (body) {
        if (body instanceof FormData) {
            options.body = body;
        } else {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(endpoint, options);

        if (window.hideConnectionError) {
            hideConnectionError();
        }

        // --- FIX: Graceful Logout on Authentication Failure ---
        // If the server rejects the token, clear session and redirect to login.
        if (response.status === 401 || response.status === 403) {
            console.error('Authentication error. Token may be invalid or expired. Logging out.');
            localStorage.clear();
            window.location.href = '/login.html';
            throw new Error('Authentication failed. Redirecting to login page.');
        }

        if (!response.ok) {
            const errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.message || `HTTP error! status: ${response.status}`);
            } catch (e) {
                throw new Error(errorText || `HTTP error! status: ${response.status}`);
            }
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();

    } catch (error) {
        console.error('API Request Error:', error.message);

        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            if (window.showConnectionError) {
                showConnectionError();
            }
        }
        
        throw error;
    }
}