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

        // Group data by segment, now including IDs
        data.forEach(item => {
            if (!segments[item.segment_name]) {
                segments[item.segment_name] = {
                    segment_id: item.segment_id,
                    statuses: {}
                };
            }
            segments[item.segment_name].statuses[item.judge_name] = {
                is_submitted: item.is_submitted,
                judge_id: item.judge_id
            };
        });

        let tableHtml = '<table class="progress-grid"><thead><tr><th>Segment</th>';
        judges.forEach(judge => {
            tableHtml += `<th>${judge}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        for (const segmentName in segments) {
            const segmentInfo = segments[segmentName];
            tableHtml += `<tr><td>${segmentName}</td>`;
            judges.forEach(judge => {
                const statusInfo = segmentInfo.statuses[judge];
                const isSubmitted = statusInfo.is_submitted;
                const buttonClass = isSubmitted ? 'status-submitted' : 'status-pending';
                const buttonText = isSubmitted ? 'Unlock' : 'Pending';
                const isDisabled = !isSubmitted ? 'disabled' : '';

                // Add data attributes for the unlock action
                const dataAttributes = isSubmitted ? 
                    `data-judge-id="${statusInfo.judge_id}" data-segment-id="${segmentInfo.segment_id}" data-judge-name="${judge}" data-segment-name="${segmentName}"` 
                    : '';

                tableHtml += `
                    <td class="status-cell">
                        <button class="${buttonClass}" ${isDisabled} ${dataAttributes}>
                            ${buttonText}
                        </button>
                    </td>`;
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

    gridContainer.addEventListener('click', async (e) => {
        // Target only the green "Unlock" buttons that are not disabled
        if (!e.target.matches('button.status-submitted:not(:disabled)')) {
            return;
        }

        const button = e.target;
        const { judgeId, segmentId, judgeName, segmentName } = button.dataset;

        const confirmation = confirm(
            `ARE YOU SURE?\n\n` +
            `This will UNLOCK the "${segmentName}" segment for judge "${judgeName}".\n\n` +
            `This will delete their previously submitted scores for this segment, and they will be required to submit them again. This action cannot be undone.`
        );

        if (confirmation) {
            try {
                button.disabled = true;
                button.textContent = 'Unlocking...';
                
                await apiRequest('/api/admin/unlock-scores', 'DELETE', {
                    judge_id: parseInt(judgeId, 10),
                    segment_id: parseInt(segmentId, 10)
                });
                
                // NOTE: We don't need to manually update the UI here.
                // The backend call to calculateAndEmitResults() will trigger the socket listener,
                // which automatically re-renders the whole grid with the updated state.
                
            } catch (error) {
                alert(`Failed to unlock segment: ${error.message}`);
                // Re-enable button on failure
                button.disabled = false;
                button.textContent = 'Unlock';
            }
        }
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