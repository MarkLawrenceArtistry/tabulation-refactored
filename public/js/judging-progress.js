document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role === 'judge') {
        window.location.href = '/login.html';
        return;
    }

    const contestSelect = document.getElementById('contest-select');
    const gridContainer = document.getElementById('progress-grid-container');
    const socket = io();

    // 1. Populate the contest dropdown
    async function populateContests() {
        try {
            const contests = await apiRequest('/api/contests');
            contests.forEach(contest => {
                const option = document.createElement('option');
                option.value = contest.id;
                option.textContent = contest.name;
                contestSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load contests:', error);
        }
    }

    // 2. Fetch data and render the grid
    async function loadProgressGrid(contestId) {
        if (!contestId) {
            gridContainer.innerHTML = '<p>Please select a contest to view the progress.</p>';
            return;
        }

        gridContainer.innerHTML = '<p>Loading progress...</p>';

        try {
            const statusData = await apiRequest(`/api/admin/judging-status?contest_id=${contestId}`);
            if (statusData.length === 0) {
                gridContainer.innerHTML = '<p>No segments or judges found for this contest.</p>';
                return;
            }
            renderGrid(statusData);
        } catch (error) {
            gridContainer.innerHTML = '<p>Failed to load judging progress.</p>';
        }
    }
    
    // 3. Helper function to pivot data and build the HTML table
    function renderGrid(data) {
        const judges = [...new Set(data.map(item => item.judge_name))].sort();
        const segments = {};

        // Group data by segment
        data.forEach(item => {
            if (!segments[item.segment_name]) {
                segments[item.segment_name] = {};
            }
            segments[item.segment_name][item.judge_name] = item.is_submitted;
        });

        let tableHtml = '<table class="progress-grid"><thead><tr><th>Segment</th>';
        judges.forEach(judge => {
            tableHtml += `<th>${judge}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        for (const segmentName in segments) {
            tableHtml += `<tr><td>${segmentName}</td>`;
            judges.forEach(judge => {
                const isSubmitted = segments[segmentName][judge];
                const statusClass = isSubmitted ? 'status-submitted' : 'status-pending';
                const statusText = isSubmitted ? 'Submitted' : 'Pending';
                tableHtml += `<td><span class="status-cell ${statusClass}">${statusText}</span></td>`;
            });
            tableHtml += '</tr>';
        }

        tableHtml += '</tbody></table>';
        gridContainer.innerHTML = tableHtml;
    }

    // --- EVENT LISTENERS ---
    contestSelect.addEventListener('change', () => {
        loadProgressGrid(contestSelect.value);
    });

    // Listen for real-time updates
    socket.on('update_results', () => {
        const selectedContestId = contestSelect.value;
        if (selectedContestId) {
            // Briefly highlight the container to show an update happened
            gridContainer.style.transition = 'none';
            gridContainer.style.backgroundColor = 'rgba(201, 163, 116, 0.2)';
            setTimeout(() => {
                gridContainer.style.transition = 'background-color 0.5s ease';
                gridContainer.style.backgroundColor = 'transparent';
            }, 100);

            // Reload the grid to show the new status
            loadProgressGrid(selectedContestId);
        }
    });

    // --- INITIALIZATION ---
    populateContests();
});