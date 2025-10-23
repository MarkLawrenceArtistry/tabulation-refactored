document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const connectionCountEl = document.getElementById('connection-count');
    const activeUsersListEl = document.getElementById('active-users-list');
    const serverUptimeEl = document.getElementById('server-uptime');
    const totalScoresEl = document.getElementById('total-scores');
    const lastScoreFeedEl = document.getElementById('last-score-feed');

    // Helper to format uptime from seconds to HH:MM:SS
    function formatUptime(seconds) {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    // Main function to update the entire UI from a KPI object
    function updateDashboard(kpis) {
        connectionCountEl.textContent = kpis.connectionCount;
        totalScoresEl.textContent = kpis.totalScoresSubmitted;
        serverUptimeEl.textContent = formatUptime(kpis.serverUptime);

        // Update Active Users List
        activeUsersListEl.innerHTML = '';
        if (kpis.activeUsers.length > 0) {
            kpis.activeUsers.forEach(user => {
                const li = document.createElement('li');
                li.innerHTML = `
                    ${user.username}
                    <span class="role-badge role-${user.role}">${user.role}</span>
                `;
                activeUsersListEl.appendChild(li);
            });
        } else {
            activeUsersListEl.innerHTML = '<li>No users currently connected.</li>';
        }

        // Update Last Score Feed
        if (kpis.lastScore) {
            lastScoreFeedEl.innerHTML = `
                <strong>${kpis.lastScore.judge_name}</strong> scored <strong>${kpis.lastScore.candidate_name}</strong> a <strong>${kpis.lastScore.score}</strong>.
            `;
        } else {
            lastScoreFeedEl.innerHTML = '<span>No scores submitted yet.</span>';
        }
    }

    // --- Socket.IO Event Handlers ---
    socket.on('connect', () => {
        // IMPORTANT: Authenticate this socket connection with the server
        const token = localStorage.getItem('authToken');
        socket.emit('client_auth', token);
    });

    socket.on('kpi_update', (kpis) => {
        updateDashboard(kpis);
    });

    // --- Initial Data Load ---
    async function initialLoad() {
        try {
            const initialKpis = await apiRequest('/api/admin/kpis');
            updateDashboard(initialKpis);
        } catch (error) {
            console.error("Failed to load initial KPI data:", error);
            // Handle error, maybe show a message on the dashboard
        }
    }

    initialLoad();
});