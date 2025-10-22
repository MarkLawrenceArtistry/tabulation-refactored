document.addEventListener('DOMContentLoaded', () => {
    const backupBtn = document.getElementById('backup-btn');
    const restoreForm = document.getElementById('restore-form');
    const restoreFile = document.getElementById('restore-file');
    const restoreBtn = document.getElementById('restore-btn');

    // --- Backup Logic ---
    backupBtn.addEventListener('click', async () => {
        backupBtn.disabled = true;
        backupBtn.textContent = 'Generating Backup...';

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/admin/backup', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Backup failed. Server responded with an error.');
            }

            // Get the suggested filename from the response headers
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `tabulation_backup_${new Date().toISOString()}.zip`; // fallback
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch.length === 2) {
                    filename = filenameMatch[1];
                }
            }

            // Convert the response to a Blob (raw file data)
            const blob = await response.blob();

            // Create a temporary URL for the blob
            const url = window.URL.createObjectURL(blob);

            // Create a temporary link to trigger the download
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();

            // Clean up by removing the link and revoking the temporary URL
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Backup error:', error);
            alert('Could not create backup. Please check the console for errors.');
        } finally {
            backupBtn.disabled = false;
            backupBtn.textContent = 'Download Database Backup';
        }
    });

    // --- Restore Logic ---
    restoreForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!restoreFile.files || restoreFile.files.length === 0) {
            alert('Please select a backup file to restore.');
            return;
        }

        const confirmation = confirm(
            'ARE YOU ABSOLUTELY SURE?\n\n' +
            'This will permanently delete all current data and replace it with the data from your backup file. This cannot be undone.'
        );

        if (!confirmation) {
            return;
        }

        restoreBtn.disabled = true;
        restoreBtn.textContent = 'Restoring... Please Wait...';

        const formData = new FormData();
        formData.append('backupFile', restoreFile.files[0]);

        try {
            const response = await apiRequest('/api/admin/restore', 'POST', formData);
            alert(response.message); // Show success message from the server
            // The server will restart, so the page will become unresponsive.
            // The user must manually refresh after a few moments.
        } catch (error) {
            alert(`Restore failed: ${error.message}`);
            restoreBtn.disabled = false;
            restoreBtn.textContent = 'Restore System from File';
        }
    });
});