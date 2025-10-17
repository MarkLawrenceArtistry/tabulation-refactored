document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); 

    const tableBody = document.getElementById('results-table-body');
    const contestSelect = document.getElementById('contest-leaderboard-select');
    const leaderboardTitle = document.getElementById('leaderboard-title');

    let fullResults = {}; // This will store the complete grouped results object

    socket.on('connect', () => {
        console.log('Connected to WebSocket server!');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server.');
        tableBody.innerHTML = '<tr><td colspan="5">Disconnected. Trying to reconnect...</td></tr>';
    });

    // Listen for 'update_results' event from the server
    socket.on('update_results', (groupedResults) => {
        console.log('Received updated results:', groupedResults);
        fullResults = groupedResults;
        
        // Populate the dropdown with contest names
        populateContestSelector(Object.keys(groupedResults));

        // Render the table for the currently selected contest
        const selectedContest = contestSelect.value || Object.keys(fullResults)[0];
        renderResultsForContest(selectedContest);
    });

    // Add event listener for the dropdown
    contestSelect.addEventListener('change', () => {
        const selectedContest = contestSelect.value;
        renderResultsForContest(selectedContest);
    });

    function populateContestSelector(contestNames) {
        const currentSelection = contestSelect.value;
        contestSelect.innerHTML = ''; // Clear existing options

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

        // Try to preserve the user's selection
        if (contestNames.includes(currentSelection)) {
            contestSelect.value = currentSelection;
        }
    }

    function renderResultsForContest(contestName) {
        tableBody.innerHTML = ''; // Clear the table
        leaderboardTitle.textContent = `Leaderboard: ${contestName || 'No Contest Selected'}`;
        
        const results = fullResults[contestName];

        if (!results || results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No results yet for this contest.</td></tr>';
            return;
        }

        results.forEach((result, index) => {
            const rank = index + 1;
            const score = result.total_score ? parseFloat(result.total_score).toFixed(4) : '0.0000';
            const imageUrl = result.image_url || '/images/placeholder.png';
            
            tableBody.innerHTML += `
                <tr>
                    <td><strong>${rank}</strong></td>
                    <td><img src="${imageUrl}" alt="${result.candidate_name}" style="width: 50px; border-radius: 5px;"></td>
                    <td>#${result.candidate_number} - ${result.candidate_name}</td>
                    <td>${score}</td>
                </tr>
            `;
        });
    }
});