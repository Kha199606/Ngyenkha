const sidebar = document.getElementById('sidebar');
const materialInfo = document.getElementById('material-info');

// Hiển thị thông tin vật liệu
function showMaterialInfo(material) {
  sidebar.style.display = 'block'; // Hiển thị sidebar
  materialInfo.innerHTML = ''; // Xóa thông tin cũ

  // Duyệt qua các thuộc tính của vật liệu và hiển thị
  Object.entries(material).forEach(([key, value]) => {
    const info = document.createElement('p');
    info.innerText = `${key}: ${value}`;
    materialInfo.appendChild(info);
  });
}

// Ẩn sidebar
function hideSidebar() {
  sidebar.style.display = 'none'; // Ẩn sidebar
}

// Lắng nghe sự kiện chọn object
document.addEventListener('click', (event) => {
  const selectedObject = getObjectFromEvent(event); // Lấy object từ sự kiện (giả lập)
  if (selectedObject && selectedObject.material) {
    showMaterialInfo(selectedObject.material);
  } else {
    hideSidebar();
  }
});

// Giả lập hàm lấy object từ sự kiện
function getObjectFromEvent(event) {
  // Tùy chỉnh theo logic của ứng dụng
  return {
    material: {
      color: '#ff0000',
      roughness: 0.8,
      metalness: 0.5,
    },
  };
}
