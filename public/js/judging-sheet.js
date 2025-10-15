document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contestId = urlParams.get('contest');
    const segmentId = urlParams.get('segment');

    if (!contestId || !segmentId) {
        alert('Missing contest or segment ID.');
        window.location.href = '/judge-dashboard.html';
        return;
    }

    document.getElementById('back-to-dashboard').addEventListener('click', () => {
        window.location.href = `/judge-segments.html?contest=${contestId}`;
    });

    try {
        // Fetch data using the NEW, CORRECT endpoints for judges
        const [criteria, candidates] = await Promise.all([
            apiRequest(`/api/judging/segments/${segmentId}/criteria`),
            apiRequest(`/api/contests/${contestId}/candidates`)
        ]);
        
        // We still need the segment name for the header.
        const segmentsForContest = await apiRequest(`/api/judging/contests/${contestId}/segments`);
        const currentSegment = segmentsForContest.find(s => s.id == segmentId);
        
        document.getElementById('segment-name-header').textContent = currentSegment.name;
        populateTable(criteria, candidates);
        setupFormSubmission(contestId);

    } catch (error) {
        // The error message from the new api.js will be more descriptive now
        console.error('Failed to initialize judging sheet:', error);
        window.location.href = `/judge-segments.html?contest=${contestId}`;
    }
});

function populateTable(criteria, candidates) {
    const tableHead = document.getElementById('judging-table-head');
    const tableBody = document.getElementById('judging-table-body');

    let headerHtml = '<tr><th>Candidate</th>';
    criteria.forEach(c => { headerHtml += `<th>${c.name} (${c.max_score}%)</th>`; });
    headerHtml += '</tr>';
    tableHead.innerHTML = headerHtml;

    tableBody.innerHTML = ''; // Clear previous data
    candidates.forEach(candidate => {
        let rowHtml = `<tr><td><strong>#${candidate.candidate_number}</strong> ${candidate.name}</td>`;
        criteria.forEach(c => {
            rowHtml += `<td><input type="number" class="score-input" min="0" max="100" required placeholder="1-100" data-candidate-id="${candidate.id}" data-criterion-id="${c.id}"></td>`;
        });
        rowHtml += '</tr>';
        tableBody.innerHTML += rowHtml;
    });
}

function setupFormSubmission(contestId) {
    const form = document.getElementById('judging-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submit-scores-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const scoreInputs = document.querySelectorAll('.score-input');
        const scoresPayload = [];
        let isValid = true;

        scoreInputs.forEach(input => {
            const score = parseFloat(input.value);
            if (isNaN(score) || score < 0 || score > 100) {
                input.style.borderColor = 'red'; isValid = false;
            } else { input.style.borderColor = ''; }
            scoresPayload.push({
                candidate_id: input.dataset.candidateId,
                criterion_id: input.dataset.criterionId,
                score: score
            });
        });

        if (!isValid) {
            alert('Please correct invalid scores (0-100).');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit All Scores';
            return;
        }

        try {
            await apiRequest('/api/judging/scores', 'POST', { scores: scoresPayload, contest_id: contestId });
            alert('Scores submitted successfully!');
            window.location.href = `/judge-segments.html?contest=${contestId}`;
        } catch (error) {
            // Error handling is now more robust
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit All Scores';
        }
    });
}