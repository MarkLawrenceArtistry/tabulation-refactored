document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'superadmin') {
        alert('Access Denied: This page is for superadmins only.');
        window.location.href = '/dashboard.html';
        return;
    }

    const addUserForm = document.getElementById('add-user-form');
    const usersTableBody = document.getElementById('users-table-body');
    const modalOverlay = document.getElementById('edit-modal-overlay');
    const modalTitle = document.getElementById('edit-modal-title');
    const editForm = document.getElementById('edit-form');
    const editFormFields = document.getElementById('edit-form-fields');
    let currentEditData = {};

    async function loadUsers() {
        try {
            const users = await apiRequest('/api/users');
            usersTableBody.innerHTML = '';
            if (users.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="3">No users found.</td></tr>';
                return;
            }
            users.forEach(user => {
                usersTableBody.innerHTML += `
                    <tr>
                        <td>${user.username}</td>
                        <td><span class="role-badge role-${user.role}">${user.role}</span></td>
                        <td class="actions-cell">
                            <button class="btn-edit" data-id="${user.id}" data-type="user">Edit</button>
                            <button class="btn-delete" data-id="${user.id}" data-type="user" data-name="${user.username}">Delete</button>
                        </td>
                    </tr>
                `;
            });
        } catch (error) {
            usersTableBody.innerHTML = '<tr><td colspan="3">Failed to load users.</td></tr>';
        }
    }

    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addUserForm);
        const body = Object.fromEntries(formData.entries());
        try {
            await apiRequest('/api/users', 'POST', body);
            addUserForm.reset();
            loadUsers();
        } catch (error) {
            alert(`Error adding user: ${error.message}`);
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
        const { id, type } = button.dataset;
        currentEditData = { id, type };
        modalTitle.textContent = `Edit User`;
        try {
            const data = await apiRequest(`/api/users/${id}`);
            populateEditForm(data);
            openModal();
        } catch (error) {
            alert(`Failed to fetch user data: ${error.message}`);
        }
    }

    function populateEditForm(data) {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const isSelf = (data.id == currentUser.id);
        const fieldsHtml = `
            <div class="form-group"><label>Username</label><input type="text" name="username" value="${data.username}" required></div>
            <div class="form-group"><label>Role</label><select name="role" ${isSelf ? 'disabled' : ''}><option value="admin" ${data.role === 'admin' ? 'selected' : ''}>Admin</option><option value="judge" ${data.role === 'judge' ? 'selected' : ''}>Judge</option></select>${isSelf ? '<p style="font-size: 0.8em; color: #aaa;">You cannot change your own role.</p>' : ''}</div>
            <div class="form-group"><label>New Password</label><input type="password" name="password" placeholder="Leave blank to keep current"></div>
        `;
        editFormFields.innerHTML = fieldsHtml;
    }

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { id, type } = currentEditData;
        const endpoint = `/api/users/${id}`;
        const formData = new FormData(e.target);
        const body = Object.fromEntries(formData.entries());
        if (!body.password) delete body.password;

        try {
            await apiRequest(endpoint, 'PUT', body);
            closeModal();
            loadUsers();
        } catch (error) {
            alert(`Failed to update user: ${error.message}`);
        }
    });

    async function handleDeleteClick(button) {
        const { id, name } = button.dataset;
        if (confirm(`Are you sure you want to delete user "${name}"? This action is permanent.`)) {
            try {
                await apiRequest(`/api/users/${id}`, 'DELETE');
                loadUsers();
            } catch (error) {
                alert(`Failed to delete user: ${error.message}`);
            }
        }
    }

    loadUsers();
});