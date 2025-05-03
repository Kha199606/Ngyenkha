(async () => {
  if (!window.annotationArray || annotationArray.length === 0) {
    alert("Không có annotation nào để export.");
    return;
  }

  annotationArray.forEach((annotation) => {
    const fileName = annotation.name.replace(/[^a-zA-Z0-9]/g, '_') + ".html";
    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${annotation.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }</style>
</head>
<body>
  <script type="module">
    import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
    import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(light);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xff5722 })
    );
    mesh.name = "${annotation.meshName}";
    mesh.position.set(${annotation.localPosition.join(', ')});
    scene.add(mesh);

    camera.position.set(${annotation.cameraPosition.x}, ${annotation.cameraPosition.y}, ${annotation.cameraPosition.z});
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(${annotation.cameraTarget.x}, ${annotation.cameraTarget.y}, ${annotation.cameraTarget.z});
    controls.update();

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>
    `.trim();

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  });

  alert("Đã xuất thành công tất cả viewer.");
})();
