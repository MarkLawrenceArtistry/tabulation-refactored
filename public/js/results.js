document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const tableBody = document.getElementById('results-table-body');
    const contestSelect = document.getElementById('contest-leaderboard-select');
    const leaderboardTitle = document.getElementById('leaderboard-title');

    let fullResults = {}; // This will store the complete grouped results object

    const firstPlace = document.getElementById('first-place');
    const secondPlace = document.getElementById('second-place');
    const thirdPlace = document.getElementById('third-place');

    // Store previous ranks for trend calculation
    let previousRanks = {};

    socket.on('connect', () => console.log('Connected to WebSocket server!'));

    socket.on('update_results', (results) => {
        renderPodium(results);
        renderResults(results);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server.');
        tableBody.innerHTML = '<tr><td colspan="6">Disconnected. Trying to reconnect...</td></tr>';
    });

    function renderPodium(results) {
        const top3 = results.slice(0, 3);

        [firstPlace, secondPlace, thirdPlace].forEach((podium, index) => {
            const candidate = top3[index];
            if (candidate) {
                podium.innerHTML = `
                    <img src="${candidate.image_url || '/images/placeholder.png'}" alt="${candidate.name}">
                    <div>#${candidate.candidate_number} ${candidate.name}</div>
                    <div>${parseFloat(candidate.total_score).toFixed(4)}</div>
                `;
            } else {
                podium.innerHTML = '';
            }
        });
    }

    function renderResults(results) {
        tableBody.innerHTML = '';

        if (!results || results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">No results yet. Waiting for scores...</td></tr>';
            return;
        }

        results.forEach((result, index) => {
            const row = document.createElement('tr');
            const rank = index + 1;
            const score = result.total_score ? parseFloat(result.total_score).toFixed(4) : '0.0000';

            // Trend calculation
            let trendHTML = '';
            const prevRank = previousRanks[result.candidate_number];

            if (prevRank) {
                const diff = prevRank - rank;
                if (diff > 0) trendHTML = `<span class="trend-up">▲ +${diff}</span>`;
                else if (diff < 0) trendHTML = `<span class="trend-down">▼ ${Math.abs(diff)}</span>`;
                else trendHTML = `<span class="trend-same">-</span>`;
            } else {
                trendHTML = `<span class="trend-same">-</span>`;
            }

            // Star for first place
            const rankHTML = rank === 1 ? `<strong>${rank} ⭐</strong>` : `<strong>${rank}</strong>`;

            row.innerHTML = `
                <td>${rankHTML}</td>
                <td>${trendHTML}</td>
                <td><img src="${result.image_url || '/images/placeholder.png'}" alt="${result.name}" style="width:50px; border-radius:50%;"></td>
                <td>#${result.candidate_number} - ${result.name}</td>
                <td>${result.contest_name}</td>
                <td>${score}</td>
            `;

            // Add class based on rank for color-coding
            if (rank === 1) row.classList.add('rank-1');
            else if (rank === 2) row.classList.add('rank-2');
            else if (rank === 3) row.classList.add('rank-3');
            else row.classList.add(index % 2 === 0 ? 'rank-other-even' : 'rank-other-odd');

            tableBody.appendChild(row);

            // Add update animation
            setTimeout(() => row.classList.add('update-animation'), 50);
            setTimeout(() => row.classList.remove('update-animation'), 700);

            // Update previousRanks
            previousRanks[result.candidate_number] = rank;
        });
    }
});
