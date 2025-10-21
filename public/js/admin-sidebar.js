/* =================================================== */
/* FILE: public/js/admin-sidebar.js (MODIFIED)       */
/* =================================================== */

(function() {
    function renderAdminSidebar() {
        const sidebarContainer = document.getElementById('admin-sidebar-container');
        if (!sidebarContainer) return;

        const currentPage = window.location.pathname;

        const navLinks = [
            { href: '/dashboard.html', text: 'Dashboard' },
            { href: '/judging-progress.html', text: 'Judging Progress' },
            { href: '/manage-scores.html', text: 'Manage Scores' },
            { href: '/results.html', text: 'Live Tabulation' }
        ];

        const linksHtml = navLinks.map(link => `
            <a href="${link.href}" class="${currentPage.endsWith(link.href) ? 'active' : ''}">
                ${link.text}
            </a>
        `).join('');

        // The complete sidebar HTML structure, now with logo and footer
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

        // The logout logic is now self-contained within the sidebar component
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