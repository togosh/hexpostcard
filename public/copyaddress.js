function copyAddress(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        // Modern approach
        navigator.clipboard.writeText(text)
            .then(() => {
                showCopiedNotification();
            })
            .catch(err => {
                console.error('Clipboard error:', err);
                fallbackCopyText(text);
            });
    } else {
        // Fallback for non-HTTPS or old browsers
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        document.execCommand('copy');
        showCopiedNotification();
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textarea);
}

function showCopiedNotification() {
    const notification = document.getElementById('copy-success');
    notification.classList.add('copy-notification');

    setTimeout(() => {
        notification.classList.remove('copy-notification');
    }, 2500);
}
