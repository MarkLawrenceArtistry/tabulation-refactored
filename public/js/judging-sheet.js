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
    const filterByBranchSelect = document.getElementById('filter-by-branch');
    const sortCandidatesSelect = document.getElementById('sort-candidates');

    let currentSort = 'number_asc';
    let currentFilter = 'all';

    let allCandidates = [];
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
        updateDisplay();
        loadScoresFromCache(cacheKey);
        setupEventListeners();
    } catch (error) {
        console.error('Failed to initialize judging sheet:', error);
        window.location.href = `/judge-dashboard.html`;
    }

    function handleCandidateDataUpdate(updatedCandidate) {
        const card = cardsContainer.querySelector(`.candidate-judging-card[data-candidate-id='${updatedCandidate.id}']`);
        if (!card) return;

        console.log(`Updating data for candidate #${updatedCandidate.candidate_number}`);
        
        const details = [updatedCandidate.branch, updatedCandidate.course, updatedCandidate.section, updatedCandidate.year_level].filter(Boolean).join(' - ');

        card.querySelector('.card-image').src = updatedCandidate.image_url || '/images/placeholder.png';
        card.querySelector('h3').textContent = `#${updatedCandidate.candidate_number} ${updatedCandidate.name}`;
        card.querySelector('p').textContent = details || 'No additional details';

        const allCandidatesIndex = allCandidates.findIndex(c => c.id === updatedCandidate.id);
        if (allCandidatesIndex > -1) allCandidates[allCandidatesIndex] = updatedCandidate;
        
        const candidatesIndex = candidates.findIndex(c => c.id === updatedCandidate.id);
        if (candidatesIndex > -1) candidates[candidatesIndex] = updatedCandidate;
    }

    async function fetchData() {
        const [crit, cands, locked] = await Promise.all([
            apiRequest(`/api/judging/segments/${segmentId}/criteria`),
            apiRequest(`/api/judging/candidates`),
            apiRequest(`/api/judging/segments/${segmentId}/locked-candidates`)
        ]);
        criteria = crit;
        allCandidates = cands;
        populateFiltersAndSorters();
        lockedCandidateIds = locked.map(c => c.candidate_id);
        
        const allSegments = await apiRequest(`/api/segments`);
        const currentSegment = allSegments.find(s => s.id == segmentId);
        
        document.getElementById('segment-name-header').textContent = currentSegment.name;
        document.getElementById('segment-percentage-display').textContent = `(${currentSegment.percentage}% Overall)`; 
    }

    function populateFiltersAndSorters() {
        const branches = [...new Set(allCandidates.map(c => c.branch).filter(Boolean))];
        filterByBranchSelect.innerHTML = `<option value="all">All Branches</option>`;
        branches.forEach(branch => {
            filterByBranchSelect.innerHTML += `<option value="${branch}">${branch}</option>`;
        });

        sortCandidatesSelect.innerHTML = `
            <option value="number_asc">Sort by No. (Asc)</option>
            <option value="number_desc">Sort by No. (Desc)</option>
            <option value="name_asc">Sort by Name (A-Z)</option>
            <option value="name_desc">Sort by Name (Z-A)</option>
        `;

        filterByBranchSelect.value = currentFilter;
        sortCandidatesSelect.value = currentSort;
    }

    function updateDisplay() {
        let filteredCandidates = allCandidates;
        if (currentFilter !== 'all') {
            filteredCandidates = allCandidates.filter(c => c.branch === currentFilter);
        }

        candidates = [...filteredCandidates].sort((a, b) => {
            switch (currentSort) {
                case 'number_desc':
                    return b.candidate_number - a.candidate_number;
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'name_desc':
                    return b.name.localeCompare(a.name);
                case 'number_asc':
                default:
                    return a.candidate_number - b.candidate_number;
            }
        });

        currentCandidateIndex = 0;
        renderUI();
        loadScoresFromCache(cacheKey);
    }

    async function handleScoreUnlock() {
        console.log('Admin unlocked a score, refreshing data...');
        await fetchData();
        renderUI();
        loadScoresFromCache(cacheKey);
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
                            min="5" max="${c.max_score}" step="0.01" placeholder="5-${c.max_score}" required
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

        const activeCard = cardsContainer.querySelector('.candidate-judging-card.active');
        if (activeCard) {
            const firstInput = activeCard.querySelector('.score-input:not([disabled])');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 150);
            }
        }
    }
    
    async function handleLockScores(candidateId) {
        const card = cardsContainer.querySelector(`.candidate-judging-card[data-candidate-id='${candidateId}']`);
        const inputs = card.querySelectorAll('.score-input');
        const lockBtn = card.querySelector('.lock-scores-btn');
        let isValid = true;
        
        inputs.forEach(input => {
            const score = parseFloat(input.value);
            const max = parseFloat(input.max);
            if (input.value.trim() === '' || isNaN(score) || score < 5 || score > max) {
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
            lockedCandidateIds.push(parseInt(candidateId, 10));

            const allCandidatesAreScored = allCandidates.every(c => lockedCandidateIds.includes(c.id));
            
            if (allCandidatesAreScored) {
                clearScoresFromCache(cacheKey);
                showSuccessModal("Segment Complete!", "You have now scored all available candidates for this segment.", '/judge-dashboard.html');
            } else {
                const allVisibleCandidatesAreScored = candidates.every(c => lockedCandidateIds.includes(c.id));
                if (allVisibleCandidatesAreScored && currentFilter !== 'all') {
                    alert("You have unscored candidates in another branch. The filter has been reset to show all.");
                    currentFilter = 'all';
                    filterByBranchSelect.value = 'all';
                    updateDisplay();
                }
            }
        } catch (error) {
            alert(`Error locking scores: ${error.message}`);
            lockBtn.disabled = false;
            lockBtn.textContent = 'Lock Scores';
        }
    }

    async function handleCandidateStatusUpdate() {
        if (candidates.length === 0) return;

        const currentCandidateBeforeUpdate = candidates[currentCandidateIndex];
        const oldIndex = currentCandidateIndex;

        await fetchData();

        const newIndexOfOldCandidate = candidates.findIndex(c => c.id === currentCandidateBeforeUpdate.id);

        if (newIndexOfOldCandidate !== -1) {
            currentCandidateIndex = newIndexOfOldCandidate;
        } else {
            currentCandidateIndex = Math.max(0, oldIndex - 1);
        }

        renderUI();
        loadScoresFromCache(cacheKey);
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
        window.socket.on('judging_progress_updated', handleScoreUnlock);
        filterByBranchSelect.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            updateDisplay();
        });
        window.socket.on('candidate_data_updated', handleCandidateDataUpdate);
        sortCandidatesSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            updateDisplay();
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