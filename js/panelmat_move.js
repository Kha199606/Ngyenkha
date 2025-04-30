    const materialPanel = document.getElementById('material-editor-panel');
    const header = materialPanel.querySelector('div'); // Chọn div đầu tiên làm header để kéo

    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - materialPanel.getBoundingClientRect().left;
        offsetY = e.clientY - materialPanel.getBoundingClientRect().top;
        materialPanel.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        materialPanel.style.left = e.clientX - offsetX + 'px';
        materialPanel.style.top = e.clientY - offsetY + 'px';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        materialPanel.style.cursor = 'grab';
    });