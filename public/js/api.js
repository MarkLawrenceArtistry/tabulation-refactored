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
            // Browser sets Content-Type for FormData
            options.body = body;
        } else {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }

    try {
        const response = await fetch(endpoint, options);

        // If the response is not OK, handle the error
        if (!response.ok) {
            // Try to get error text, fallback to status text
            const errorText = await response.text();
            throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        // Handle responses with no content
        if (response.status === 204) {
            return null;
        }

        // If we expect JSON, parse it
        return response.json();

    } catch (error) {
        console.error('API Request Error:', error.message);
        alert(`Error: ${error.message}`);
        throw error;
    }
}