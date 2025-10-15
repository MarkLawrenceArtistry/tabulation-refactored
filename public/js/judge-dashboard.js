document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'judge') {
        window.location.href = '/login.html';
        return;
    }

    document.getElementById('username-display').textContent = user.username;
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });

    loadAvailableContests();
});

async function loadAvailableContests() {
    try {
        const contests = await apiRequest('/api/judging/contests');
        const container = document.getElementById('contests-container');
        container.innerHTML = '';

        if (contests.length === 0) {
            container.innerHTML = '<p class="card">All judging is complete. Thank you!</p>';
            return;
        }

        contests.forEach(contest => {
            const imageUrl = contest.image_url || '/images/placeholder.png';
            const card = document.createElement('div');
            card.className = 'contest-card';
            card.innerHTML = `
                <img src="${imageUrl}" alt="${contest.name}">
                <div class="contest-card-body">
                    <h3>${contest.name}</h3>
                    <a href="/judge-segments.html?contest=${contest.id}" class="judge-now-btn">Judge Now &rarr;</a>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        document.getElementById('contests-container').innerHTML = '<p class="card">Error loading contests. Please try again later.</p>';
    }
}