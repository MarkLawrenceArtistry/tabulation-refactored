document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role === 'judge') {
        window.location.href = '/login.html';
        return;
    }

    const contestSelect = document.getElementById('contest-select');
    const candidatesManagementSection = document.getElementById('candidates-management-section');
    const addCandidateForm = document.getElementById('add-candidate-form');
    const candidatesTableBody = document.getElementById('candidates-table-body');
    const candidatesListHeader = document.getElementById('candidates-list-header');
    
    const modalOverlay = document.getElementById('edit-modal-overlay');
    const editForm = document.getElementById('edit-form');
    const editFormFields = document.getElementById('edit-form-fields');

    let selectedContestId = null;
    let currentEditData = {};

    async function populateContests() {
        try {
            const contests = await apiRequest('/api/contests');
            contests.forEach(contest => {
                contestSelect.innerHTML += `<option value="${contest.id}">${contest.name}</option>`;
            });
        } catch (error) {
            console.error('Failed to populate contests', error);
        }
    }

    async function loadCandidatesForContest(contestId) {
        if (!contestId) {
            candidatesManagementSection.classList.add('hidden');
            return;
        }
        selectedContestId = contestId;
        candidatesManagementSection.classList.remove('hidden');
        const contestName = contestSelect.options[contestSelect.selectedIndex].text;
        candidatesListHeader.textContent = `Existing Candidates for ${contestName}`;
        candidatesTableBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

        try {
            const candidates = await apiRequest(`/api/contests/${contestId}/candidates`);
            candidatesTableBody.innerHTML = '';
            if (candidates.length === 0) {
                candidatesTableBody.innerHTML = '<tr><td colspan="5">No candidates found for this contest.</td></tr>';
                return;
            }
            candidates.forEach(c => {
                const imageUrl = c.image_url || '/images/placeholder.png';
                candidatesTableBody.innerHTML += `
                    <tr>
                        <td><img src="${imageUrl}" alt="${c.name}"></td>
                        <td>${c.candidate_number}</td>
                        <td>${c.name}</td>
                        <td>${c.branch || 'N/A'}</td>
                        <td class="actions-cell">
                            <button class="btn-edit" data-id="${c.id}" data-type="candidate">Edit</button>
                            <button class="btn-delete" data-id="${c.id}" data-type="candidate" data-name="${c.name}">Delete</button>
                        </td>
                    </tr>`;
            });
        } catch (error) {
            candidatesTableBody.innerHTML = '<tr><td colspan="5">Failed to load candidates.</td></tr>';
        }
    }

    contestSelect.addEventListener('change', () => {
        loadCandidatesForContest(contestSelect.value);
    });

    addCandidateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addCandidateForm);
        formData.append('contest_id', selectedContestId);
        try {
            await apiRequest('/api/candidates', 'POST', formData);
            addCandidateForm.reset();
            loadCandidatesForContest(selectedContestId);
        } catch (error) {
            alert(`Error adding candidate: ${error.message}`);
        }
    });
    
    document.body.addEventListener('click', async (e) => {
        if (e.target.matches('.btn-edit')) {
            await handleEditClick(e.target);
        }
        if (e.target.matches('.btn-delete')) {
            await handleDeleteClick(e.target);
        }
    });

    function openModal() { modalOverlay.classList.remove('hidden'); }
    function closeModal() { modalOverlay.classList.add('hidden'); }
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-edit-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    async function handleEditClick(button) {
        const { id } = button.dataset;
        currentEditData = { id, type: 'candidate' };
        try {
            const data = await apiRequest(`/api/candidates/${id}`);
            const val = (field) => data[field] || ''; 
            editFormFields.innerHTML = `
                <div class="form-group"><label>Name</label><input type="text" name="name" value="${val('name')}" required></div>
                <div class="form-group"><label>Number</label><input type="number" name="candidate_number" value="${val('candidate_number')}" required></div>
                <div class="form-group"><label>Branch</label><input type="text" name="branch" value="${val('branch')}"></div>
                <div class="form-group"><label>Course</label><input type="text" name="course" value="${val('course')}"></div>
                <div class="form-group"><label>Section</label><input type="text" name="section" value="${val('section')}"></div>
                <div class="form-group"><label>Year Level</label><input type="text" name="year_level" value="${val('year_level')}"></div>
                <div class="form-group"><label>Update Image</label><input type="file" name="image" accept="image/*">${data.image_url ? `<img src="${data.image_url}" class="current-image-preview" alt="Current Image"><input type="hidden" name="existing_image_url" value="${data.image_url}">` : ''}</div>
            `;
            openModal();
        } catch (error) {
            alert(`Failed to fetch candidate data: ${error.message}`);
        }
    }

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { id } = currentEditData;
        const formData = new FormData(editForm);
        try {
            await apiRequest(`/api/candidates/${id}`, 'PUT', formData);
            closeModal();
            loadCandidatesForContest(selectedContestId);
        } catch (error) {
            alert(`Failed to update candidate: ${error.message}`);
        }
    });
    
    async function handleDeleteClick(button) {
        const { id, name } = button.dataset;
        if (confirm(`Are you sure you want to delete candidate "${name}"? This is permanent.`)) {
            try {
                await apiRequest(`/api/candidates/${id}`, 'DELETE');
                loadCandidatesForContest(selectedContestId);
            } catch (error) {
                alert(`Failed to delete candidate: ${error.message}`);
            }
        }
    }

    populateContests();
});