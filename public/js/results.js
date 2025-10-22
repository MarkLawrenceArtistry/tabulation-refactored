document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const tableBody = document.getElementById('results-table-body');
    const contestSelect = document.getElementById('contest-leaderboard-select');
    const leaderboardTitle = document.getElementById('leaderboard-title');
    const firstPlace = document.getElementById('first-place');
    const secondPlace = document.getElementById('second-place');
    const thirdPlace = document.getElementById('third-place');

    let fullResults = {};
    let previousRanks = {};
    let rowPositions = {};
    let previousPodium = {
        first: { id: null, score: null },
        second: { id: null, score: null },
        third: { id: null, score: null }
    };
    let isLoading = false;

    socket.on('connect', () => console.log('✅ Connected to WebSocket server'));
    socket.on('disconnect', () => {
        console.log('⚠️ Disconnected from WebSocket server.');
        tableBody.innerHTML = '<tr><td colspan="5">Disconnected. Trying to reconnect...</td></tr>';
    });

    socket.on('update_results', (groupedResults) => {
        if (isLoading) {
            console.log("Results update already in progress. Skipping.");
            return;
        }
        isLoading = true;
        fullResults = groupedResults;
        populateContestSelector(Object.keys(groupedResults));
        const selectedContest = contestSelect.value || Object.keys(fullResults)[0];
        try {
            renderPodium(selectedContest);
            renderResultsForContest(selectedContest);
        } finally {
            isLoading = false; // <<< --- SET FLAG TO FALSE AFTER RENDERING
        }
    });

    contestSelect.addEventListener('change', () => {
        const selectedContest = contestSelect.value;
        renderPodium(selectedContest);
        renderResultsForContest(selectedContest);
    });

    function populateContestSelector(contestNames) {
        const currentSelection = contestSelect.value;
        contestSelect.innerHTML = '';

        if (contestNames.length === 0) {
            contestSelect.innerHTML = '<option value="">No contests found</option>';
            return;
        }

        contestNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            contestSelect.appendChild(option);
        });

        if (contestNames.includes(currentSelection)) {
            contestSelect.value = currentSelection;
        }
    }

    function renderPodium(contestName) {
        const results = fullResults[contestName] || [];

        const sorted = [...results].sort((a, b) => parseFloat(b.total_score) - parseFloat(a.total_score));
        const top3 = [sorted[0], sorted[1], sorted[2]];

        const podiums = [
            { id: 'first', element: firstPlace, height: 230 },
            { id: 'second', element: secondPlace, height: 210 },
            { id: 'third', element: thirdPlace, height: 190 }
        ];

        const gradients = [
            'linear-gradient(to bottom, #FFD700 0%, #E6BE00 60%, #B8860B 100%)',
            'linear-gradient(to bottom, #C0C0C0 0%, #A9A9A9 60%, #707070 100%)',
            'linear-gradient(to bottom, #CD7F32 0%, #A65E2E 60%, #8B4513 100%)'
        ];

        const rankLabels = ['1st', '2nd', '3rd'];

        podiums.forEach((p, i) => {
            const candidate = top3[i];
            const prevData = previousPodium[p.id]; // Correctly get the previous data object
            
            const newId = candidate?.candidate_number || null;
            const newScore = candidate ? parseFloat(candidate.total_score || 0).toFixed(2) : '0.00';

            // YOUR ANIMATION LOGIC - UNTOUCHED
            // This runs ONLY when the candidate in the slot changes.
            if (prevData.id !== newId) {
                const oldElement = p.element;
                const prevValues = Object.values(previousPodium).map(val => val.id);

                if (prevData.id) {
                    oldElement.classList.add('fall');
                    setTimeout(() => oldElement.classList.remove('fall'), 800);
                }

                oldElement.classList.add('fade-out');

                setTimeout(() => {
                    if (candidate) {
                        oldElement.innerHTML = `
                            <img src="${candidate.image_url || '/images/placeholder.png'}" alt="${candidate.candidate_name}">
                            <div class="podium-name">#${candidate.candidate_number} ${candidate.candidate_name}</div>
                            <div class="podium-score">${newScore}</div>
                            <div class="podium-rank podium-rank-${i + 1}">${rankLabels[i]}</div>
                        `;
                        oldElement.style.background = gradients[i];
                    } else {
                        oldElement.innerHTML = `
                            <img src="/images/placeholder.png" alt="Empty">
                            <div class="podium-name">N/A</div>
                            <div class="podium-score">0.00</div>
                            <div class="podium-rank podium-rank-${i + 1}">${rankLabels[i]}</div>
                        `;
                        oldElement.style.background = '#444';
                    }

                    oldElement.classList.remove('fade-out');
                    oldElement.classList.add('fade-in');

                    const wasInPodium = prevValues.includes(newId);
                    if (!wasInPodium && newId) {
                        oldElement.classList.add('rise');
                    } else {
                        const prevIndex = prevValues.indexOf(newId);
                        if (prevIndex > i) oldElement.classList.add('rise');
                        else if (prevIndex < i && prevIndex !== -1) oldElement.classList.add('fall');
                    }

                    setTimeout(() => {
                        oldElement.classList.remove('fade-in', 'rise', 'fall');
                    }, 1600);
                }, 800);
            } 
            // --- THIS IS THE NEW CODE ---
            // This runs ONLY when the candidate is the same, but the score is different.
            else if (prevData.id === newId && prevData.score !== newScore) {
                const scoreElement = p.element.querySelector('.podium-score');
                if (scoreElement) {
                    scoreElement.textContent = newScore;
                }
            }
            // --- END OF NEW CODE ---


            // YOUR HEIGHT TRANSITION - UNTOUCHED
            requestAnimationFrame(() => {
                p.element.style.height = `${p.height}px`;
            });

            // Correctly update the state with both id and score
            previousPodium[p.id] = { id: newId, score: newScore };
        });
    }



    function renderResultsForContest(contestName) {
        leaderboardTitle.textContent = `Leaderboard: ${contestName || 'No Contest Selected'}`;
        const results = fullResults[contestName];
        if (!results || results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No results yet for this contest.</td></tr>';
            return;
        }

        const oldRows = Array.from(tableBody.querySelectorAll('tr'));
        oldRows.forEach(row => {
            const id = row.dataset.id;
            if (id) rowPositions[id] = row.getBoundingClientRect().top;
        });

        results.sort((a, b) => parseFloat(b.total_score) - parseFloat(a.total_score));

        tableBody.innerHTML = '';
        results.forEach((result, index) => {
            const rank = index + 1;
            const score = result.total_score ? parseFloat(result.total_score).toFixed(2) : '0.00';
            const imageUrl = result.image_url || '/images/placeholder.png';
            const prevRank = previousRanks[result.candidate_number];
            let trendHTML = '-';

            if (prevRank) {
                const diff = prevRank - rank;
                if (diff > 0) trendHTML = `<span class="trend-up">▲ +${diff}</span>`;
                else if (diff < 0) trendHTML = `<span class="trend-down">▼ ${Math.abs(diff)}</span>`;
                else trendHTML = `<span class="trend-same">-</span>`;
            }

            const row = document.createElement('tr');
            row.dataset.id = result.candidate_number;
            row.classList.add('leaderboard-row');

            if (rank === 1) row.classList.add('gold-row');
            else if (rank === 2) row.classList.add('silver-row');
            else if (rank === 3) row.classList.add('bronze-row');

            row.innerHTML = `
                <td><span class="rank-box rank-${rank}">${rank}</span></td>
                <td>${trendHTML}</td>
                <td class="candidate-cell">
                    <div class="candidate-info">
                        <span class="candidate-name">#${result.candidate_number} - ${result.candidate_name}</span>
                        <img src="${imageUrl}" alt="${result.candidate_name}" class="candidate-photo">
                    </div>
                </td>
                <td>${score}</td>
            `;

            tableBody.appendChild(row);
            previousRanks[result.candidate_number] = rank;
        });

        // Animate row movement (FLIP)
        const newRows = Array.from(tableBody.querySelectorAll('tr'));
        newRows.forEach(row => {
            const id = row.dataset.id;
            const oldTop = rowPositions[id];
            const newTop = row.getBoundingClientRect().top;
            if (oldTop !== undefined) {
                const deltaY = oldTop - newTop;
                if (Math.abs(deltaY) > 1) {
                    row.animate([
                        { transform: `translateY(${deltaY}px) scale(1.1)`, opacity: 0.7 },
                        { transform: 'translateY(0) scale(1)', opacity: 1 }
                    ], {
                        duration: 800,
                        easing: 'ease-in-out'
                    });
                }
            }
        });
    }
});
