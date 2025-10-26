document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const segmentId = urlParams.get('segment');

    const user = JSON.parse(localStorage.getItem('user'));
    const cacheKey = `cachedScores_judge_${user.id}_segment_${segmentId}`;

    const cardsContainer = document.getElementById('judging-cards-container');
    const viewModeToggle = document.getElementById('view-mode-toggle');
    const prevBtn = document.getElementById('prev-candidate-btn');
    const nextBtn = document.getElementById('next-candidate-btn');
    const carouselStatus = document.getElementById('carousel-status');

    let currentViewMode = 'carousel';
    let currentCandidateIndex = 0;
    let candidates = [];
    let criteria = [];
    let lockedCandidateIds = [];

    if (!segmentId) {
        alert('Missing segment ID.');
        window.location.href = '/judge-dashboard.html';
        return;
    }
    
    document.getElementById('back-to-dashboard').onclick = () => {
        window.location.href = `/judge-dashboard.html`;
    };

    try {
        await fetchData();
        renderUI();
        loadScoresFromCache(cacheKey);
        setupEventListeners();
    } catch (error) {
        console.error('Failed to initialize judging sheet:', error);
        window.location.href = `/judge-dashboard.html`;
    }

    async function fetchData() {
        const [crit, cands, locked] = await Promise.all([
            apiRequest(`/api/judging/segments/${segmentId}/criteria`),
            apiRequest(`/api/judging/candidates`),
            apiRequest(`/api/judging/segments/${segmentId}/locked-candidates`)
        ]);
        criteria = crit;
        candidates = cands;
        lockedCandidateIds = locked.map(c => c.candidate_id);
        
        const allSegments = await apiRequest(`/api/segments`);
        const currentSegment = allSegments.find(s => s.id == segmentId);
        
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
            cardsContainer.innerHTML = '<p class="card">There are no candidates currently open for judging in this segment.</p>';
            document.getElementById('carousel-nav').classList.add('hidden');
            return;
        }

        candidates.forEach(candidate => {
            const isLocked = lockedCandidateIds.includes(candidate.id);
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
                            data-candidate-id="${candidate.id}" data-criterion-id="${c.id}" ${isLocked ? 'disabled' : ''} onKeyPress="if(this.value.length==3) return false;">
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
                    <button type="button" class="lock-scores-btn" data-candidate-id="${candidate.id}" ${isLocked ? 'disabled' : ''}>
                        ${isLocked ? 'Scores Locked ✓' : 'Lock Scores'}
                    </button>
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
            cardsContainer.querySelectorAll('.candidate-judging-card').forEach(c => c.classList.remove('active'));
        }
    }

    function showCurrentCandidateInCarousel() {
        if (candidates.length === 0) return;
        cardsContainer.querySelectorAll('.candidate-judging-card').forEach((card, index) => {
            card.classList.toggle('active', index === currentCandidateIndex);
        });
        carouselStatus.textContent = `Candidate ${currentCandidateIndex + 1} of ${candidates.length}`;
        prevBtn.disabled = currentCandidateIndex === 0;
        nextBtn.disabled = currentCandidateIndex === candidates.length - 1;
    }
    
    async function handleLockScores(candidateId) {
        const card = cardsContainer.querySelector(`.candidate-judging-card[data-candidate-id='${candidateId}']`);
        const inputs = card.querySelectorAll('.score-input');
        const lockBtn = card.querySelector('.lock-scores-btn');
        let isValid = true;
        
        inputs.forEach(input => {
            const score = parseFloat(input.value);
            const max = parseFloat(input.max);
            if (input.value.trim() === '' || isNaN(score) || score < 0 || score > max) {
                input.style.borderColor = 'red';
                isValid = false;
            } else {
                input.style.borderColor = '';
            }
        });

        if (!isValid) {
            alert(`Please fill out all scores correctly for candidate #${card.querySelector('h3').textContent.split(' ')[0]}.`);
            return;
        }

        const payload = {
            segment_id: segmentId,
            candidate_id: candidateId,
            scores: Array.from(inputs).map(i => ({
                criterion_id: i.dataset.criterionId,
                score: parseFloat(i.value)
            }))
        };
        
        lockBtn.disabled = true;
        lockBtn.textContent = 'Locking...';
        
        try {
            await apiRequest('/api/judging/scores-for-candidate', 'POST', payload);
            lockBtn.textContent = 'Scores Locked ✓';
            inputs.forEach(i => i.disabled = true);
            // Check if all are locked and show a final message
            if (cardsContainer.querySelectorAll('.lock-scores-btn:not(:disabled)').length === 0) {
                showSuccessModal("Segment Complete!", "You have now scored all available candidates for this segment.", '/judge-dashboard.html');
            }
        } catch (error) {
            alert(`Error locking scores: ${error.message}`);
            lockBtn.disabled = false;
            lockBtn.textContent = 'Lock Scores';
        }
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
        cardsContainer.addEventListener('input', () => saveScoresToCache(cacheKey));
        cardsContainer.addEventListener('click', (e) => {
            if (e.target.matches('.lock-scores-btn')) {
                handleLockScores(e.target.dataset.candidateId);
            }
        });
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