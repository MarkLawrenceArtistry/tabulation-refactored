function showModal({ title, message, confirmText = 'OK', cancelText = null, type = 'info' }) {
    return new Promise(resolve => {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay-custom';

        let footerButtons = `<button class="modal-btn-confirm">${confirmText}</button>`;
        if (cancelText) {
            footerButtons = `<button class="modal-btn-cancel">${cancelText}</button>` + footerButtons;
        }

        modalOverlay.innerHTML = `
            <div class="modal-content-custom">
                <div class="modal-header-custom modal-type-${type}">
                    <h2>${title}</h2>
                </div>
                <div class="modal-body-custom">
                    <p>${message}</p>
                </div>
                <div class="modal-footer-custom">
                    ${footerButtons}
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        const confirmBtn = modalOverlay.querySelector('.modal-btn-confirm');
        const cancelBtn = modalOverlay.querySelector('.modal-btn-cancel');
        const modalContent = modalOverlay.querySelector('.modal-content-custom');
        
        setTimeout(() => modalOverlay.classList.add('visible'), 10);

        const closeModal = (value) => {
            modalOverlay.classList.remove('visible');
            modalOverlay.addEventListener('transitionend', () => {
                document.body.removeChild(modalOverlay);
                resolve(value);
            }, { once: true });
        };

        confirmBtn.addEventListener('click', () => closeModal(true));
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => closeModal(false));
        }
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal(false);
            }
        });
    });
}

window.showAlert = async (title, message, type = 'error') => {
    await showModal({ title, message, type });
};

window.showConfirm = async (title, message, type = 'warning') => {
    return await showModal({ title, message, cancelText: 'Cancel', type });
};