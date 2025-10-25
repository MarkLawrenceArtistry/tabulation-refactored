document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contestId = urlParams.get('contest');
    const segmentId = urlParams.get('segment');

    const user = JSON.parse(localStorage.getItem('user'));
    const cacheKey = `cachedScores_judge_${user.id}_segment_${segmentId}`;

    const form = document.getElementById('judging-form');
    const cardsContainer = document.getElementById('judging-cards-container');
    const viewModeToggle = document.getElementById('view-mode-toggle');
    const prevBtn = document.getElementById('prev-candidate-btn');
    const nextBtn = document.getElementById('next-candidate-btn');
    const carouselStatus = document.getElementById('carousel-status');

    let currentViewMode = 'carousel';
    let currentCandidateIndex = 0;
    let candidates = [];
    let criteria = [];

    if (!contestId || !segmentId) {
        alert('Missing contest or segment ID.');
        window.location.href = '/judge-dashboard.html';
        return;
    }

    socket.on('candidate_status_changed', async (data) => {
        if (data.contest_id == contestId) {
            console.log('Candidate status changed, intelligently refreshing list...');

            const currentCandidateId = candidates[currentCandidateIndex]?.id;

            await fetchData();

            let newIndex = 0;
            if (currentCandidateId) {
                const foundIndex = candidates.findIndex(c => c.id === currentCandidateId);
                if (foundIndex !== -1) {
                    newIndex = foundIndex;
                }
            }
            currentCandidateIndex = newIndex;

            renderUI();
            
            loadScoresFromCache(cacheKey);
        }
    });
    
    document.getElementById('back-to-dashboard').onclick = () => {
        window.location.href = `/judge-segments.html?contest=${contestId}`;
    };

    try {
        await fetchData();
        renderUI();
        loadScoresFromCache(cacheKey);
        setupEventListeners();
    } catch (error) {
        console.error('Failed to initialize judging sheet:', error);
        window.location.href = `/judge-segments.html?contest=${contestId}`;
    }

    async function fetchData() {
        [criteria, candidates] = await Promise.all([
            apiRequest(`/api/judging/segments/${segmentId}/criteria`),
            apiRequest(`/api/judging/contests/${contestId}/candidates`)
        ]);
        
        const segmentsForContest = await apiRequest(`/api/judging/contests/${contestId}/segments`);
        const currentSegment = segmentsForContest.find(s => s.id == segmentId);
        
        document.getElementById('segment-name-header').textContent = currentSegment.name;
        document.getElementById('segment-percentage-display').textContent = `(${currentSegment.percentage}% Overall)`; 
    }

    function renderUI() {
        populateAllCandidateCards();
        updateViewMode();
    }
    
    function populateAllCandidateCards() {
        cardsContainer.innerHTML = '';
        if (candidates.length === 0) {
            cardsContainer.innerHTML = '<p>There are no candidates for this segment.</p>';
            return;
        }

        candidates.forEach(candidate => {
            const card = document.createElement('div');
            card.className = 'candidate-judging-card';
            card.dataset.candidateId = candidate.id;

            let criteriaHtml = '';
            criteria.forEach(c => {
                criteriaHtml += `
                    <div class="criterion-item">
                        <label for="score-${candidate.id}-${c.id}">${c.name} (${c.max_score}%)</label>
                        <input type="number" id="score-${candidate.id}-${c.id}" class="score-input"
                            min="0" max="${c.max_score}" step="0.01" placeholder="0-${c.max_score}" required
                            data-candidate-id="${candidate.id}" data-criterion-id="${c.id}">
                    </div>
                `;
            });

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
            cardsContainer.appendChild(card);
        });
    }

    function updateViewMode() {
        if (currentViewMode === 'carousel') {
            document.body.classList.add('view-carousel');
            document.body.classList.remove('view-card');
            viewModeToggle.textContent = 'View Card Mode';
            showCurrentCandidateInCarousel();
        } else {
            document.body.classList.add('view-card');
            document.body.classList.remove('view-carousel');
            viewModeToggle.textContent = 'View Carousel Mode';
            const allCards = cardsContainer.querySelectorAll('.candidate-judging-card');
            allCards.forEach(c => c.classList.remove('active'));
        }
    }

    function showCurrentCandidateInCarousel() {
        const allCards = cardsContainer.querySelectorAll('.candidate-judging-card');
        allCards.forEach((card, index) => {
            if (index === currentCandidateIndex) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        carouselStatus.textContent = `Candidate ${currentCandidateIndex + 1} of ${candidates.length}`;
        prevBtn.disabled = currentCandidateIndex === 0;
        nextBtn.disabled = currentCandidateIndex === candidates.length - 1;
    }

    function setupEventListeners() {
        viewModeToggle.addEventListener('click', () => {
            currentViewMode = currentViewMode === 'carousel' ? 'card' : 'carousel';
            updateViewMode();
        });

        nextBtn.addEventListener('click', () => {
            if (currentCandidateIndex < candidates.length - 1) {
                currentCandidateIndex++;
                showCurrentCandidateInCarousel();
            }
        });

        prevBtn.addEventListener('click', () => {
            if (currentCandidateIndex > 0) {
                currentCandidateIndex--;
                showCurrentCandidateInCarousel();
            }
        });

        form.addEventListener('submit', (e) => handleFormSubmission(e, contestId, cacheKey));
        cardsContainer.addEventListener('input', () => saveScoresToCache(cacheKey));
    }

    async function handleFormSubmission(e, contestId, cacheKey) {
        e.preventDefault();

        const scoreInputs = document.querySelectorAll('.score-input');
        
        let hasFormatErrors = false;
        scoreInputs.forEach(input => {
            const score = parseFloat(input.value);
            const maxScore = parseFloat(input.max);
            if (input.value.trim() !== '' && (isNaN(score) || score < 0 || score > maxScore)) {
                input.style.borderColor = 'red';
                hasFormatErrors = true;
            } else {
                input.style.borderColor = '';
            }
        });

        if (hasFormatErrors) {
            alert('Please correct invalid scores (must be a number between 0 and the max value).');
            return;
        }

        const incompleteCandidates = [];
        candidates.forEach((candidate, index) => {
            let isCandidateComplete = true;
            criteria.forEach(criterion => {
                const input = document.getElementById(`score-${candidate.id}-${criterion.id}`);
                if (!input || input.value.trim() === '') {
                    isCandidateComplete = false;
                }
            });
            if (!isCandidateComplete) {
                incompleteCandidates.push({ ...candidate, index });
            }
        });

        if (incompleteCandidates.length > 0) {
            const names = incompleteCandidates.map(c => `#${c.number} ${c.name}`).join('\n');
            alert(`Please complete the scores for the following candidate(s):\n\n${names}`);
            
            if (currentViewMode === 'carousel' && incompleteCandidates.length > 0) {
                currentCandidateIndex = incompleteCandidates[0].index;
                showCurrentCandidateInCarousel();
            }
            return;
        }
        
        const isConfirmed = confirm("All scores are complete. Are you sure you want to submit? This action cannot be undone.");
        if (!isConfirmed) return;

        const submitBtn = document.getElementById('submit-scores-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        history.pushState(null, null, location.href);
        window.onpopstate = () => history.go(1);
        
        const scoresPayload = Array.from(scoreInputs).map(input => ({
            candidate_id: input.dataset.candidateId,
            criterion_id: input.dataset.criterionId,
            score: parseFloat(input.value)
        }));

        try {
            await apiRequest('/api/judging/scores', 'POST', { scores: scoresPayload });
            clearScoresFromCache(cacheKey);
            showSuccessModal(
                "Scores Recorded!",
                "Your scores have been submitted and locked.",
                `/judge-segments.html?contest=${contestId}`
            );
        } catch (error) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit All Scores';
            window.onpopstate = null;
            if (error.message.includes("already submitted")) {
                showSuccessModal("Submission Blocked", "You have already submitted scores for this segment.", `/judge-segments.html?contest=${contestId}`);
            } else {
                alert(`An unexpected server error occurred: ${error.message}`);
            }
        }
    }
});

function saveScoresToCache(cacheKey) {
    const scoreInputs = document.querySelectorAll('.score-input');
    const scoresToCache = [];
    scoreInputs.forEach(input => {
        if (input.value.trim() !== '') {
            scoresToCache.push({
                id: input.id,
                value: input.value
            });
        }
    });
    if (scoresToCache.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(scoresToCache));
    } else {
        localStorage.removeItem(cacheKey);
    }
}

function loadScoresFromCache(cacheKey) {
    const cachedScores = localStorage.getItem(cacheKey);
    if (cachedScores) {
        try {
            const scores = JSON.parse(cachedScores);
            let restoredCount = 0;
            scores.forEach(score => {
                const inputField = document.getElementById(score.id);
                if (inputField) {
                    inputField.value = score.value;
                    restoredCount++;
                }
            });
            if (restoredCount > 0) {
                console.log(`Restored ${restoredCount} scores from cache.`);
                const notification = document.createElement('div');
                notification.textContent = 'Restored your unsaved scores.';
                notification.style.cssText = 'position:fixed; bottom:20px; right:20px; background-color:#10b981; color:white; padding:10px 15px; border-radius:5px; z-index:1000;';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
            }
        } catch (e) {
            console.error('Failed to parse cached scores:', e);
            localStorage.removeItem(cacheKey);
        }
    }
}

function clearScoresFromCache(cacheKey) {
    localStorage.removeItem(cacheKey);
    console.log('Cache cleared after successful submission.');
}