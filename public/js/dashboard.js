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

    loadContests();

    // --- EVENT LISTENERS ---
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });

    // Main form submissions
    document.getElementById('add-contest-form').addEventListener('submit', handleAddContest);

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




    // --- FORM & ACTION HANDLERS ---
    async function handleAddContest(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        await apiRequest('/api/contests', 'POST', formData);
        e.target.reset();
        loadContests();
    }
    

    async function handleDelete(button) {
        let { id, type, name } = button.dataset;
        let apiEndpoint = '';
        
        switch(type) {
            case 'contest': apiEndpoint = `/api/contests/${id}`; break;
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

    function openModal() {
        modalOverlay.classList.remove('hidden');
        document.addEventListener('keydown', handleModalKeydown);
    }
    function closeModal() {
        modalOverlay.classList.add('hidden');
        document.removeEventListener('keydown', handleModalKeydown);
    }

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
        // --- FIX: Added the missing event listener for the edit button ---
        if (e.target.matches('.btn-edit')) {
            handleEditClick(e.target);
        }
    });

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

    function handleModalKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            editForm.querySelector('button[type="submit"]').click();
        } else if (e.key === 'Escape') {
            closeModal();
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
            } else if (selectedContestId) {
                const selectedContestName = document.querySelector(`.contest-list-item[data-id='${selectedContestId}'] span`).textContent;
                selectContest(selectedContestId, selectedContestName);
            }

        } catch (error) {
            console.error(`Failed to update ${type}:`, error);
        }
    });
});