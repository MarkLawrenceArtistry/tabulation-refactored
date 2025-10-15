document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('winners-container');
    try {
        const response = await fetch('/api/public-winners');
        if (!response.ok) throw new Error('Could not fetch winners.');
        
        const winners = await response.json();
        
        container.innerHTML = '';
        if (winners.length === 0) {
            container.innerHTML = '<p>Winners have not been announced yet.</p>';
            return;
        }

        let currentType = '';
        winners.forEach(winner => {
            if (winner.type !== currentType) {
                currentType = winner.type;
                container.innerHTML += `<h2 class="winner-type-header">${currentType.charAt(0).toUpperCase() + currentType.slice(1)} Awards</h2>`;
            }
            const imageUrl = winner.image_url || '/images/placeholder.png';
            container.innerHTML += `
                <div class="winner-card card">
                    <h3>${winner.award_name}</h3>
                    <div class="winner-details">
                        <img src="${imageUrl}" alt="${winner.candidate_name}">
                        <p>${winner.candidate_name}</p>
                    </div>
                </div>
            `;
        });

    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
});