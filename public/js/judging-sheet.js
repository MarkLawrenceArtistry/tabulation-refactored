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
        populateCandidateCards(criteria, candidates);
        setupFormSubmission(contestId);

    } catch (error) {
        // The error message from the new api.js will be more descriptive now
        console.error('Failed to initialize judging sheet:', error);
        window.location.href = `/judge-segments.html?contest=${contestId}`;
    }
});

function populateCandidateCards(criteria, candidates) {
    const container = document.getElementById('judging-cards-container');
    container.innerHTML = ''; // Clear previous data

    if (candidates.length === 0) {
        container.innerHTML = '<p>There are no candidates for this segment.</p>';
        return;
    }

    candidates.forEach(candidate => {
        const card = document.createElement('div');
        card.className = 'candidate-judging-card';

        // Build the list of criteria inputs for this specific candidate
        let criteriaHtml = '';
        criteria.forEach(c => {
            criteriaHtml += `
                <div class="criterion-item">
                    <label for="score-${candidate.id}-${c.id}">${c.name} (${c.max_score}%)</label>
                    <input type="number" id="score-${candidate.id}-${c.id}" class="score-input"
                        min="0" max="100" placeholder="0-100" required
                        data-candidate-id="${candidate.id}" data-criterion-id="${c.id}">
                </div>
            `;
        });

        // --- NEW STRUCTURE ---
        // Combine all details into the final card HTML, matching the new CSS
        const imageUrl = candidate.image_url || '/images/placeholder.png';
        const details = [candidate.branch, candidate.course, candidate.section, candidate.year_level].filter(Boolean).join(' - ');

        card.innerHTML = `
            <img src="${imageUrl}" alt="${candidate.name}" class="card-image">
            <div class="card-content">
                <div class="candidate-info">
                    <h3>#${candidate.candidate_number} ${candidate.name}</h3>
                    <p>${details || 'No additional details'}</p>
                </div>
                <div class="criteria-list">
                    ${criteriaHtml}
                </div>
            </div>
        `;

        container.appendChild(card);
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
            // OLD alert('Please correct invalid scores (0-100).');
            // NEW: Show error modal
            const warningModal = document.getElementById('warning-modal');
            warningModal.style.display = 'flex';

            // Close when clicking outside
            window.addEventListener('click', function handler(e) {
                if (e.target === warningModal) {
                    warningModal.style.display = 'none';
                    window.removeEventListener('click', handler);
                }
            })
            // Auto-close after 2.5 seconds
            setTimeout(() => {
                warningModal.style.display = 'none';
            }, 2500);

            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit All Scores';
            return;
        }

        try {
            await apiRequest('/api/judging/scores', 'POST', { scores: scoresPayload, contest_id: contestId });
            // OLD alert('Scores submitted successfully!');
        
            // NEW: Show success modal
            const modal = document.getElementById('success-modal');
            modal.style.display = 'flex';

            // Close modal when clicking outside it
                window.addEventListener('click', function handler(e) {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                        window.removeEventListener('click', handler);
                        window.location.href = `/judge-segments.html?contest=${contestId}`;
                    }
                });
             // Auto-close after 4 seconds (ADJUST HERE!)
                setTimeout(() => {
                    modal.style.display = 'none';
                    window.location.href = `/judge-segments.html?contest=${contestId}`;
                }, 4000);
        } catch (error) {
            console.error(error);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit All Scores';
        }
    });
}