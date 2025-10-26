document.addEventListener('DOMContentLoaded', () => {
    const segmentSelect = document.getElementById('segment-select');
    const gridContainer = document.getElementById('progress-grid-container');

    async function populateSegments() {
        const segments = await apiRequest('/api/segments');
        segments.filter(s => s.type === 'judge').forEach(segment => {
            segmentSelect.innerHTML += `<option value="${segment.id}">${segment.name}</option>`;
        });
    }

    async function loadProgressGrid(segmentId) {
        if (!segmentId) {
            gridContainer.innerHTML = '<p>Please select a segment to view progress.</p>';
            return;
        }
        gridContainer.innerHTML = '<p>Loading progress...</p>';
        const data = await apiRequest(`/api/admin/judging-status-by-segment?segment_id=${segmentId}`);
        renderGrid(data, segmentId);
    }
    
    function renderGrid(data, segmentId) {
        if (!data.judges || data.judges.length === 0) {
            gridContainer.innerHTML = '<p>No judges found in the system.</p>';
            return;
        }
        if (!data.candidates || data.candidates.length === 0) {
            gridContainer.innerHTML = '<p>No candidates are currently open for this segment.</p>';
            return;
        }
        
        let tableHtml = '<table class="progress-grid"><thead><tr><th>Candidate</th>';
        data.judges.forEach(judge => tableHtml += `<th>${judge.username}</th>`);
        tableHtml += '</tr></thead><tbody>';

        data.candidates.forEach(candidate => {
            tableHtml += `<tr><td>#${candidate.candidate_number} - ${candidate.name}</td>`;
            data.judges.forEach(judge => {
                const isLocked = data.lockedMap[`${judge.id}:${candidate.id}`];
                const buttonText = isLocked ? 'Unlock' : 'Pending';
                const buttonClass = isLocked ? 'status-submitted' : 'status-pending';
                const isDisabled = isLocked ? '' : 'disabled';
                const dataAttrs = isLocked ? `data-judge-id="${judge.id}" data-candidate-id="${candidate.id}" data-segment-id="${segmentId}"` : '';
                
                tableHtml += `<td class="status-cell"><button class="${buttonClass}" ${isDisabled} ${dataAttrs}>${buttonText}</button></td>`;
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        gridContainer.innerHTML = tableHtml;
    }

    segmentSelect.addEventListener('change', () => loadProgressGrid(segmentSelect.value));

    gridContainer.addEventListener('click', async (e) => {
        if (!e.target.matches('button.status-submitted')) return;
        const button = e.target;
        const { judgeId, candidateId, segmentId } = button.dataset;

        if (confirm('Are you sure you want to unlock this candidate for this judge? Their previous scores will be deleted.')) {
            button.disabled = true;
            button.textContent = 'Unlocking...';
            await apiRequest('/api/admin/unlock-scores-for-candidate', 'DELETE', { judge_id: judgeId, candidate_id: candidateId, segment_id: segmentId });
            loadProgressGrid(segmentSelect.value);
        }
    });

    const reloadGrid = () => {
        if (segmentSelect.value) {
            loadProgressGrid(segmentSelect.value);
        }
    };

    window.socket.on('judging_progress_updated', reloadGrid);
    window.socket.on('candidate_status_changed', reloadGrid);

    populateSegments();
});