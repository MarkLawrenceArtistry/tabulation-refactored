document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contestId = urlParams.get('contest');
    const segmentId = urlParams.get('segment');
    const segmentName = urlParams.get('segmentName');

    if (!segmentId || !contestId) {
        alert('Missing segment or contest ID.');
        window.location.href = '/judge-dashboard.html';
        return;
    }

    // Set up header and back button
    document.getElementById('header-title').textContent = `Scores for: ${decodeURIComponent(segmentName)}`;
    document.getElementById('back-button').href = `/judge-segments.html?contest=${contestId}`;

    try {
        const scores = await apiRequest(`/api/judging/segments/${segmentId}/my-scores`);
        const tableBody = document.getElementById('scores-table-body');
        
        if (scores.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3">No scores found.</td></tr>';
            return;
        }

        tableBody.innerHTML = ''; // Clear loading message
        scores.forEach(score => {
            const row = `
                <tr>
                    <td>#${score.candidate_number} - ${score.candidate_name}</td>
                    <td>${score.criterion_name}</td>
                    <td><strong>${score.score}</strong></td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

    } catch (error) {
        document.getElementById('scores-table-body').innerHTML = '<tr><td colspan="3">Error loading scores.</td></tr>';
        console.error('Failed to load scores:', error);
    }
});