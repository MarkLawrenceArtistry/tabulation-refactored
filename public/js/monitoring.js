document.addEventListener('DOMContentLoaded', () => {
    const connectionCountEl = document.getElementById('connection-count');
    const activeUsersListEl = document.getElementById('active-users-list');
    const serverUptimeEl = document.getElementById('server-uptime');
    const totalScoresEl = document.getElementById('total-scores');
    const lastScoreFeedEl = document.getElementById('last-score-feed');
    const openCandidatesCountEl = document.getElementById('open-candidates-count');
    const openCandidatesListEl = document.getElementById('open-candidates-list');

    document.getElementById('force-refresh-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to force every connected user (including other admins) to refresh their page?')) {
            socket.emit('admin_force_refresh_all');
        }
    });

    function formatUptime(seconds) {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    function updateDashboard(kpis) {
        connectionCountEl.textContent = kpis.connectionCount;
        totalScoresEl.textContent = kpis.totalScoresSubmitted;
        serverUptimeEl.textContent = formatUptime(kpis.serverUptime);

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

        if (kpis.lastScore) {
            lastScoreFeedEl.innerHTML = `
                <strong>${kpis.lastScore.judge_name}</strong> scored <strong>${kpis.lastScore.candidate_name}</strong> a <strong>${kpis.lastScore.score}</strong>.
            `;
        } else {
            lastScoreFeedEl.innerHTML = '<span>No scores submitted yet.</span>';
        }
    }

    function updateOpenCandidates(candidates) {
        openCandidatesCountEl.textContent = candidates.length;
        openCandidatesListEl.innerHTML = '';
        if (candidates.length > 0) {
            candidates.forEach(c => {
                const li = document.createElement('li');
                li.textContent = `#${c.candidate_number} ${c.candidate_name} (${c.contest_name})`;
                openCandidatesListEl.appendChild(li);
            });
        } else {
            openCandidatesListEl.innerHTML = '<li>No candidates are currently open for judging.</li>';
        }
    }

    socket.on('connect', () => {
        const token = localStorage.getItem('authToken');
        socket.emit('client_auth', token);
    });

    socket.on('kpi_update', (kpis) => {
        updateDashboard(kpis);
    });

    socket.on('candidate_status_changed', async () => {
        try {
            const openCandidates = await apiRequest('/api/admin/open-candidates');
            updateOpenCandidates(openCandidates);
        } catch (error) {
            console.error('Failed to refresh open candidates list:', error);
        }
    });

    async function initialLoad() {
        try {
            const [initialKpis, serverInfo, openCandidates] = await Promise.all([
                apiRequest('/api/admin/kpis'),
                apiRequest('/api/admin/server-info'),
                apiRequest('/api/admin/open-candidates')
            ]);
            updateDashboard(initialKpis);
            document.getElementById('server-ip').textContent = serverInfo.ipAddress;
            updateOpenCandidates(openCandidates);
        } catch (error) {
            console.error("Failed to load initial KPI data:", error);
            document.getElementById('server-ip').textContent = 'Error';
        }
    }

    initialLoad();
});