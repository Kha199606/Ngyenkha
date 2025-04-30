let materialGUI = null;

function showMaterialEditor(mesh, intersectPoint) {
    const mat = mesh.material;
    if (!mat || !mat.isMeshStandardMaterial) return;

    if (materialGUI) {
        materialGUI.destroy();
        materialGUI = null;
    }

    materialGUI = new dat.GUI({ width: 200 });
    materialGUI.domElement.style.position = 'fixed';
    materialGUI.domElement.style.top = '10px';
    materialGUI.domElement.style.left = '10px';
    materialGUI.domElement.style.zIndex = '9999';

    const closeObj = { close: () => {
        materialGUI.destroy();
        materialGUI = null;
    }};
    materialGUI.add(closeObj, 'close').name('❌ Đóng');

    // === Position ===
    const pos = mesh.position;
    const posFolder = materialGUI.addFolder('Vị trí');
    posFolder.add(pos, 'x', -50, 50).step(0.0001).name('X');
    posFolder.add(pos, 'y', -50, 50).step(0.0001).name('Y');
    posFolder.add(pos, 'z', -50, 50).step(0.0001).name('Z');
    posFolder.open();

    // === Rotation ===
    const rot = mesh.rotation;
    const rotFolder = materialGUI.addFolder('Xoay');
    rotFolder.add(rot, 'x', -Math.PI, Math.PI).step(0.01).name('X');
    rotFolder.add(rot, 'y', -Math.PI, Math.PI).step(0.01).name('Y');
    rotFolder.add(rot, 'z', -Math.PI, Math.PI).step(0.01).name('Z');
    rotFolder.open();

    // === Scale ===
    const scl = mesh.scale;
    const sclFolder = materialGUI.addFolder('Tỉ lệ');
    sclFolder.add(scl, 'x', 0.01, 10).step(0.01).name('X');
    sclFolder.add(scl, 'y', 0.01, 10).step(0.01).name('Y');
    sclFolder.add(scl, 'z', 0.01, 10).step(0.01).name('Z');
    sclFolder.open();

    // === Material ===
    const matFolder = materialGUI.addFolder('Vật liệu');
    matFolder.addColor({ color: '#' + mat.color.getHexString() }, 'color')
        .name('Màu')
        .onChange(v => { mat.color.set(v); mat.needsUpdate = true; });

    matFolder.add(mat, 'metalness', 0, 1).step(0.01).name('Metalness');
    matFolder.add(mat, 'roughness', 0, 1).step(0.01).name('Roughness');
    matFolder.add(mat, 'transparent').name('Transparent').onChange(() => mat.needsUpdate = true);
    matFolder.add(mat, 'opacity', 0, 1).step(0.01).name('Opacity');

    matFolder.addColor({ emissive: '#' + mat.emissive.getHexString() }, 'emissive')
        .name('Emissive')
        .onChange(v => { mat.emissive.set(v); mat.needsUpdate = true; });
    matFolder.add(mat, 'emissiveIntensity', 0, 10).step(0.1).name('Emissive Intensity');
    matFolder.open();
}


export function handleMeshClick(event, renderer, camera, model) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(model, true);
    if (intersects.length > 0) {
        showMaterialEditor(intersects[0].object, intersects[0].point);
		console.log("🔍 Mesh được chọn:", intersects[0].object);

    }
}
