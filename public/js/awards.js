document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & ELEMENTS ---
    const createAwardForm = document.getElementById('create-award-form');
    const assignWinnerForm = document.getElementById('assign-winner-form');
    const contestSelect = document.getElementById('contest-select');
    const awardSelect = document.getElementById('award-select');
    const candidateSelect = document.getElementById('candidate-select');
    const awardsList = document.getElementById('awards-list');
    const winnersTableBody = document.getElementById('winners-table-body');

    // --- INITIAL DATA LOADING ---
    async function initializePage() {
        // Use Promise.all to fetch data concurrently for faster loading
        const [contests, awards, winners] = await Promise.all([
            apiRequest('/api/contests'),
            apiRequest('/api/awards'),
            apiRequest('/api/public-winners') // This endpoint is fine for getting all winners
        ]);
        
        populateContestSelect(contests);
        populateAwards(awards);
        populateWinnersTable(winners);
    }

    // --- POPULATION & RENDERING FUNCTIONS ---
    function populateContestSelect(contests) {
        contestSelect.innerHTML = '<option value="">-- Select a Contest --</option>';
        contests.forEach(c => {
            contestSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }

    function populateAwards(awards) {
        awardsList.innerHTML = '';
        awardSelect.innerHTML = '<option value="">-- Select an Award --</option>';
        awards.forEach(a => {
            awardsList.innerHTML += `
                <li>
                    <span>${a.name} (${a.type})</span>
                    <button class="btn-delete" data-id="${a.id}" data-type="award" data-name="${a.name}">Delete</button>
                </li>
            `;
            awardSelect.innerHTML += `<option value="${a.id}">${a.name}</option>`;
        });
    }

    function populateWinnersTable(winners) {
        winnersTableBody.innerHTML = '';
        if (winners.length === 0) {
            winnersTableBody.innerHTML = '<tr><td colspan="4">No winners assigned yet.</td></tr>';
            return;
        }
        winners.forEach(w => {
            // Note: The public-winners endpoint doesn't give us the IDs needed for deletion.
            // This is a simplified display. A full implementation might need another endpoint.
            winnersTableBody.innerHTML += `
                <tr>
                    <td>-</td> <!-- Contest name is not in public-winners endpoint -->
                    <td>${w.award_name}</td>
                    <td>${w.candidate_name}</td>
                    <td><button class="btn-delete" data-award-id="${w.award_id}" data-candidate-id="${w.candidate_id}" data-type="winner" disabled>Delete</button></td>
                </tr>
            `;
        });
    }

    async function populateCandidateSelect(contestId) {
        if (!contestId) {
            candidateSelect.innerHTML = '<option value="">-- Select a Contest First --</option>';
            return;
        }
        const candidates = await apiRequest(`/api/contests/${contestId}/candidates`);
        candidateSelect.innerHTML = '<option value="">-- Select a Candidate --</option>';
        candidates.forEach(c => {
            candidateSelect.innerHTML += `<option value="${c.id}">#${c.candidate_number} - ${c.name}</option>`;
        });
    }

    // --- EVENT LISTENERS ---
    createAwardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(createAwardForm);
        const body = Object.fromEntries(formData.entries());
        try {
            await apiRequest('/api/awards', 'POST', body);
            createAwardForm.reset();
            const newAwards = await apiRequest('/api/awards');
            populateAwards(newAwards);
        } catch (error) {
            alert(`Error creating award: ${error.message}`);
        }
    });

    assignWinnerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(assignWinnerForm);
        const body = Object.fromEntries(formData.entries());
        try {
            await apiRequest('/api/award-winners', 'POST', body);
            assignWinnerForm.reset();
            candidateSelect.innerHTML = '<option value="">-- Select a Contest First --</option>';
            const newWinners = await apiRequest('/api/public-winners');
            populateWinnersTable(newWinners);
        } catch (error) {
            alert(`Error assigning winner: ${error.message}`);
        }
    });

    contestSelect.addEventListener('change', () => {
        populateCandidateSelect(contestSelect.value);
    });

    // Event Delegation for Delete buttons
    document.body.addEventListener('click', async (e) => {
        if (e.target.matches('button.btn-delete')) {
            const { id, type, name } = e.target.dataset;
            if (type === 'award') {
                if (confirm(`Are you sure you want to delete the award "${name}"? This will also un-assign it from any winner.`)) {
                    await apiRequest(`/api/awards/${id}`, 'DELETE');
                    initializePage(); // Re-load everything
                }
            }
            // Note: Deleting assigned winners is complex and would require backend changes.
            // We've disabled the button for now.
        }
    });

    // --- INITIALIZE ---
    initializePage();
});