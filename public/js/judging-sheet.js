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
        document.getElementById('segment-percentage-display').textContent = `(${currentSegment.percentage}% Overall)`;
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

        const isConfirmed = confirm("Are you sure you want to submit all scores for this segment?\n\nThis action cannot be undone.");
        if (!isConfirmed) {
            return; // Stop the function if the user clicks "Cancel"
        }
        
        const submitBtn = document.getElementById('submit-scores-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        // --- NEW: Prevent back button immediately on submit ---
        // This stops the user from navigating back while the request is in flight.
        history.pushState(null, null, location.href);
        window.onpopstate = function () {
            history.go(1);
        };

        const scoreInputs = document.querySelectorAll('.score-input');
        const scoresPayload = [];
        let isValid = true;

        scoreInputs.forEach(input => {
            const score = parseFloat(input.value);
            // Updated validation to check for empty inputs too
            if (input.value.trim() === '' || isNaN(score) || score < 0 || score > 100) {
                input.style.borderColor = 'red'; 
                isValid = false;
            } else { 
                input.style.borderColor = ''; 
            }
            scoresPayload.push({
                candidate_id: input.dataset.candidateId,
                criterion_id: input.dataset.criterionId,
                score: score
            });
        });

        if (!isValid) {
            alert('Please fill in all fields and correct invalid scores (0-100).');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit All Scores';
            // Allow the back button again if validation fails
            window.onpopstate = null; 
            return;
        }

        try {
            await apiRequest('/api/judging/scores', 'POST', { scores: scoresPayload, contest_id: contestId });
            
            // On success, the modal will handle the redirect.
            showSuccessModal(
                "Scores Recorded!",
                "Your scores have been submitted. You will now be returned to the segments list.",
                `/judge-segments.html?contest=${contestId}`
            );

        } catch (error) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit All Scores';
            window.onpopstate = null; // Allow back navigation on any error

            // --- THE FIX IS HERE ---
            // Priority 1: Check for a network connection error.
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                // The global banner from api.js is already handling this.
                // We do nothing here to avoid showing a second alert/modal.
                return; 
            }
            
            // Priority 2: Check for the specific "already submitted" error.
            if (error.message.includes("already submitted")) {
                showSuccessModal(
                    "Submission Blocked",
                    "You have already submitted scores for this segment. Please return to the dashboard.",
                    `/judge-segments.html?contest=${contestId}`,
                    `assets/error-icon.png`
                );
            } 
            // Priority 3: Fallback for any other unexpected server errors.
            else {
                alert(`An unexpected server error occurred: ${error.message}`);
            }
        }
    });
}