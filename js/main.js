import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js';
import { updateSidebar, clearSidebar } from './sidebar.js'; // Adjust path if needed



let scene, camera, renderer, controls, raycaster, mouse, intersectedObject;
let mixer, clock;
let animationActions = [];
let longestAction = null;
let timelineElement = document.getElementById('timeline');
let pauseResumeButton = document.getElementById('timeline-pause-resume');
let rangeSliderInstance, progressSliderInstance;
let isDraggingSlider = false;
let longestDuration = 0;
let selectedObject = null;
let previousMaterial = null;

function prettifyNumber(num) { return num.toFixed(0); }

function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 10);

    // Gán camera cho window để sử dụng ở sidebar.js
    window.camera = camera;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Khởi tạo Raycaster và Mouse
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    new RGBELoader().load('Hall.hdr', (t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = t;
        scene.environment = t;
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);

    const loader = new GLTFLoader();
    loader.load('Default_model_v2.glb', (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxD = Math.max(size.x, size.y, size.z);
        const camZ = Math.max(maxD * 1.2, Math.abs(maxD / 1.5 / Math.tan(camera.fov * Math.PI / 360)));
        camera.position.set(center.x, center.y + size.y * 0.2, center.z + camZ);
        controls.target.copy(center);
        controls.update();

        if (gltf.animations.length) {
            mixer = new THREE.AnimationMixer(model);
            animationActions = gltf.animations.map(clip => {
                const action = mixer.clipAction(clip);
                action.weight = 1;
                return action;
            });

            longestAction = animationActions.reduce((a, b) => (a._clip.duration > b._clip.duration ? a : b));
            longestDuration = longestAction._clip.duration;

            animationActions.forEach(a => a.play());
            setupTimelineControls();
        }
    });

    window.addEventListener('resize', onWindowResize);

    // Lắng nghe sự kiện chuột để xử lý raycasting
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('click', onClick, false);

    animate();
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

function onClick(event) {
    // Update raycaster before checking intersections
    raycaster.setFromCamera(mouse, camera);

    // Check for intersections
    if (scene.children && scene.children.length > 0) {
        const intersects = raycaster.intersectObjects(scene.children, true); // true for recursive

        if (intersects.length > 0) {
            // Find the first visible Mesh ancestor
            let intersectedMesh = null;
            for (let i = 0; i < intersects.length; i++) {
                let obj = intersects[i].object;
                while (obj) {
                    if (obj.isMesh && obj.visible) {
                         intersectedMesh = obj;
                         break; // Found the mesh
                    }
                     if (!obj.parent || obj === scene) break; // Stop if we reach scene or no parent
                    obj = obj.parent;
                 }
                 if (intersectedMesh) break; // Exit outer loop if mesh found
            }


            if (intersectedMesh && intersectedMesh !== selectedObject) {
                console.log('Object selected:', intersectedMesh.name, intersectedMesh);
                selectedObject = intersectedMesh;

                // Check if it has a suitable material before updating sidebar
                if (selectedObject.material instanceof THREE.MeshStandardMaterial) {
                    updateSidebar(selectedObject); // Call function from sidebar.js
                } else {
                    console.log('Selected object material is not MeshStandardMaterial:', selectedObject.material);
                    clearSidebar(); // Clear sidebar if material is not suitable
                    selectedObject = null; // Deselect if not suitable
                }
            } else if (intersectedMesh && intersectedMesh === selectedObject) {
                 // Clicked the same object again, do nothing or maybe toggle something?
                 console.log('Clicked the same object again.');
            } else if (intersects.length > 0 && !intersectedMesh) {
                 // Intersected something, but not a visible mesh (e.g., helper, line)
                 console.log('Intersection with non-mesh object:', intersects[0].object);
                 if (selectedObject) { // Deselect if something else was clicked
                     console.log('Deselecting previous object.');
                     clearSidebar();
                     selectedObject = null;
                 }
            }

        } else {
            // Clicked on empty space (no intersections)
            if (selectedObject) {
                console.log('Clicked background, deselecting.');
               // clearSidebar(); // Clear the sidebar
                selectedObject = null;
            }
        }
    } else {
         // Scene has no children? Also clear selection
         if (selectedObject) {
           //  clearSidebar();
             selectedObject = null;
         }
    }
}

function setupTimelineControls() {
    if (!mixer || !longestAction || animationActions.length === 0) return;

    timelineElement.style.display = 'block';
    pauseResumeButton.onclick = togglePlayPause;
    updatePlayPauseButton();

    $("#timeline-range-input").ionRangeSlider({
        skin: "flat", type: "double", min: 0, max: longestDuration,
        from: 0, to: longestDuration, step: 0.01, grid: true,
        grid_num: 10, prettify: prettifyNumber,
    });
    rangeSliderInstance = $("#timeline-range-input").data("ionRangeSlider");

    $("#timeline-progress-input").ionRangeSlider({
        skin: "flat", type: "single", min: 0, max: longestDuration,
        from: 0, step: 0.01, grid: false, prettify: prettifyNumber,
        hide_min_max: true, hide_from_to: false,
        onStart: () => {
            isDraggingSlider = true;
            if (!animationActions[0].paused) {
                animationActions.forEach(action => action.paused = true);
                updatePlayPauseButton();
            }
        },
        onChange: data => {
            const targetTime = data.from;
            animationActions.forEach(action => action.time = targetTime);
            mixer.update(0);
        },
        onFinish: () => {
            isDraggingSlider = false;
        }
    });
    progressSliderInstance = $("#timeline-progress-input").data("ionRangeSlider");
}

function togglePlayPause() {
    if (isDraggingSlider || animationActions.length === 0 || !progressSliderInstance) return;

    const newPaused = !animationActions[0].paused;
    if (!newPaused) {
        const targetTime = progressSliderInstance.result.from;
        animationActions.forEach(action => action.time = targetTime);
        mixer.update(0);
        clock.getDelta();
    }
    animationActions.forEach(action => action.paused = newPaused);
    updatePlayPauseButton();
}

function updatePlayPauseButton() {
    if (!pauseResumeButton || animationActions.length === 0) return;
    pauseResumeButton.classList.toggle('paused', animationActions[0].paused);
}

function autoIncrementTimeline() {
    if (!progressSliderInstance || !mixer || animationActions.length === 0) return;

    const currentSliderTime = progressSliderInstance.result.from;
    let newTime = (currentSliderTime + 0.01) % longestDuration;
    newTime = Math.max(0, newTime);

    if (Math.abs(currentSliderTime - newTime) > 0.001) {
        progressSliderInstance.update({ from: newTime });
    }

    animationActions.forEach(action => action.time = newTime);
    return newTime;
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    controls.update();

    if (animationActions.length > 0 && !animationActions[0].paused) {
        const targetTime = autoIncrementTimeline();
        if (targetTime !== undefined) {
            animationActions.forEach(action => action.time = targetTime);
            mixer.update(0);
        }
    }

    if (!isDraggingSlider && animationActions.length > 0 && !animationActions[0].paused && progressSliderInstance) {
        const currentTime = longestAction.time % longestDuration;
        const sliderValue = progressSliderInstance.result.from;
        if (Math.abs(sliderValue - currentTime) > 0.01) {
            progressSliderInstance.update({ from: currentTime });
        }
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (rangeSliderInstance) rangeSliderInstance.update({});
    if (progressSliderInstance) progressSliderInstance.update({});
}
// Ensure click listener is added:
window.addEventListener('click', onClick, false);
// Keep mousemove listener
window.addEventListener('mousemove', onMouseMove, false);
init();