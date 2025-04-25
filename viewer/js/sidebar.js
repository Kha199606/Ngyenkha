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

// Khởi tạo Raycaster và Vector2 cho việc phát hiện
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Hàm xử lý khi click chuột
function onDocumentMouseClick(event) {
  // Lấy tọa độ chuột
  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Phát hiện va chạm với object trong scene
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true); // true để kiểm tra tất cả con của scene

  if (intersects.length > 0) {
    const selectedObject = intersects[0].object; // Object đầu tiên được click
    handleObjectClick(selectedObject); // Gọi hàm xử lý
  }
}

// Thêm sự kiện click vào document
document.addEventListener('click', onDocumentMouseClick, false);

// Hàm xử lý khi click vào object
function handleObjectClick(object) {
  if (object.material) {
    // Hiển thị thông tin vật liệu của object vào sidebar
    showMaterialInfo(object.material);
  } else {
    console.log('Object không có material!');
  }
}