document.addEventListener('DOMContentLoaded', () => {
    const contestSelect = document.getElementById('contest-select');
    const orderSection = document.getElementById('order-management-section');
    const tableBody = document.getElementById('candidates-table-body');
    const saveBtn = document.getElementById('save-changes-btn');
    const openAllBtn = document.getElementById('open-all-btn');
    const closeAllBtn = document.getElementById('close-all-btn');
    
    let selectedContestId = null;

    async function populateContests() {
        const contests = await apiRequest('/api/contests');
        contests.forEach(c => contestSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    }

    async function loadCandidates(contestId) {
        if (!contestId) {
            orderSection.classList.add('hidden');
            return;
        }
        selectedContestId = contestId;
        orderSection.classList.remove('hidden');
        tableBody.innerHTML = '<tr><td colspan="6">Loading candidates...</td></tr>';
        
        const candidates = await apiRequest(`/api/contests/${contestId}/candidates`);
        tableBody.innerHTML = '';
        candidates.forEach((c, index) => {
            const displayOrder = c.display_order !== null ? c.display_order : index + 1;
            const imageUrl = c.image_url || '/images/placeholder.png';
            const row = document.createElement('tr');
            row.dataset.candidateId = c.id;
            row.innerHTML = `
                <td><input type="number" class="order-input" value="${displayOrder}" min="1"></td>
                <td><img src="${imageUrl}" alt="${c.name}"></td>
                <td>${c.candidate_number}</td>
                <td>${c.name}</td>
                <td><span class="status-badge status-${c.status}">${c.status.toUpperCase()}</span></td>
                <td class="actions-cell">
                    <button class="btn-toggle-status" data-current-status="${c.status}">${c.status === 'open' ? 'Close' : 'Open'}</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    contestSelect.addEventListener('change', () => loadCandidates(contestSelect.value));

    tableBody.addEventListener('click', async (e) => {
        if (e.target.matches('.btn-toggle-status')) {
            const button = e.target;
            const row = button.closest('tr');
            const candidateId = row.dataset.candidateId;
            const statusBadge = row.querySelector('.status-badge');
            const currentStatus = button.dataset.currentStatus;
            const newStatus = currentStatus === 'open' ? 'closed' : 'open';
            
            button.disabled = true;

            try {
                await apiRequest(`/api/candidates/${candidateId}/status`, 'PUT', { status: newStatus });
                
                button.dataset.currentStatus = newStatus;
                button.textContent = newStatus === 'open' ? 'Close' : 'Open';
                statusBadge.className = `status-badge status-${newStatus}`;
                statusBadge.textContent = newStatus.toUpperCase();
            } catch (error) {
                alert(`Error updating status: ${error.message}`);
            } finally {
                button.disabled = false;
            }
        }
    });

    saveBtn.addEventListener('click', async () => {
        const rows = tableBody.querySelectorAll('tr');
        const payload = {
            orders: Array.from(rows).map(row => ({
                id: row.dataset.candidateId,
                display_order: row.querySelector('.order-input').value
            }))
        };

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            await apiRequest('/api/candidates/batch-update-order', 'PUT', payload);
            alert('Display order saved successfully!');
            loadCandidates(selectedContestId);
        } catch (error) {
            alert(`Error saving order: ${error.message}`);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save All Changes';
        }
    });

    async function batchUpdateStatus(status) {
        if (!selectedContestId) return;
        if (!confirm(`Are you sure you want to ${status.toUpperCase()} all candidates for this contest?`)) return;
        
        try {
            await apiRequest(`/api/contests/${selectedContestId}/candidates/status`, 'PUT', { status });
            loadCandidates(selectedContestId);
        } catch (error) {
            alert(`Failed to update statuses: ${error.message}`);
        }
    }

    openAllBtn.addEventListener('click', () => batchUpdateStatus('open'));
    closeAllBtn.addEventListener('click', () => batchUpdateStatus('closed'));

    populateContests();
});