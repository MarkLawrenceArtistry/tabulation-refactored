document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('username-display').textContent = user.username;
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    const contestId = urlParams.get('contest');
    let isLoading = false;

    if (!contestId) {
        alert('No contest selected.');
        window.location.href = '/judge-dashboard.html';
        return;
    }

    // --- MAIN FUNCTION TO LOAD AND RENDER SEGMENTS ---
    async function loadSegments() {
        if (isLoading) {
            console.log("Load already in progress. Skipping redundant call.");
            return;
        }
        isLoading = true;

        try {
            // This now calls our new, more powerful endpoint
            const segments = await apiRequest(`/api/judging/contests/${contestId}/segments`);
            const container = document.getElementById('segments-container');
            container.innerHTML = '';
            
            // Get contest name for the header
            const allContests = await apiRequest('/api/contests');
            const currentContest = allContests.find(c => c.id == contestId);
            if(currentContest) {
                document.getElementById('contest-name-header').textContent = `Contest: ${currentContest.name}`;
            }

            if (segments.length === 0) {
                container.innerHTML = '<p class="card">There are no segments for this contest.</p>';
                return;
            }

            segments.forEach(segment => {
                const card = document.createElement('div');
                card.className = 'segment-card';
                
                let buttonHtml = '';
                // Check the is_judged flag to decide which button to show
                if (segment.is_judged) {
                    buttonHtml = `<a href="/view-scores.html?contest=${contestId}&segment=${segment.id}&segmentName=${encodeURIComponent(segment.name)}" class="judge-now-btn after">View Submitted Scores</a>`;
                } else {
                    buttonHtml = `<a href="/judging-sheet.html?contest=${contestId}&segment=${segment.id}" class="judge-now-btn before">Judge Now &rarr;</a>`;
                }

                card.innerHTML = `
                    <h3>${segment.name}</h3>
                    <p>Overall Weight: ${segment.percentage}%</p>
                    ${buttonHtml}
                `;
                container.appendChild(card);
            });
        } catch (error) {
            document.getElementById('segments-container').innerHTML = '<p class="card">Error loading segments.</p>';
        } finally {
            // <<< --- NEW: IMPORTANT! Always set the flag back to false when done.
            isLoading = false;
        }
    }

    // --- REAL-TIME UPDATE LOGIC ---
    const socket = io();

    socket.on('connect', () => console.log('✅ Connected to WebSocket server'));

    // Listen for the 'update_results' event from the server.
    // This event is our general signal that "something has changed".
    socket.on('update_results', () => {
        console.log('Received update from server. Refreshing segment status...');
        loadSegments(); // Re-run the function to get the latest status
    });


    // --- INITIALIZATION ---
    // Load segments when the page first opens
    loadSegments();
});