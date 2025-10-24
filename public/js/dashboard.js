document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & INITIAL SETUP ---
    let selectedContestId = null;
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role === 'judge') {
        window.location.href = '/login.html'; // Redirect non-admins
        return;
    }

    document.getElementById('username-display').textContent = user.username;
    document.getElementById('role-display').textContent = user.role;
    
    // Show user management for superadmin
    if (user.role === 'superadmin') {
        document.getElementById('manage-users-section').classList.remove('hidden');
        loadUsers();
    }

    loadContests();

    // --- EVENT LISTENERS ---
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });

    // Main form submissions
    document.getElementById('add-contest-form').addEventListener('submit', handleAddContest);
    document.getElementById('add-user-form')?.addEventListener('submit', handleAddUser);
    document.getElementById('add-candidate-form').addEventListener('submit', handleAddCandidate);
    document.getElementById('add-segment-form').addEventListener('submit', handleAddSegment);
    document.getElementById('add-criteria-form').addEventListener('submit', handleAddCriterion);
    document.getElementById('criteria-segment-select').addEventListener('change', handleSegmentSelectionChange);

    // --- CONTEST SELECTION & DATA LOADING ---
    function selectContest(contestId, contestName) {
        selectedContestId = contestId;
        
        // Update UI
        document.querySelectorAll('.contest-list-item.active').forEach(item => item.classList.remove('active'));
        document.querySelector(`.contest-list-item[data-id='${contestId}']`).classList.add('active');
        document.getElementById('welcome-message').classList.add('hidden');
        document.getElementById('contest-details-section').classList.remove('hidden');
        document.getElementById('selected-contest-name').textContent = `Managing: ${contestName}`;

        // Load data for the selected contest
        loadCandidatesForContest(contestId);
        loadSegmentsForContest(contestId);
        document.getElementById('criteria-display').innerHTML = ''; // Clear criteria
        document.getElementById('criteria-segment-select').innerHTML = '<option value="">Select a segment first</option>';
    }

    async function loadContests() {
        const contests = await apiRequest('/api/contests');
        const list = document.getElementById('contests-list');
        list.innerHTML = '';
        contests.forEach(contest => {
            list.innerHTML += `
                <li class="contest-list-item" data-id="${contest.id}" data-name="${contest.name}">
                    <span>${contest.name}</span>
                    <div class="actions-cell">
                        <button class="btn-edit" data-id="${contest.id}" data-type="contest">Edit</button>
                        <button class="btn-delete" data-id="${contest.id}" data-type="contest" data-name="${contest.name}">Delete</button>
                    </div>
                </li>`;
        });
    }

    async function loadUsers() {
        const users = await apiRequest('/api/users');
        const list = document.getElementById('users-list');
        list.innerHTML = '';
        users.forEach(user => {
            list.innerHTML += `
                <li class="user-list-item">
                    <span>${user.username} (${user.role})</span>
                    <div class="actions-cell">
                        <button class="btn-edit" data-id="${user.id}" data-type="user">Edit</button>
                        <button class="btn-delete" data-id="${user.id}" data-type="user" data-name="${user.username}">Delete</button>
                    </div>
                </li>`;
        });
    }

    async function loadCandidatesForContest(contestId) {
        const candidates = await apiRequest(`/api/contests/${contestId}/candidates`);
        const tableBody = document.getElementById('candidates-table-body');
        tableBody.innerHTML = '';
        candidates.forEach(c => {
            const imageUrl = c.image_url || '/images/placeholder.png';
            tableBody.innerHTML += `<tr>
                <td><img src="${imageUrl}" alt="${c.name}"></td>
                <td>${c.candidate_number}</td><td>${c.name}</td>
                <td class="actions-cell">
                    <button class="btn-edit" data-id="${c.id}" data-type="candidate">Edit</button>
                    <button class="btn-delete" data-id="${c.id}" data-type="candidate" data-name="${c.name}">Delete</button>
                </td>
            </tr>`;
        });
    }

    async function loadSegmentsForContest(contestId) {
        const segments = await apiRequest(`/api/contests/${contestId}/segments`);
        const list = document.getElementById('segments-list');
        const select = document.getElementById('criteria-segment-select');
        const percentageBox = document.getElementById('segment-percentage-box');

        list.innerHTML = '';
        select.innerHTML = '<option value="">Select a segment first</option>';

        let totalWeight = 0;
        segments.forEach(segment => {
            totalWeight += Number(segment.percentage);
            
            const currentStatus = segment.status || 'closed';

            const isClosed = currentStatus === 'closed';
            const statusClass = isClosed ? 'status-closed' : 'status-open';
            const toggleButtonText = isClosed ? 'Open' : 'Close';
            const newStatus = isClosed ? 'open' : 'closed';

            list.innerHTML += `
                <li class="segment-list-item" data-id="${segment.id}">
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <span>${segment.name} (${segment.percentage}%)</span>
                        <span class="status-badge ${statusClass}">${currentStatus.toUpperCase()}</span>
                    </div>
                    <div class="actions-cell">
                        <button class="btn-toggle-status" data-id="${segment.id}" data-new-status="${newStatus}">${toggleButtonText}</button>
                        <button class="btn-edit" data-id="${segment.id}" data-type="segment">Edit</button>
                        <button class="btn-delete" data-id="${segment.id}" data-type="segment" data-name="${segment.name}">Delete</button>
                    </div>
                </li>`;
            select.innerHTML += `<option value="${segment.id}">${segment.name}</option>`;
        });

        percentageBox.textContent = `Total: ${totalWeight}%`;

        if (totalWeight === 100) {
            percentageBox.style.backgroundColor = '#d4edda';
            percentageBox.style.color = '#155724';
        } else {
            percentageBox.style.backgroundColor = '#f8d7da';
            percentageBox.style.color = '#721c24';
        }
    }


    async function loadCriteriaForSegment(segmentId) {
        const criteria = await apiRequest(`/api/segments/${segmentId}/criteria`);
        const display = document.getElementById('criteria-display');
        const percentageBox = document.getElementById('criteria-percentage-box');
        display.innerHTML = '';

        let totalWeight = 0; // This is where percentage display as: "Total: XX%"
        criteria.forEach(c => {
            totalWeight += Number(c.max_score);
            display.innerHTML += `
                <li class="criteria-list-item">
                    ${c.name} (${c.max_score}%)
                    <div class="actions-cell">
                        <button class="btn-edit" data-id="${c.id}" data-type="criterion">Edit</button>
                        <button class="btn-delete" data-id="${c.id}" data-type="criterium" data-name="${c.name}">Delete</button>
                    </div>
                </li>`;
        });

        percentageBox.textContent = `Total: ${totalWeight}%`;

        // Change color based on percentage
        if (totalWeight === 100) {
            percentageBox.style.backgroundColor = '#d4edda'; // light green
            percentageBox.style.color = '#155724';
        } else {
            percentageBox.style.backgroundColor = '#f8d7da'; // light red
            percentageBox.style.color = '#721c24';
        }
    }

    // --- FORM & ACTION HANDLERS ---
    async function handleAddContest(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        await apiRequest('/api/contests', 'POST', formData);
        e.target.reset();
        loadContests();
    }

    async function handleAddUser(e) {
        e.preventDefault();
        const form = e.target;
        const body = { username: form.elements['new-username'].value, password: form.elements['new-password'].value, role: form.elements['new-role'].value };
        await apiRequest('/api/users', 'POST', body);
        form.reset();
        loadUsers();
    }
    
    async function handleAddCandidate(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        formData.append('contest_id', selectedContestId);
        await apiRequest('/api/candidates', 'POST', formData);
        e.target.reset();
        loadCandidatesForContest(selectedContestId);
    }
    
    async function handleAddSegment(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const newPercentage = parseFloat(formData.get('percentage'));

        const existingSegments = await apiRequest(`/api/contests/${selectedContestId}/segments`);
        const currentTotal = existingSegments.reduce((sum, seg) => sum + seg.percentage, 0);

        if (currentTotal + newPercentage > 100) {
            alert(`Error: Adding this segment would bring the total to ${currentTotal + newPercentage}%. The total cannot exceed 100%.`);
            return;
        }

        const body = { ...Object.fromEntries(formData.entries()), contest_id: selectedContestId };
        await apiRequest('/api/segments', 'POST', body);
        form.reset();
        loadSegmentsForContest(selectedContestId);
    }

    async function handleAddCriterion(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const body = Object.fromEntries(formData.entries());
        const segmentId = body.segment_id;
        await apiRequest('/api/criteria', 'POST', body);
        e.target.reset();
        document.getElementById('criteria-segment-select').value = segmentId;
        loadCriteriaForSegment(segmentId);
    }

    async function handleDelete(button) {
        let { id, type, name } = button.dataset;
        let apiEndpoint = '';
        
        switch(type) {
            case 'user': apiEndpoint = `/api/users/${id}`; break;
            case 'contest': apiEndpoint = `/api/contests/${id}`; break;
            case 'candidate': apiEndpoint = `/api/candidates/${id}`; break;
            case 'segment': apiEndpoint = `/api/segments/${id}`; break;
            case 'criterium': apiEndpoint = `/api/criteria/${id}`; break;
            default: return;
        }

        if (confirm(`Delete ${type} "${name}"? This is permanent.`)) {
            await apiRequest(apiEndpoint, 'DELETE');
            if (type === 'contest') {
                window.location.reload();
            } else if (type === 'user') {
                loadUsers();
            } else {
                selectContest(selectedContestId, document.getElementById('selected-contest-name').textContent.replace('Managing: ', ''));
            }
        }
    }

    // --- EDIT MODAL LOGIC ---
    const modalOverlay = document.getElementById('edit-modal-overlay');
    const modalTitle = document.getElementById('edit-modal-title');
    const editForm = document.getElementById('edit-form');
    const editFormFields = document.getElementById('edit-form-fields');
    let currentEditData = {};

    function openModal() { modalOverlay.classList.remove('hidden'); }
    function closeModal() { modalOverlay.classList.add('hidden'); }

    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-edit-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    // Event delegation for dynamically created elements
    document.body.addEventListener('click', e => {
        if (e.target.matches('.contest-list-item')) {
            selectContest(e.target.dataset.id, e.target.dataset.name);
        }
        if (e.target.matches('.btn-delete')) {
            handleDelete(e.target);
        }
        if (e.target.matches('.segment-list-item')) {
            loadCriteriaForSegment(e.target.dataset.id);
        }
        if (e.target.matches('.btn-toggle-status')) {
            handleToggleSegmentStatus(e.target);
        }
        // --- FIX: Added the missing event listener for the edit button ---
        if (e.target.matches('.btn-edit')) {
            handleEditClick(e.target);
        }
    });

    async function handleToggleSegmentStatus(button) {
        const segmentId = button.dataset.id;
        const newStatus = button.dataset.newStatus;
        
        try {
            await apiRequest(`/api/segments/${segmentId}/status`, 'PUT', { status: newStatus });
            loadSegmentsForContest(selectedContestId);
        } catch (error) {
            alert(`Failed to update segment status: ${error.message}`);
        }
    }

    async function handleEditClick(button) {
        const { id, type } = button.dataset;
        currentEditData = { id, type };

        modalTitle.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;

        try {
            let apiType = type === 'criterion' ? 'criteria' : `${type}s`;
            const data = await apiRequest(`/api/${apiType}/${id}`);
            populateEditForm(data, type);
            openModal();
        } catch (error) {
            console.error(`Failed to fetch ${type} data:`, error);
        }
    }

    function populateEditForm(data, type) {
        let fieldsHtml = '';
        const user = JSON.parse(localStorage.getItem('user'));

        switch(type) {
            case 'contest':
                fieldsHtml = `
                    <div class="form-group">
                        <label for="edit-name">Contest Name</label>
                        <input type="text" id="edit-name" name="name" value="${data.name}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-image">Update Image (Optional)</label>
                        <input type="file" id="edit-image" name="image" accept="image/*">
                        ${data.image_url ? `<img src="${data.image_url}" class="current-image-preview" alt="Current Image"><input type="hidden" name="existing_image_url" value="${data.image_url}">` : ''}
                    </div>
                `;
                break;

            case 'candidate':
                const val = (field) => data[field] || ''; 
                fieldsHtml = `
                    <div class="form-group"><label for="edit-name">Candidate Name</label><input type="text" id="edit-name" name="name" value="${val('name')}" required></div>
                    <div class="form-group"><label for="edit-candidate_number">Candidate Number</label><input type="number" id="edit-candidate_number" name="candidate_number" value="${val('candidate_number')}" required></div>
                    <div class="form-group"><label for="edit-branch">Branch</label><input type="text" id="edit-branch" name="branch" value="${val('branch')}"></div>
                    <div class="form-group"><label for="edit-course">Course</label><input type="text" id="edit-course" name="course" value="${val('course')}"></div>
                    <div class="form-group"><label for="edit-section">Section</label><input type="text" id="edit-section" name="section" value="${val('section')}"></div>
                    <div class="form-group"><label for="edit-year_level">Year Level</label><input type="text" id="edit-year_level" name="year_level" value="${val('year_level')}"></div>
                    <div class="form-group"><label for="edit-image">Update Image (Optional)</label><input type="file" id="edit-image" name="image" accept="image/*">${data.image_url ? `<img src="${data.image_url}" class="current-image-preview" alt="Current Image"><input type="hidden" name="existing_image_url" value="${data.image_url}">` : ''}</div>
                `;
                break;

            case 'segment':
                fieldsHtml = `
                    <div class="form-group"><label for="edit-name">Segment Name</label><input type="text" id="edit-name" name="name" value="${data.name}" required></div>
                    <div class="form-group"><label for="edit-percentage">Percentage (%)</label><input type="number" id="edit-percentage" name="percentage" value="${data.percentage}" required></div>
                `;
                break;

            case 'criterion':
                fieldsHtml = `
                    <div class="form-group"><label for="edit-name">Criterion Name</label><input type="text" id="edit-name" name="name" value="${data.name}" required></div>
                    <div class="form-group"><label for="edit-max_score">Weight (%)</label><input type="number" id="edit-max_score" name="max_score" value="${data.max_score}" required></div>
                `;
                break;

            case 'user':
                const isSelf = (data.id == user.id);
                fieldsHtml = `
                    <div class="form-group"><label for="edit-username">Username</label><input type="text" id="edit-username" name="username" value="${data.username}" required></div>
                    <div class="form-group"><label for="edit-role">Role</label><select id="edit-role" name="role" ${isSelf ? 'disabled' : ''}><option value="admin" ${data.role === 'admin' ? 'selected' : ''}>Admin</option><option value="judge" ${data.role === 'judge' ? 'selected' : ''}>Judge</option></select>${isSelf ? '<p style="font-size: 0.8em; color: #666;">You cannot change your own role.</p>' : ''}</div>
                    <div class="form-group"><label for="edit-password">New Password (Optional)</label><input type="password" id="edit-password" name="password" placeholder="Leave blank to keep current password"></div>
                `;
                break;
        }
        editFormFields.innerHTML = fieldsHtml;
    }

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { id, type } = currentEditData;
        
        let apiType = type === 'criterion' ? 'criteria' : `${type}s`;
        const endpoint = `/api/${apiType}/${id}`;
        
        const formData = new FormData(e.target);

        let body = (type === 'contest' || type === 'candidate') ? formData : Object.fromEntries(formData.entries());

        if (type === 'user') {
            if (!body.password) {
                delete body.password;
            }
        }

        try {
            await apiRequest(endpoint, 'PUT', body);
            closeModal();
            
            if (type === 'contest') {
                loadContests();
            } else if (type === 'user') {
                loadUsers();
            } else if (selectedContestId) {
                const selectedContestName = document.querySelector(`.contest-list-item[data-id='${selectedContestId}'] span`).textContent;
                selectContest(selectedContestId, selectedContestName);
            }

        } catch (error) {
            console.error(`Failed to update ${type}:`, error);
        }
    });

    function handleSegmentSelectionChange(e) {
        const segmentId = e.target.value;
        if (segmentId) {
            loadCriteriaForSegment(segmentId);
        } else {
            document.getElementById('criteria-display').innerHTML = '';
        }
    }
});