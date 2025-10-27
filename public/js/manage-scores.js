document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role === 'judge') {
        window.location.href = '/login.html';
        return;
    }

    const filterForm = document.getElementById('filter-form');
    const contestFilter = document.getElementById('contest-filter');
    const segmentFilter = document.getElementById('segment-filter');
    const judgeFilter = document.getElementById('judge-filter');
    const scoresTableBody = document.getElementById('scores-table-body');

    async function populateInitialFilters() {
        try {
            const [contests, users] = await Promise.all([
                apiRequest('/api/contests'),
                apiRequest('/api/users')
            ]);

            contests.forEach(contest => {
                contestFilter.innerHTML += `<option value="${contest.id}">${contest.name}</option>`;
            });

            const judges = users.filter(u => u.role === 'judge');
            judges.forEach(judge => {
                judgeFilter.innerHTML += `<option value="${judge.id}">${judge.username}</option>`;
            });
            
        } catch (error) {
            console.error('Failed to load initial filters:', error);
        }
    }

    async function populateSegmentFilter() {
        const contestId = contestFilter.value;
        segmentFilter.innerHTML = '<option value="">-- All Segments --</option>';
        
        if (!contestId) {
            segmentFilter.disabled = true;
            return;
        }

        try {
            // Re-using the global segment endpoint
            const segments = await apiRequest('/api/segments');
            segments.filter(s => s.type === 'judge').forEach(segment => {
                segmentFilter.innerHTML += `<option value="${segment.id}">${segment.name}</option>`;
            });
            segmentFilter.disabled = false;
        } catch (error) {
            console.error('Failed to load segments:', error);
            segmentFilter.disabled = true;
        }
    }

    async function loadScores() {
        const contestId = contestFilter.value;
        const segmentId = segmentFilter.value;
        const judgeId = judgeFilter.value;
        
        const params = new URLSearchParams();
        if (contestId) params.append('contest_id', contestId);
        if (segmentId) params.append('segment_id', segmentId);
        if (judgeId) params.append('judge_id', judgeId);
        
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
            scoresTableBody.innerHTML = '<tr><td colspan="6">No scores found for the selected filters.</td></tr>';
            return;
        }

        scoresTableBody.innerHTML = '';
        scores.forEach(score => {
            const row = `
                <tr>
                    <td>${score.contest_name}</td>
                    <td>${score.segment_name}</td>
                    <td>#${score.candidate_number} - ${score.candidate_name}</td>
                    <td>${score.criterion_name}</td>
                    <td>${score.judge_name}</td>
                    <td><strong>${score.score}</strong></td>
                </tr>
            `;
            scoresTableBody.innerHTML += row;
        });
    }

    contestFilter.addEventListener('change', populateSegmentFilter);
    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadScores();
    });

    populateInitialFilters();
});