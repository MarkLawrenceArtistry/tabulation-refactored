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
    });

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
            list.innerHTML += `<li class="contest-list-item" data-id="${contest.id}" data-name="${contest.name}">${contest.name}</li>`;
        });
    }

    async function loadUsers() {
        const users = await apiRequest('/api/users');
        const list = document.getElementById('users-list');
        list.innerHTML = '';
        users.forEach(user => {
            list.innerHTML += `<li class="user-list-item"><span>${user.username} (${user.role})</span><button class="btn-delete" data-id="${user.id}" data-type="user" data-name="${user.username}">Delete</button></li>`;
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
                <td class="actions-cell"><button class="btn-delete" data-id="${c.id}" data-type="candidate" data-name="${c.name}">Delete</button></td>
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

        let totalWeight = 0; // This is where percentage display as: "Total: XX%"
        segments.forEach(segment => {
            totalWeight += Number(segment.percentage);
            list.innerHTML += `
                <li class="segment-list-item" data-id="${segment.id}">
                    ${segment.name} (${segment.percentage}%)
                    <button class="btn-delete" data-id="${segment.id}" data-type="segment" data-name="${segment.name}">Delete</button>
                </li>`;
            select.innerHTML += `<option value="${segment.id}">${segment.name}</option>`;
        });

        percentageBox.textContent = `Total: ${totalWeight}%`;

        // Change color based on percentage
        if (totalWeight === 100) {
            percentageBox.style.backgroundColor = '#f8d7da'; // light red
            percentageBox.style.color = '#721c24';
        } else {
            percentageBox.style.backgroundColor = '#d4edda'; // light green
            percentageBox.style.color = '#155724';
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
                    <button class="btn-delete" data-id="${c.id}" data-type="criterium" data-name="${c.name}">Delete</button>
                </li>`;
        });

        percentageBox.textContent = `Total: ${totalWeight}%`;

        // Change color based on percentage
        if (totalWeight === 100) {
            percentageBox.style.backgroundColor = '#f8d7da'; // light red
            percentageBox.style.color = '#721c24';
        } else {
            percentageBox.style.backgroundColor = '#d4edda'; // light green
            percentageBox.style.color = '#155724';
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
        const formData = new FormData(e.target);
        const body = Object.fromEntries(formData.entries());
        const contestId = selectedContestId;
        body.contest_id = contestId;
        const segments = await apiRequest(`/api/contests/${contestId}/segments`);
        const totalUsed = segments.reduce((sum, seg) => sum + Number(seg.percentage), 0);
        const newPercent = Number(body.percentage);
        if (totalUsed + newPercent > 100) {
            alert(`Cannot add segment. Total percentage would exceed 100%. Currently used: ${totalUsed}%.`);
            return;
        }

        await apiRequest('/api/segments', 'POST', body);
        e.target.reset();
        loadSegmentsForContest(contestId);
    }

    async function handleAddCriterion(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const body = Object.fromEntries(formData.entries());
        const segmentId = body.segment_id;
        body.segment_id = segmentId;
        const criteria = await apiRequest(`/api/segments/${segmentId}/criteria`);
        const totalUsed = criteria.reduce((sum, c) => sum + Number(c.max_score), 0);
        const newWeight = Number(body.max_score);
        if (totalUsed + newWeight > 100) {
            alert(`Cannot add criterion. Total weight would exceed 100%. Currently used: ${totalUsed}%.`);
            return;
        }
    
        await apiRequest('/api/criteria', 'POST', body);
        e.target.reset();
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
            // Reload relevant data
            if (type === 'contest') {
                window.location.reload(); // Easiest way to reset state
            } else if (type === 'user') {
                loadUsers();
            } else {
                selectContest(selectedContestId, document.getElementById('selected-contest-name').textContent.replace('Managing: ', ''));
            }
        }
    }
});