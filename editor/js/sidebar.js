import * as THREE from 'three'; // Đảm bảo three được map đúng trong importmap
import TextureUI from './ui/TextureUI.js'; // Sửa đường dẫn nếu cần

// --- Module Scope Variables ---
let selectedMesh = null;
let controlKit = null;
let materialPanel = null; // Panel cố định
const guiContainer = document.getElementById('gui-container');

// Cấu hình UI, đồng bộ với material được chọn
const materialConfig = {
    name: '',
    baseColor: '#ffffff',
    alpha: 1,
    alphaCutoff: 0,
    tiling: 1,
    metalness: 0.5,
    roughness: 0.5,
    scale: 1, // Normal scale
    emission: '#000000',
    emissionIntensity: 0,

    // Các texture map - Giá trị sẽ là blob URL, tên texture, hoặc 'none'
    map: 'none',
    normalMap: 'none',
    metalnessMap: 'none',
    roughnessMap: 'none',
    aoMap: 'none',
    emissiveMap: 'none',

    // Ranges & Steps for Controls
    $alphaRange: [0, 1],
    $alphaCutoffRange: [0, 1],
    $tilingRange: [0.01, 10],
    $tilingStep: 0.1,
    $metalnessRange: [0, 1],
    $roughnessRange: [0, 1],
    $scaleRange: [0, 10],
    $scaleStep: 0.1,
    $emissionIntensityRange: [0, 10],
    $emissionIntensityStep: 0.1,
};

// Map để lưu tên file gốc từ Blob URL do TextureUI tạo ra
let blobUrlToFileName = {};

// --- Helper Functions & Callbacks ---

/**
 * Cập nhật các thuộc tính vật liệu non-texture từ materialConfig.
 * Được gọi bởi onChange của các control không phải texture.
 */
function updateMaterial() {
    if (!selectedMesh || !selectedMesh.material || !(selectedMesh.material instanceof THREE.MeshStandardMaterial)) {
        console.warn("updateMaterial cancelled: No valid mesh selected.");
        return;
    }
    const mat = selectedMesh.material;
    console.log("Updating non-texture material properties for:", selectedMesh.name);

    mat.color.set(materialConfig.baseColor);
    mat.opacity = materialConfig.alpha;
    mat.transparent = materialConfig.alpha < 1.0;
    mat.alphaTest = materialConfig.alphaCutoff;
    mat.metalness = materialConfig.metalness;
    mat.roughness = materialConfig.roughness;
    mat.emissive.set(materialConfig.emission);
    mat.emissiveIntensity = materialConfig.emissionIntensity;

    if (mat.normalScale instanceof THREE.Vector2) {
        mat.normalScale.setScalar(materialConfig.scale);
    }

    // Cập nhật tiling cho CÁC texture hiện có trên material
    const v = materialConfig.tiling;
    ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'aoMap', 'emissiveMap'].forEach(key => {
        if (mat[key] instanceof THREE.Texture) {
            mat[key].repeat.set(v, v);
            mat[key].needsUpdate = true;
        }
    });

    mat.needsUpdate = true; // Đảm bảo shader được cập nhật
}

/**
 * Callback được gọi bởi TextureUI khi texture thay đổi (upload/clear).
 * Cập nhật materialConfig và material thật.
 * @param {string} mapType Loại map ('map', 'normalMap', v.v.)
 * @param {File | null} file File ảnh được chọn (hoặc null nếu xóa)
 * @param {string} url Blob URL được tạo bởi TextureUI (hoặc 'none' nếu xóa)
 */
function changeTexture(mapType, file, url) {
    console.log(`changeTexture called for ${mapType}:`, { file: file ? file.name : null, url });
    if (!selectedMesh || !selectedMesh.material || !(selectedMesh.material instanceof THREE.MeshStandardMaterial)) {
        console.warn("Cannot change texture, no valid mesh selected.");
        if(materialConfig[mapType] !== 'none') {
             materialConfig[mapType] = 'none';
             if (controlKit) controlKit.update();
        }
        return;
    }
    const mat = selectedMesh.material;

    // --- Xử lý xóa texture ---
    if (url === 'none') {
        console.log(`Processing clear for ${mapType}`);
        materialConfig[mapType] = 'none'; // Cập nhật config UI

        if (mat[mapType] instanceof THREE.Texture) {
            const textureName = mat[mapType].name;
            console.log(`Disposing old ${mapType} texture: ${textureName}`);
            const oldUrl = Object.keys(blobUrlToFileName).find(key => blobUrlToFileName[key] === textureName);
            if (oldUrl) {
                 console.log("Deleting old blob URL mapping:", oldUrl);
                 delete blobUrlToFileName[oldUrl];
                 // Có thể thu hồi URL nếu cần: URL.revokeObjectURL(oldUrl);
            }
            mat[mapType].dispose();
            mat[mapType] = null;
            mat.needsUpdate = true;
        } else {
            if (mat[mapType] !== null) { // Đảm bảo là null
                 mat[mapType] = null;
                 mat.needsUpdate = true;
            }
        }
        console.log(`${mapType} cleared from material and config.`);
        if (controlKit) controlKit.update();
        return;
    }

    // --- Xử lý tải texture mới (url là blob URL) ---
    if (file && url && url.startsWith('blob:')) {
         console.log(`Processing new texture for ${mapType}: ${file.name}`);
        materialConfig[mapType] = url; // Cập nhật config UI
        blobUrlToFileName[url] = file.name; // Lưu mapping mới
        console.log("Saved blob URL mapping:", url, "->", file.name);

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            url,
            (texture) => { // onLoad
                texture.name = file.name;
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(materialConfig.tiling, materialConfig.tiling);
                texture.needsUpdate = true;

                 // Dọn dẹp texture cũ trên material
                 if (mat[mapType] instanceof THREE.Texture) {
                     const oldTextureName = mat[mapType].name;
                     console.log(`Disposing old ${mapType} texture: ${oldTextureName}`);
                     const oldUrl = Object.keys(blobUrlToFileName).find(key => blobUrlToFileName[key] === oldTextureName);
                     if (oldUrl && oldUrl !== url) {
                          console.log("Deleting old blob URL mapping during replacement:", oldUrl);
                          delete blobUrlToFileName[oldUrl];
                          // URL.revokeObjectURL(oldUrl);
                     }
                     mat[mapType].dispose();
                 }

                mat[mapType] = texture;
                mat.needsUpdate = true;
                console.log(`Successfully loaded and applied ${mapType}: ${file.name} to material.`);

                // Không cần gọi controlKit.update() ở đây nữa vì onChange của TextureUI
                // thường đã trigger update cho chính nó rồi.

            },
            undefined, // onProgress
            (err) => { // onError
                console.error(`Error loading texture for ${mapType} from blob URL ${url}:`, err);
                alert(`Failed to load texture: ${file.name}`);
                materialConfig[mapType] = 'none'; // Rollback config
                delete blobUrlToFileName[url]; // Xóa mapping lỗi
                if (controlKit) controlKit.update(); // Cập nhật UI
            }
        );
    } else {
        console.error("Invalid file or URL received in changeTexture:", {fileName: file ? file.name : 'no file', url});
        materialConfig[mapType] = 'none'; // Rollback
        if (controlKit) controlKit.update();
    }
}

/**
 * Callback được gọi bởi TextureUI để lấy tên file hiển thị từ giá trị trong materialConfig.
 * @param {string} value Giá trị từ materialConfig[mapType] (blob URL, tên texture, hoặc 'none')
 * @returns {string} Tên file hoặc chuỗi mô tả.
 */
function getTextureFileName(value) {
    if (!value || value === 'none') {
        return 'None';
    }
    let name = value;
    if (value.startsWith('blob:')) {
        name = blobUrlToFileName[value] || value.substring(value.lastIndexOf('/') + 1);
    }
    // Rút gọn tên hiển thị nếu quá dài
    return name.length > 30 ? name.substring(0, 27) + '...' : name;
}


/**
 * Thêm các điều khiển UI cho thuộc tính vật liệu phổ biến.
 * @param {object} panel - ControlKit panel instance.
 */
function addCommonProperties(panel) {
    console.log("Adding common properties...");
    panel.addStringOutput(materialConfig, 'name', { label: 'Name' });
    panel.addColor(materialConfig, 'baseColor', { label: 'Base Color', onChange: updateMaterial });
    panel.addSlider(materialConfig, 'alpha', '$alphaRange', { label: 'Alpha', onChange: updateMaterial });
    panel.addSlider(materialConfig, 'alphaCutoff', '$alphaCutoffRange', { label: 'Alpha Cutoff', onChange: updateMaterial });
    panel.addNumberInput(materialConfig, 'tiling', { label: 'Tiling', onChange: updateMaterial, step: materialConfig.$tilingStep, range: materialConfig.$tilingRange });

    panel.addCustomComponent(TextureUI, materialConfig, 'map', {
        label: 'Base Map',
        onChange: changeTexture.bind(null, 'map'),
        getFileName: getTextureFileName
    });
    panel.addCustomComponent(TextureUI, materialConfig, 'normalMap', {
        label: 'Normal/Bump Map',
        onChange: changeTexture.bind(null, 'normalMap'),
        getFileName: getTextureFileName
    });

    panel.addSlider(materialConfig, 'metalness', '$metalnessRange', { label: 'Metalness', onChange: updateMaterial });
    panel.addSlider(materialConfig, 'roughness', '$roughnessRange', { label: 'Roughness', onChange: updateMaterial });
}

/**
 * Thêm các điều khiển UI cho thuộc tính vật liệu ít phổ biến hơn.
 * @param {object} panel - ControlKit panel instance.
 */
function addUncommonProperties(panel) {
    console.log("Adding uncommon properties...");
    panel.addNumberInput(materialConfig, 'scale', { label: 'Normal Scale', onChange: updateMaterial, step: materialConfig.$scaleStep, range: materialConfig.$scaleRange });
    panel.addColor(materialConfig, 'emission', { label: 'Emission', onChange: updateMaterial });
    panel.addNumberInput(materialConfig, 'emissionIntensity', { label: 'Emission Intensity', onChange: updateMaterial, step: materialConfig.$emissionIntensityStep, range: materialConfig.$emissionIntensityRange });

    panel.addCustomComponent(TextureUI, materialConfig, 'metalnessMap', {
        label: 'Metalness Map',
        onChange: changeTexture.bind(null, 'metalnessMap'),
        getFileName: getTextureFileName
    });
    panel.addCustomComponent(TextureUI, materialConfig, 'roughnessMap', {
        label: 'Roughness Map',
        onChange: changeTexture.bind(null, 'roughnessMap'),
        getFileName: getTextureFileName
    });
    panel.addCustomComponent(TextureUI, materialConfig, 'aoMap', {
        label: 'AO Map',
        onChange: changeTexture.bind(null, 'aoMap'),
        getFileName: getTextureFileName
    });
    panel.addCustomComponent(TextureUI, materialConfig, 'emissiveMap', {
        label: 'Emissive Map',
        onChange: changeTexture.bind(null, 'emissiveMap'),
        getFileName: getTextureFileName
    });
}

/**
 * Initializes the ControlKit instance and the material panel *once*.
 */
function initializeMaterialPanel() {
    // Chỉ chạy một lần
    if (materialPanel) return;
    console.log("Initializing ControlKit and Material Panel (using TextureUI)...");

    // Khởi tạo ControlKit
    if (!controlKit) {
        try {
            controlKit = new ControlKit({ useExternalStyle: true, loadAndSave: false });
        } catch (e) {
            console.error("Failed to initialize ControlKit.", e);
            if (guiContainer) guiContainer.innerHTML = "Error initializing UI library.";
            return;
        }
    }

    // Tạo Panel - Thử truyền parentElement trực tiếp
    try {
         materialPanel = controlKit.addPanel({
             label: 'Material Properties',
             width: 300,
             fixed: false,
             parentElement: guiContainer // <<< THỬ LẠI CÁCH NÀY
        });
        if (!materialPanel) throw new Error("controlKit.addPanel returned null or undefined.");
        console.log("Material panel created and potentially appended via parentElement.");
    } catch (e) {
         console.error("Failed to create ControlKit panel or append via parentElement:", e);
         // Fallback: Thử tạo không có parentElement và append thủ công
         console.log("Attempting fallback: creating panel without parentElement...");
         try {
             materialPanel = controlKit.addPanel({ label: 'Material Properties', width: 300, fixed: false });
             if (!materialPanel) throw new Error("Fallback addPanel returned null.");

             let panelNode = null;
             if (materialPanel._node instanceof Node) panelNode = materialPanel._node;
             else if (typeof materialPanel.getNode === 'function') {
                 let potentialNode = materialPanel.getNode();
                 if (potentialNode instanceof Node) panelNode = potentialNode;
             }
             // Thêm các kiểm tra khác nếu cần (domElement, element, etc.)

             if (panelNode && guiContainer) {
                 guiContainer.appendChild(panelNode);
                 console.log("Fallback successful: Manually appended panel node.");
             } else {
                 throw new Error("Fallback failed: Could not find panel node or guiContainer.");
             }
         } catch (fallbackError) {
             console.error("Fallback panel creation/append also failed:", fallbackError);
             materialPanel = null; // Đánh dấu là lỗi hoàn toàn
             if (guiContainer) guiContainer.innerHTML = "Failed to create UI panel.";
             return; // Không thể tiếp tục
         }
    }


    // Thêm controls vào panel đã tạo
    addCommonProperties(materialPanel);
    addUncommonProperties(materialPanel);

    // Set Initial State
    materialPanel.disable();
    if (guiContainer) guiContainer.style.display = 'none'; // Đảm bảo container cũng ẩn
    console.log("Material Panel initialized and disabled.");
}

// --- Primary Exported Functions ---

/**
 * Updates the sidebar panel based on the selected mesh.
 * Populates UI config, updates controls, and enables/disables the panel.
 * @param {THREE.Mesh | null} mesh - The selected mesh, or null to clear/hide.
 */
export function updateSidebar(mesh) {
    console.log("updateSidebar called with mesh:", mesh ? mesh.name : 'null');

    initializeMaterialPanel(); // Đảm bảo panel được khởi tạo

    if (!materialPanel || !controlKit) {
        console.error("Cannot update sidebar: ControlKit panel not available.");
        if(guiContainer) guiContainer.style.display = 'none';
        return;
    }

    selectedMesh = mesh; // Cập nhật mesh đang chọn

    const isValidMesh = mesh && mesh.isMesh && mesh.material && mesh.material instanceof THREE.MeshStandardMaterial;

    if (isValidMesh) {
        const mat = mesh.material;
        console.log(`Updating sidebar for valid mesh: ${mesh.name}`);

        // --- 1. Populate materialConfig from the selected material (mat) ---
        materialConfig.name = mesh.name || 'Unnamed Mesh';
        materialConfig.baseColor = `#${mat.color.getHexString()}`;
        materialConfig.alpha = mat.opacity;
        materialConfig.alphaCutoff = mat.alphaTest || 0;
        materialConfig.tiling = (mat.map?.repeat?.x ?? mat.normalMap?.repeat?.x ?? 1);
        materialConfig.metalness = mat.metalness;
        materialConfig.roughness = mat.roughness;
        materialConfig.scale = mat.normalScale?.x || 1;
        materialConfig.emission = `#${mat.emissive.getHexString()}`;
        materialConfig.emissionIntensity = mat.emissiveIntensity || 0;

        // --- Populate texture status/name/URL into materialConfig ---
        console.log("Populating texture status into materialConfig...");
        ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'aoMap', 'emissiveMap'].forEach(key => {
            const texture = mat[key];
            if (texture instanceof THREE.Texture) {
                const textureName = texture.name || `[Loaded ${key}]`;
                // Ưu tiên tìm lại blob URL đã biết cho texture này
                const existingUrl = Object.keys(blobUrlToFileName).find(url => blobUrlToFileName[url] === textureName);
                if (existingUrl) {
                    materialConfig[key] = existingUrl; // Dùng blob URL để hiển thị preview
                    console.log(` > ${key}: Found existing blob URL: ${existingUrl}`);
                } else {
                    // Nếu không có blob URL (texture gốc), dùng tên để TextureUI hiển thị text
                    materialConfig[key] = textureName;
                     console.log(` > ${key}: Found texture, set config to name: "${textureName}"`);
                }
            } else {
                materialConfig[key] = 'none'; // Không có texture
                 console.log(` > ${key}: No texture found, set config to "none"`);
            }
        });

        // --- 2. Refresh ControlKit display ---
        controlKit.update();
        console.log("controlKit.update() called to refresh UI values.");

        // --- 3. Enable Panel & Show Container ---
        materialPanel.enable();
        if (guiContainer) guiContainer.style.display = 'block';
        console.log("Material panel enabled and shown.");

    } else {
        // --- Mesh is null or invalid ---
        console.log("No valid mesh selected, disabling and hiding sidebar.");
        if (materialPanel) materialPanel.disable();
        if (guiContainer) guiContainer.style.display = 'none';
        selectedMesh = null;
        // Optionally reset materialConfig here and update controlKit
    }
}

/**
 * Clears the selection and hides the sidebar panel.
 */
export function clearSidebar() {
     console.log("clearSidebar called.");
     updateSidebar(null);
}

// --- Exports (chỉ export những gì cần thiết) ---
//export { updateSidebar, clearSidebar };