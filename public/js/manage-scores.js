document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role === 'judge') {
        window.location.href = '/login.html'; // Redirect non-admins
        return;
    }

    const filterForm = document.getElementById('filter-form');
    const contestFilter = document.getElementById('contest-filter');
    const scoresTableBody = document.getElementById('scores-table-body');

    // --- INITIAL DATA LOADING ---
    async function populateContestFilter() {
        try {
            const contests = await apiRequest('/api/contests');
            contests.forEach(contest => {
                const option = document.createElement('option');
                option.value = contest.id;
                option.textContent = contest.name;
                contestFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load contests:', error);
        }
    }

    // --- MAIN FUNCTIONALITY ---
    async function loadScores() {
        const contestId = contestFilter.value;
        
        // Build query params
        const params = new URLSearchParams();
        if (contestId) params.append('contest_id', contestId);
        
        scoresTableBody.innerHTML = '<tr><td colspan="6">Loading scores...</td></tr>';

        try {
            const scores = await apiRequest(`/api/scores?${params.toString()}`);
            renderScores(scores);
        } catch (error) {
            scoresTableBody.innerHTML = '<tr><td colspan="6">Failed to load scores.</td></tr>';
        }
    }

    function renderScores(scores) {
        if (!scores || scores.length === 0) {
            scoresTableBody.innerHTML = '<tr><td colspan="6">No scores found for the selected filter.</td></tr>';
            return;
        }

        scoresTableBody.innerHTML = ''; // Clear table
        scores.forEach(score => {
            const row = `
                <tr>
                    <td>${score.contest_name}</td>
                    <td>${score.segment_name}</td>
                    <td>${score.candidate_name}</td>
                    <td>${score.criterion_name}</td>
                    <td>${score.judge_name}</td>
                    <td><strong>${score.score}</strong></td>
                </tr>
            `;
            scoresTableBody.innerHTML += row;
        });
    }

    // --- EVENT LISTENERS ---
    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadScores();
    });

    // --- INITIALIZATION ---
    populateContestFilter();
});