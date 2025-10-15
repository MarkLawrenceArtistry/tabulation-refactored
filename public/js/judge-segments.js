document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contestId = urlParams.get('contest');

    if (!contestId) {
        alert('No contest selected.');
        window.location.href = '/judge-dashboard.html';
        return;
    }
    
    // Fetch and display segments for this specific contest
    try {
        const segments = await apiRequest(`/api/judging/contests/${contestId}/segments`);
        const container = document.getElementById('segments-container');
        container.innerHTML = '';
        
        // To display the contest name, we need to get it. A bit inefficient but fine for this purpose.
        const allContests = await apiRequest('/api/contests');
        const currentContest = allContests.find(c => c.id == contestId);
        if(currentContest) {
            document.getElementById('contest-name-header').textContent = `Contest: ${currentContest.name}`;
        }

        if (segments.length === 0) {
            container.innerHTML = '<p class="card">Judging for this contest is complete. Please go back.</p>';
            return;
        }

        segments.forEach(segment => {
            const card = document.createElement('div');
            card.className = 'segment-card';
            card.innerHTML = `
                <h3>${segment.name}</h3>
                <p>Overall Weight: ${segment.percentage}%</p>
                <a href="/judging-sheet.html?contest=${contestId}&segment=${segment.id}" class="judge-now-btn">Judge now!</a>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        document.getElementById('segments-container').innerHTML = '<p class="card">Error loading segments.</p>';
    }
});