    document.addEventListener('DOMContentLoaded', () => {
    const burger = document.getElementById('burger');
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('main');
    const header = document.querySelector('header');

    burger.addEventListener('click', () => {
        sidebar.classList.toggle('active');

        // Shift main content and header when sidebar expands
        if (sidebar.classList.contains('active')) {
            burger.style.marginLeft = '180px';
            main.style.marginLeft = '180px';
            header.style.marginLeft = '180px';
        } else {
            burger.style.marginLeft = '0px';
            main.style.marginLeft = '0px';   // collapsed sidebar width
            header.style.marginLeft = '0px'; // collapsed sidebar width
        }
    });
});

