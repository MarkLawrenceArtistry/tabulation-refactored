document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'judge') {
        window.location.href = '/login.html';
        return;
    }

    document.getElementById('username-display').textContent = user.username;
    document.getElementById('logout-button').addEventListener('click', () => {
        if (confirm('Are you sure you want to log out?')) {
            localStorage.clear();
            window.location.href = '/login.html';
        }
    });
    
    const socket = window.socket;

    async function loadAvailableSegments() {
        try {
            const segments = await apiRequest('/api/judging/segments');
            const container = document.getElementById('segments-container');
            container.innerHTML = '';

            if (segments.length === 0) {
                container.innerHTML = '<p class="card">No segments are currently open for judging.</p>';
                return;
            }

            segments.forEach(segment => {
                const card = document.createElement('div');
                card.className = 'segment-card';
                
                let buttonHtml = '';
                if (segment.is_judged) {
                    buttonHtml = `<a href="/view-scores.html?segment=${segment.id}&segmentName=${encodeURIComponent(segment.name)}" class="judge-now-btn after">View Submitted Scores</a>`;
                } else {
                    buttonHtml = `<a href="/judging-sheet.html?segment=${segment.id}" class="judge-now-btn before">Judge Now &rarr;</a>`;
                }

                card.innerHTML = `
                    <h3>${segment.name}</h3>
                    <p>Overall Weight: ${segment.percentage}%</p>
                    <div class="button-wrapper">
                        ${buttonHtml}
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (error) {
            document.getElementById('segments-container').innerHTML = '<p class="card">Error loading segments. Please try again later.</p>';
        }
    }

    socket.on('connect', () => console.log('✅ Judge Dashboard: Connected to WebSocket server'));
    socket.on('segment_status_changed', loadAvailableSegments);
    socket.on('candidate_status_changed', loadAvailableSegments);
    socket.on('judging_progress_updated', loadAvailableSegments);

    loadAvailableSegments();
});