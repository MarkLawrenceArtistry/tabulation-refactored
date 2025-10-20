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

        // --- NEW: If a request succeeds, the connection is back. Hide the banner. ---
        if (window.hideConnectionError) {
            hideConnectionError();
        }

        if (!response.ok) {
            const errorText = await response.text();
            // Try to parse as JSON for structured error messages from the server
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.message || `HTTP error! status: ${response.status}`);
            } catch (e) {
                // Fallback for non-JSON error messages
                throw new Error(errorText || `HTTP error! status: ${response.status}`);
            }
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();

    } catch (error) {
        console.error('API Request Error:', error.message);

        // --- NEW: Check for the specific network error ---
        // "Failed to fetch" is the standard message for connection refused, DNS errors, CORS issues etc.
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            if (window.showConnectionError) {
                showConnectionError();
            }
        }
        
        throw error; // Still throw the error so individual pages can handle other issues
    }
}