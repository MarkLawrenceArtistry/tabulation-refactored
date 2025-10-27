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
        
        // --- Keyboard event handler ---
        const handleKeyDown = (e) => {
            // 'Enter' confirms the action
            if (e.key === 'Enter') {
                e.preventDefault();
                closeModal(true);
            }
            // 'Escape' cancels the action
            if (e.key === 'Escape') {
                e.preventDefault();
                // If there's a cancel button, resolve as false, otherwise resolve as true (for simple alerts)
                closeModal(cancelBtn ? false : true);
            }
        };

        const closeModal = (value) => {
            // IMPORTANT: Remove the event listener to prevent memory leaks
            document.removeEventListener('keydown', handleKeyDown);
            
            modalOverlay.classList.remove('visible');
            modalOverlay.addEventListener('transitionend', () => {
                if (document.body.contains(modalOverlay)) {
                    document.body.removeChild(modalOverlay);
                }
                resolve(value);
            }, { once: true });
        };

        confirmBtn.addEventListener('click', () => closeModal(true));
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => closeModal(false));
        }
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal(cancelBtn ? false : true);
            }
        });

        // Add the listener when the modal is shown
        document.addEventListener('keydown', handleKeyDown);
        
        setTimeout(() => modalOverlay.classList.add('visible'), 10);
    });
}

window.showAlert = async (title, message, type = 'error') => {
    await showModal({ title, message, type });
};

window.showConfirm = async (title, message, type = 'warning') => {
    return await showModal({ title, message, cancelText: 'Cancel', type });
};