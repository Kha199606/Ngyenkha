function showMaterialEditor(mesh, intersectPoint) {
    const mat = mesh.material;
    if (!mat || !mat.isMeshStandardMaterial) return;

    console.log("Clicked Mesh Position:", intersectPoint);

    const colorInput = document.getElementById('material-color');
    const metalInput = document.getElementById('material-metalness');
    const roughInput = document.getElementById('material-roughness');
    const opacityInput = document.getElementById('material-opacity');
    const emissiveInput = document.getElementById('material-emissive');
	const emissiveIntensityInput = document.getElementById('material-emissive-intensity');
    const transparentInput = document.getElementById('material-transparent');
    const textureInput = document.getElementById('material-texture');
    const panel = document.getElementById('material-editor-panel');

    colorInput.value = '#' + mat.color.getHexString();
    metalInput.value = mat.metalness ?? 0.5;
    roughInput.value = mat.roughness ?? 0.5;
    opacityInput.value = mat.opacity ?? 1;
    emissiveInput.value = '#' + mat.emissive?.getHexString?.() ?? '000000';
	emissiveIntensityInput.value = mat.emissiveIntensity ?? 1;
    transparentInput.checked = mat.transparent ?? false;

    // Gán sự kiện cập nhật
    colorInput.oninput = () => { mat.color.set(colorInput.value); mat.needsUpdate = true; };
    metalInput.oninput = () => { mat.metalness = parseFloat(metalInput.value); mat.needsUpdate = true; };
    roughInput.oninput = () => { mat.roughness = parseFloat(roughInput.value); mat.needsUpdate = true; };
    opacityInput.oninput = () => { mat.opacity = parseFloat(opacityInput.value); mat.needsUpdate = true; };
    emissiveInput.oninput = () => { mat.emissive = new THREE.Color(emissiveInput.value);  mat.needsUpdate = true;};
	emissiveIntensityInput.oninput = () => { mat.emissiveIntensity = parseFloat(emissiveIntensityInput.value);    mat.needsUpdate = true;};


    panel.style.display = 'block';
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
    }
}
