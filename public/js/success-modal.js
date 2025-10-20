(function () {
  function showSuccessModal(title, message, redirectUrl, gifPath = './assets/check-animation.gif') {
    // Remove any existing modal before adding a new one
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal">
        <img src="${gifPath}" alt="Success" class="success-gif" />
        <h2 class="title">${title}</h2>
        <p class="message">${message}</p>
        <button id="ok-btn" class="primary">OK</button>
      </div>
    `;
    document.body.appendChild(modal);

    const okBtn = modal.querySelector('#ok-btn');
    const gifEl = modal.querySelector('.success-gif');
    const modalBox = modal.querySelector('.modal');

    // Restart GIF each time modal is shown
    const gifSrc = gifEl.src;
    gifEl.src = '';
    gifEl.src = gifSrc;

    // Freeze GIF after 3 seconds (capture last frame)
    setTimeout(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = gifSrc;
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        gifEl.src = canvas.toDataURL('image/png'); // freezes frame
        gifEl.classList.add('frozen');
      };
    }, 3000);

    function closeAndRedirect() {
      modalBox.style.animation = 'popOut 0.35s ease forwards';
      modal.classList.add('hide');
      setTimeout(() => {
        modal.remove();
        if (redirectUrl) window.location.href = redirectUrl;
      }, 350);
    }

    // OK button click
    okBtn.addEventListener('click', closeAndRedirect);

    // Click outside to close + redirect
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAndRedirect();
    });

    // allow pressing ESC to close + redirect
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closeAndRedirect();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  // expose to global scope
  window.showSuccessModal = showSuccessModal;
})();
