document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); 

    // Elements
    const tableBody = document.getElementById('results-table-body');
    const contestSelect = document.getElementById('contest-leaderboard-select');
    const leaderboardTitle = document.getElementById('leaderboard-title');
    const firstPlace = document.getElementById('first-place');
    const secondPlace = document.getElementById('second-place');
    const thirdPlace = document.getElementById('third-place');

    // Store data
    let fullResults = {};       // all contest results
    let previousRanks = {};     // candidate_number -> previous rank

    // Connection status
    socket.on('connect', () => console.log('Connected to WebSocket server!'));
    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server.');
        tableBody.innerHTML = '<tr><td colspan="5">Disconnected. Trying to reconnect...</td></tr>';
    });

    // Receive updated results
    socket.on('update_results', (groupedResults) => {
        console.log('Received updated results:', groupedResults);
        fullResults = groupedResults;

        // Populate contest selector
        populateContestSelector(Object.keys(groupedResults));

        // Render for currently selected contest or first available
        const selectedContest = contestSelect.value || Object.keys(fullResults)[0];
        renderPodium(selectedContest);
        renderResultsForContest(selectedContest);
    });

    // Contest change
    contestSelect.addEventListener('change', () => {
        const selectedContest = contestSelect.value;
        renderPodium(selectedContest);
        renderResultsForContest(selectedContest);
    });

    // Fill dropdown
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

    // Render top 3 podium for the selected contest
    function renderPodium(contestName) {
        [firstPlace, secondPlace, thirdPlace].forEach(p => p.innerHTML = '');

        const results = fullResults[contestName];
        if (!results || results.length === 0) return;

        const sorted = [...results].sort((a, b) => parseFloat(b.total_score) - parseFloat(a.total_score));
        const top3 = sorted.slice(0, 3);

        const podiumElements = [firstPlace, secondPlace, thirdPlace];
        top3.forEach((candidate, index) => {
            podiumElements[index].innerHTML = `
                <img src="${candidate.image_url || '/images/placeholder.png'}" alt="${candidate.candidate_name}">
                <div>#${candidate.candidate_number} ${candidate.candidate_name}</div>
                <div>${isNaN(parseFloat(candidate.total_score)) ? '0.00' : parseFloat(candidate.total_score).toFixed(2)}</div>
            `;
        });
    }

    // Render leaderboard table
    function renderResultsForContest(contestName) {
        tableBody.innerHTML = '';
        leaderboardTitle.textContent = `Leaderboard: ${contestName || 'No Contest Selected'}`;

        const results = fullResults[contestName];
        if (!results || results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No results yet for this contest.</td></tr>';
            return;
        }

        // Sort by score
        results.sort((a, b) => parseFloat(b.total_score) - parseFloat(a.total_score));

        results.forEach((result, index) => {
            const rank = index + 1;
            const score = result.total_score ? parseFloat(result.total_score).toFixed(2) : '0.00';
            const imageUrl = result.image_url || '/images/placeholder.png';

            // Trend logic
            let trendHTML = '-';
            const prevRank = previousRanks[result.candidate_number];
            if (prevRank) {
                const diff = prevRank - rank;
                if (diff > 0) trendHTML = `<span class="trend-up">▲ +${diff}</span>`;
                else if (diff < 0) trendHTML = `<span class="trend-down">▼ ${Math.abs(diff)}</span>`;
                else trendHTML = `<span class="trend-same">-</span>`;
            } else trendHTML = `<span class="trend-same">-</span>`;

            // Rank styling
            const rankHTML = rank === 1 ? `<strong>${rank} ⭐</strong>` : `<strong>${rank}</strong>`;

            // Build row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${rankHTML}</td>
                <td>${trendHTML}</td>
                <td><img src="${imageUrl}" alt="${result.candidate_name}" style="width:50px; border-radius:5px;"></td>
                <td>#${result.candidate_number} - ${result.candidate_name}</td>
                <td>${score}</td>
            `;

            // Add rank colors
            if (rank === 1) row.classList.add('rank-1');
            else if (rank === 2) row.classList.add('rank-2');
            else if (rank === 3) row.classList.add('rank-3');
            else row.classList.add(index % 2 === 0 ? 'rank-other-even' : 'rank-other-odd');

            // Animation
            setTimeout(() => row.classList.add('update-animation'), 50);
            setTimeout(() => row.classList.remove('update-animation'), 700);

            tableBody.appendChild(row);

            // Save rank history
            previousRanks[result.candidate_number] = rank;
        });
    }
});
