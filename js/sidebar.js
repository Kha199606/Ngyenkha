import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import GUI from 'https://cdn.skypack.dev/lil-gui';

let selectedMesh = null;
const gui = new GUI({ width: 300, title: 'Material Editor' });
document.getElementById('gui-container').appendChild(gui.domElement);

export function updateSidebar(mesh) {
  selectedMesh = mesh;

  // Xoá toàn bộ controller và folder cũ
  gui.controllersRecursive().forEach(c => c.destroy());
  gui.foldersRecursive().forEach(f => f.destroy());

  if (!mesh || !mesh.material || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;

  const mat = mesh.material;
  const material = {
    name: mesh.name,
    baseColor: `#${mat.color.getHexString()}`,
    alpha: mat.opacity,
    alphaCutoff: mat.alphaTest || 0,
    tiling: mat.map?.repeat?.x || 1,
    metalness: mat.metalness,
    roughness: mat.roughness,
    scale: mat.normalScale?.x || 1,
    emission: `#${mat.emissive.getHexString()}`,
    emissionIntensity: mat.emissiveIntensity || 1,
  };

  gui.add(material, 'name').onChange(v => mesh.name = v);
  gui.addColor(material, 'baseColor').onChange(v => mat.color.set(v));
  gui.add(material, 'alpha', 0, 1).onChange(v => mat.opacity = v);
  gui.add(material, 'alphaCutoff', 0, 1).onChange(v => mat.alphaTest = v);
  gui.add(material, 'tiling', 0.1, 10).onChange(v => {
    ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'aoMap', 'emissiveMap'].forEach(key => {
      if (mat[key]) mat[key].repeat.set(v, v);
    });
  });
  gui.add(material, 'metalness', 0, 1).onChange(v => mat.metalness = v);
  gui.add(material, 'roughness', 0, 1).onChange(v => mat.roughness = v);
  gui.add(material, 'scale', 0, 10).onChange(v => mat.normalScale?.setScalar(v));
  gui.addColor(material, 'emission').onChange(v => mat.emissive.set(v));
  gui.add(material, 'emissionIntensity', 0, 10).onChange(v => mat.emissiveIntensity = v);

  /*// Thêm điều khiển texture
  const mapsFolder = gui.addFolder('Texture Maps');
  createTextureControl(mapsFolder, mat, 'map', 'Base Map');
  createTextureControl(mapsFolder, mat, 'normalMap', 'Normal Map');
  createTextureControl(mapsFolder, mat, 'metalnessMap', 'Metalness Map');
  createTextureControl(mapsFolder, mat, 'roughnessMap', 'Roughness Map');
  createTextureControl(mapsFolder, mat, 'aoMap', 'AO Map');
  createTextureControl(mapsFolder, mat, 'emissiveMap', 'Emissive Map');
  */
}


/*
// Hàm tạo điều khiển texture
function createTextureControl(guiFolder, mat, textureKey, labelText) {
  const obj = { dummy: '' };
  const controller = guiFolder.add(obj, 'dummy').name(labelText);

  const container = controller.domElement.parentElement;
  const img = document.createElement('img');
  img.src = mat[textureKey]?.image?.src || ''; // Đường dẫn ảnh texture
  img.style.width = '100%';
  img.style.marginTop = '4px';
  img.style.border = '1px solid #444';
  img.style.borderRadius = '4px';

  // Xoá phần input textbox mặc định
  const input = container.querySelector('input');
  if (input) input.style.display = 'none';

  // Thêm ảnh vào GUI
  container.appendChild(img);

  // Thêm nút upload ảnh
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.marginTop = '4px';
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.src = ev.target.result;
      const texture = new THREE.TextureLoader().load(ev.target.result);
      mat[textureKey] = texture;
      mat.needsUpdate = true;
    };
    reader.readAsDataURL(file);
  });
  container.appendChild(fileInput);

  // Thêm nút clear ảnh
  const clearBtn = document.createElement('button');
  clearBtn.textContent = '×';
  clearBtn.style.marginTop = '4px';
  clearBtn.onclick = () => {
    img.src = ''; // Xoá ảnh
    mat[textureKey] = null;
    mat.needsUpdate = true;
  };
  container.appendChild(clearBtn);
}
*/
