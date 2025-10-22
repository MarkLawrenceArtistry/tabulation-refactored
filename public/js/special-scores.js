document.addEventListener('DOMContentLoaded', () => {
    const contestSelect = document.getElementById('contest-select');
    const tableContainer = document.getElementById('scores-table-container');
    const scoresTable = document.getElementById('scores-table');
    const scoresForm = document.getElementById('scores-form');

    async function populateContests() {
        const contests = await apiRequest('/api/contests');
        contests.forEach(c => {
            contestSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }

    async function loadScoresForContest(contestId) {
        if (!contestId) {
            tableContainer.classList.add('hidden');
            return;
        }
        
        const data = await apiRequest(`/api/admin/special-scores?contest_id=${contestId}`);
        if (data.length === 0) {
            tableContainer.classList.add('hidden');
            alert('No admin-scored segments found for this contest.');
            return;
        }

        renderTable(data);
        tableContainer.classList.remove('hidden');
    }

    function renderTable(data) {
        const segments = [...new Map(data.map(item => [item.segment_id, {id: item.segment_id, name: item.segment_name}])).values()];
        const candidates = [...new Map(data.map(item => [item.candidate_id, {id: item.candidate_id, name: item.candidate_name, number: item.candidate_number}])).values()];

        let thead = `<thead><tr><th>Candidate</th>`;
        segments.forEach(s => thead += `<th>${s.name}</th>`);
        thead += `</tr></thead>`;

        let tbody = '<tbody>';
        candidates.forEach(c => {
            tbody += `<tr><td>#${c.number} - ${c.name}</td>`;
            segments.forEach(s => {
                const scoreData = data.find(d => d.candidate_id === c.id && d.segment_id === s.id);
                const scoreValue = scoreData && scoreData.score !== null ? scoreData.score : '';
                tbody += `<td><input type="number" class="score-input" min="0" max="100" step="0.01" placeholder="0-100" 
                    value="${scoreValue}" 
                    data-candidate-id="${c.id}" 
                    data-segment-id="${s.id}"></td>`;
            });
            tbody += `</tr>`;
        });
        tbody += `</tbody>`;

        scoresTable.innerHTML = thead + tbody;
    }

    contestSelect.addEventListener('change', () => loadScoresForContest(contestSelect.value));

    scoresForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputs = scoresForm.querySelectorAll('.score-input');
        const scoresPayload = [];
        inputs.forEach(input => {
            if (input.value.trim() !== '') {
                scoresPayload.push({
                    candidate_id: input.dataset.candidateId,
                    segment_id: input.dataset.segmentId,
                    score: input.value
                });
            }
        });

        try {
            await apiRequest('/api/admin/special-scores', 'POST', {
                scores: scoresPayload,
                contest_id: contestSelect.value
            });
            alert('Scores saved successfully!');
        } catch (error) {
            alert(`Error saving scores: ${error.message}`);
        }
    });

    populateContests();
});