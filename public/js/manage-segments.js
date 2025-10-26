document.addEventListener('DOMContentLoaded', () => {
    const addSegmentForm = document.getElementById('add-segment-form');
    const addCriteriaForm = document.getElementById('add-criteria-form');
    const segmentsList = document.getElementById('segments-list');
    const criteriaSegmentSelect = document.getElementById('criteria-segment-select');
    const criteriaDisplay = document.getElementById('criteria-display');

    const modalOverlay = document.getElementById('edit-modal-overlay');
    const modalTitle = document.getElementById('edit-modal-title');
    const editForm = document.getElementById('edit-form');
    const editFormFields = document.getElementById('edit-form-fields');

    let currentEditData = {};

    async function loadSegments() {
        const segments = await apiRequest(`/api/segments`);
        const percentageBox = document.getElementById('segment-percentage-box');
        segmentsList.innerHTML = '';
        criteriaSegmentSelect.innerHTML = '<option value="">Select a segment first</option>';
        criteriaDisplay.innerHTML = '';
        document.getElementById('criteria-percentage-box').textContent = 'Total: 0%';

        let totalWeight = 0;
        segments.forEach(segment => {
            totalWeight += Number(segment.percentage);
            const statusClass = segment.status === 'closed' ? 'status-closed' : 'status-open';
            segmentsList.innerHTML += `
                <li class="segment-list-item" data-id="${segment.id}">
                    <div><span>${segment.name} (${segment.percentage}%)</span><span class="status-badge ${statusClass}">${segment.status}</span></div>
                    <div class="actions-cell">
                        <button class="btn-toggle-status" data-id="${segment.id}" data-new-status="${segment.status === 'closed' ? 'open' : 'closed'}">${segment.status === 'closed' ? 'Open' : 'Close'}</button>
                        <button class="btn-edit" data-id="${segment.id}" data-type="segment">Edit</button>
                        <button class="btn-delete" data-id="${segment.id}" data-type="segment" data-name="${segment.name}">Del</button>
                    </div>
                </li>`;
            criteriaSegmentSelect.innerHTML += `<option value="${segment.id}">${segment.name}</option>`;
        });
        percentageBox.textContent = `Total: ${totalWeight}%`;
        percentageBox.style.backgroundColor = totalWeight === 100 ? '#d4edda' : '#f8d7da';
        percentageBox.style.color = totalWeight === 100 ? '#155724' : '#721c24';
    }

    async function loadCriteriaForSegment(segmentId) {
        const criteria = await apiRequest(`/api/segments/${segmentId}/criteria`);
        const percentageBox = document.getElementById('criteria-percentage-box');
        criteriaDisplay.innerHTML = '';
        let totalWeight = 0;
        criteria.forEach(c => {
            totalWeight += Number(c.max_score);
            criteriaDisplay.innerHTML += `<li class="criteria-list-item">${c.name} (${c.max_score}%)<div class="actions-cell"><button class="btn-edit" data-id="${c.id}" data-type="criterion">Edit</button><button class="btn-delete" data-id="${c.id}" data-type="criterium" data-name="${c.name}">Del</button></div></li>`;
        });
        percentageBox.textContent = `Total: ${totalWeight}%`;
        percentageBox.style.backgroundColor = totalWeight === 100 ? '#d4edda' : '#f8d7da';
        percentageBox.style.color = totalWeight === 100 ? '#155724' : '#721c24';
    }

    criteriaSegmentSelect.addEventListener('change', (e) => e.target.value ? loadCriteriaForSegment(e.target.value) : criteriaDisplay.innerHTML = '');

    addSegmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.target).entries());
        await apiRequest('/api/segments', 'POST', body);
        e.target.reset();
        loadSegments();
    });

    addCriteriaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.target).entries());
        await apiRequest('/api/criteria', 'POST', body);
        e.target.reset();
        criteriaSegmentSelect.value = body.segment_id;
        loadCriteriaForSegment(body.segment_id);
    });
    
    document.body.addEventListener('click', async (e) => {
        if (e.target.matches('.segment-list-item')) loadCriteriaForSegment(e.target.dataset.id);
        if (e.target.matches('.btn-edit')) await handleEditClick(e.target);
        if (e.target.matches('.btn-delete')) await handleDeleteClick(e.target);
        if (e.target.matches('.btn-toggle-status')) await handleToggleStatus(e.target);
    });

    function openModal() { modalOverlay.classList.remove('hidden'); }
    function closeModal() { modalOverlay.classList.add('hidden'); }
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-edit-btn').addEventListener('click', closeModal);

    async function handleEditClick(button) {
        const { id, type } = button.dataset;
        currentEditData = { id, type };
        modalTitle.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        const apiType = type === 'criterion' ? 'criteria' : 'segments';
        const data = await apiRequest(`/api/${apiType}/${id}`);
        populateEditForm(data, type);
        openModal();
    }
    
    function populateEditForm(data, type) {
        if (type === 'segment') {
            editFormFields.innerHTML = `<div class="form-group"><label>Name</label><input type="text" name="name" value="${data.name}" required></div><div class="form-group"><label>Percentage (%)</label><input type="number" name="percentage" value="${data.percentage}" required></div>`;
        } else if (type === 'criterion') {
            editFormFields.innerHTML = `<div class="form-group"><label>Name</label><input type="text" name="name" value="${data.name}" required></div><div class="form-group"><label>Weight (%)</label><input type="number" name="max_score" value="${data.max_score}" required></div>`;
        }
    }

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { id, type } = currentEditData;
        const apiType = type === 'criterion' ? 'criteria' : 'segments';
        await apiRequest(`/api/${apiType}/${id}`, 'PUT', Object.fromEntries(new FormData(e.target).entries()));
        closeModal();
        loadSegments();
    });

    async function handleDeleteClick(button) {
        const { id, type, name } = button.dataset;
        if (!confirm(`Delete ${type} "${name}"? This is permanent.`)) return;
        const apiType = type === 'criterium' ? 'criteria' : 'segments';
        await apiRequest(`/api/${apiType}/${id}`, 'DELETE');
        loadSegments();
    }
    
    async function handleToggleStatus(button) {
        await apiRequest(`/api/segments/${button.dataset.id}/status`, 'PUT', { status: button.dataset.newStatus });
        loadSegments();
    }

    loadSegments();
});