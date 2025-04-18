document.addEventListener('DOMContentLoaded', () => {
    const loadFilesButton = document.getElementById('load-files-button');
    
    // Danh sách các tệp cần tải
    const filesToLoad = [
        'assets/file1.txt',
        'assets/file2.json',
        'assets/image1.png'
    ];

    // Hàm tải tệp
    function loadFiles() {
        filesToLoad.forEach(filePath => {
            fetch(filePath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Could not load file: ${filePath}`);
                    }
                    return response.blob();
                })
                .then(blob => {
                    // Tùy chỉnh xử lý tệp (hiển thị, phân tích, v.v.)
                    console.log(`Loaded file: ${filePath}`, blob);
                })
                .catch(error => {
                    console.error(error);
                });
        });
    }

    // Gắn sự kiện cho nút bấm
    loadFilesButton.addEventListener('click', loadFiles);
});