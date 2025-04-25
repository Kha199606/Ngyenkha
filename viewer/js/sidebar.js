// sidebar.js

const sidebar = document.getElementById('sidebar');
const closeBtn = document.createElement('div');
closeBtn.className = 'close-btn';
closeBtn.innerText = '×'; // Dấu đóng
sidebar.appendChild(closeBtn);

// Xử lý ẩn sidebar khi nhấn nút đóng
closeBtn.addEventListener('click', () => {
  sidebar.style.display = 'none';
});
