(function() {
    function renderAdminSidebar() {
        const sidebarContainer = document.getElementById('admin-sidebar-container');
        if (!sidebarContainer) return;

        const currentPage = window.location.pathname;
        const user = JSON.parse(localStorage.getItem('user'));
        const openGroup = sessionStorage.getItem('sidebarOpenGroup');

        const navGroups = [
            {
                name: 'Dashboard',
                icon: '<img src="/assets/icons/dashboard.png" alt="Dashboard Icon" class="sidebar-icon">',
                links: [{ href: '/dashboard.html', text: 'Contest Dashboard' }]
            },
            {
                name: 'Management',
                icon: '<img src="/assets/icons/management.png" alt="Management Icon" class="sidebar-icon">',
                links: [
                    ...(user && user.role === 'superadmin' ? [{ href: '/manage-users.html', text: 'Manage Users' }] : []),
                    { href: '/manage-candidates.html', text: 'Manage Candidates' },
                    { href: '/manage-segments.html', text: 'Manage Segments' },
                    { href: '/manage-order.html', text: 'Order & Status' },
                    { href: '/special-scores.html', text: 'Admin-Scored Segments' },
                    { href: '/awards.html', text: 'Manage Awards' },
                ]
            },
            {
                name: 'Monitoring',
                icon: '<img src="/assets/icons/monitoring.png" alt="Monitoring Icon" class="sidebar-icon">',
                links: [
                    { href: '/monitoring.html', text: 'System Monitoring' },
                    { href: '/judging-progress.html', text: 'Judging Progress' },
                ]
            },
            {
                name: 'Results',
                icon: '<img src="/assets/icons/results.png" alt="Results Icon" class="sidebar-icon">',
                links: [
                    { href: '/results.html', text: 'Live Tabulation' },
                    { href: '/report.html', text: 'Printable Reports' },
                    { href: '/manage-scores.html', text: 'Manage Scores' },
                ]
            },
            {
                name: 'System',
                icon: '<img src="/assets/icons/system.png" alt="System Icon" class="sidebar-icon">',
                links: [
                     { href: '/backup.html', text: 'Backup & Restore' }
                ]
            }
        ];

        let linksHtml = '';
        navGroups.forEach(group => {
            const isGroupActive = group.links.some(link => currentPage.endsWith(link.href));
            

            linksHtml += `<details ${isGroupActive || openGroup === group.name ? 'open' : ''} data-group-name="${group.name}">
                <summary class="${isGroupActive ? 'active-group' : ''}">
                    ${group.icon}
                    <span>${group.name}</span>
                </summary>
                <div class="sub-links">
                    ${group.links.map(link => `<a href="${link.href}" class="${currentPage.endsWith(link.href) ? 'active' : ''}">${link.text}</a>`).join('')}
                </div>
            </details>`;
        });

        sidebarContainer.innerHTML = `
            <nav class="admin-sidebar">
                <div class="sidebar-main-nav">
                    <div class="sidebar-logo-container">
                        <img src="/Assets/dcsa-logo.png" alt="Logo" class="sidebar-logo">
                    </div>
                    <div class="sidebar-header"></div>
                    <div class="sidebar-links">${linksHtml}</div>
                </div>
                <div class="sidebar-footer">
                    <button id="logout-button">Logout</button>
                </div>
            </nav>
        `;

        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to log out?')) {
                    localStorage.clear();
                    window.location.href = '/login.html';
                }
            });
        }
        
        const detailsElements = sidebarContainer.querySelectorAll('details');
        detailsElements.forEach(details => {
            details.addEventListener('toggle', (event) => {
                const groupName = event.target.dataset.groupName;
                if (event.target.open) {
                    sessionStorage.setItem('sidebarOpenGroup', groupName);
                    detailsElements.forEach(el => {
                        if (el !== event.target) {
                            el.removeAttribute('open');
                        }
                    });
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', renderAdminSidebar);
})();