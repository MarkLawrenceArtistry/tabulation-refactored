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

    document.getElementById('header-title').textContent = `My Scores: ${decodeURIComponent(segmentName)}`;
    document.getElementById('back-button').href = `/judge-segments.html?contest=${contestId}`;
    const container = document.getElementById('scores-container');

    try {
        const scoresData = await apiRequest(`/api/judging/segments/${segmentId}/my-scores`);
        
        if (scoresData.length === 0) {
            container.innerHTML = '<p class="card">No scores found for this segment.</p>';
            return;
        }

        const scoresByCandidate = scoresData.reduce((acc, score) => {
            if (!acc[score.candidate_id]) {
                acc[score.candidate_id] = {
                    id: score.candidate_id,
                    name: score.candidate_name,
                    number: score.candidate_number,
                    imageUrl: score.image_url,
                    scores: [],
                    totalScore: 0
                };
            }
            acc[score.candidate_id].scores.push({
                criterionName: score.criterion_name,
                score: score.score,
                maxScore: score.max_score
            });
            acc[score.candidate_id].totalScore += parseFloat(score.score);
            return acc;
        }, {});

        container.innerHTML = '';
        
        for (const candidateId in scoresByCandidate) {
            const candidate = scoresByCandidate[candidateId];
            const card = document.createElement('div');
            card.className = 'score-card';

            let criteriaListHtml = '<ul class="criteria-scores-list">';
            candidate.scores.forEach(s => {
                criteriaListHtml += `
                    <li class="criterion-score-item">
                        <span class="criterion-name">${s.criterionName} (${s.maxScore}%)</span>
                        <span class="submitted-score">${s.score}</span>
                    </li>
                `;
            });
            criteriaListHtml += '</ul>';
            
            const imageUrl = candidate.imageUrl || '/images/placeholder.png';

            card.innerHTML = `
                <img src="${imageUrl}" alt="${candidate.name}" class="card-image">
                <div class="card-content">
                    <div class="candidate-info">
                        <h3>#${candidate.number} ${candidate.name}</h3>
                    </div>
                    ${criteriaListHtml}
                    <div class="total-score-display">
                        <span class="total-label">Total for Segment</span>
                        <span class="total-value">${candidate.totalScore.toFixed(2)}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        }

    } catch (error) {
        container.innerHTML = '<p class="card">Error loading scores. Please try again.</p>';
        console.error('Failed to load scores:', error);
    }
});