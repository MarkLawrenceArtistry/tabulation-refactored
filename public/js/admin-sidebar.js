(function() {
    function renderAdminSidebar() {
        const sidebarContainer = document.getElementById('admin-sidebar-container');
        if (!sidebarContainer) return;

        const currentPage = window.location.pathname;
        const user = JSON.parse(localStorage.getItem('user'));

        const navLinks = [
            { href: '/dashboard.html', text: 'Dashboard' },
            { href: '/manage-candidates.html', text: 'Manage Candidates' },
            { href: '/manage-segments.html', text: 'Manage Segments' },
            { href: '/monitoring.html', text: 'Monitoring' },
            { href: '/judging-progress.html', text: 'Judging Progress' },
            { href: '/manage-scores.html', text: 'Manage Scores' },
            { href: '/results.html', text: 'Live Tabulation' },
            { href: '/awards.html', text: 'Manage Awards' },
            { href: '/report.html', text: 'Printable Reports' },
            { href: '/backup.html', text: 'Backup & Restore' },
            { href: '/special-scores.html', text: 'Admin-Scored Segments' }
        ];

        if (user && user.role === 'superadmin') {
            navLinks.splice(1, 0, { href: '/manage-users.html', text: 'Manage Users' });
        }

        const linksHtml = navLinks.map(link => `
            <a href="${link.href}" style="text-align: left;" class="${currentPage.endsWith(link.href) ? 'active' : ''}">
                ${link.text}
            </a>
        `).join('');

        sidebarContainer.innerHTML = `
            <nav class="admin-sidebar">
                <div class="sidebar-main-nav">
                    <div class="sidebar-logo-container">
                        <img src="/Assets/dcsa-logo.png" alt="Logo" class="sidebar-logo">
                    </div>
                    <div class="sidebar-header">
                    </div>
                    <div class="sidebar-links">
                        ${linksHtml}
                    </div>
                </div>
                <div class="sidebar-footer">
                    <button id="logout-button">Logout</button>
                </div>
            </nav>
        `;

        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.clear();
                window.location.href = '/login.html';
            });
        }
    }

    document.addEventListener('DOMContentLoaded', renderAdminSidebar);
})();