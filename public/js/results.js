document.addEventListener('DOMContentLoaded', () => {
    // Connect to the WebSocket server
    const socket = io(); // Assumes server is on the same host/port

    const tableBody = document.getElementById('results-table-body');

    socket.on('connect', () => {
        console.log('Connected to WebSocket server!');
    });

    // Listen for 'update_results' event from the server
    socket.on('update_results', (results) => {
        console.log('Received updated results:', results);
        renderResults(results);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server.');
        tableBody.innerHTML = '<tr><td colspan="5">Disconnected. Trying to reconnect...</td></tr>';
    });

    function renderResults(results) {
        tableBody.innerHTML = ''; // Clear the table

        if (!results || results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No results yet. Waiting for scores...</td></tr>';
            return;
        }

        results.forEach((result, index) => {
            const rank = index + 1;
            const score = result.total_score ? parseFloat(result.total_score).toFixed(4) : '0.0000';
            const imageUrl = result.image_url || '/images/placeholder.png';
            
            tableBody.innerHTML += `
                <tr>
                    <td><strong>${rank}</strong></td>
                    <td><img src="${imageUrl}" alt="${result.candidate_name}" style="width: 50px; border-radius: 5px;"></td>
                    <td>#${result.candidate_number} - ${result.candidate_name}</td>
                    <td>${result.contest_name}</td>
                    <td>${score}</td>
                </tr>
            `;
        });
    }
});