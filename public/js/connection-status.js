// =================================================
// FILE: public/js/connection-status.js (NEW FILE)
// =================================================
(function() {
    let banner = null;

    function createBanner() {
        // Inject CSS for the banner
        const style = document.createElement('style');
        style.innerHTML = `
            #connection-error-banner {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                background-color: #d32f2f;
                color: white;
                text-align: center;
                padding: 12px;
                font-size: 1rem;
                font-weight: 500;
                z-index: 99999;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                display: none; /* Initially hidden */
            }
            #connection-error-banner button {
                background-color: #fff;
                color: #d32f2f;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                margin-left: 15px;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);

        // Create the banner element
        banner = document.createElement('div');
        banner.id = 'connection-error-banner';
        banner.innerHTML = `
            ⚠️ Connection to the server was lost. Please check your network or wait for the server to come back online.
            <button onclick="window.location.reload()">Retry</button>
        `;
        document.body.appendChild(banner);
    }

    function showConnectionError() {
        if (!banner) {
            createBanner();
        }
        banner.style.display = 'block';
    }

    function hideConnectionError() {
        if (banner) {
            banner.style.display = 'none';
        }
    }

    // Expose functions to the global scope
    window.showConnectionError = showConnectionError;
    window.hideConnectionError = hideConnectionError;
})();