import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/RGBELoader.js';

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


let scene, camera, renderer, controls, mixer, clock;
let animationActions = [];
let longestAction = null;
let timelineElement = document.getElementById('timeline');
let pauseResumeButton = document.getElementById('timeline-pause-resume');
let rangeSliderInstance, progressSliderInstance;
let isDraggingSlider = false;
let longestDuration = 0;

function prettifyNumber(num) { return num.toFixed(0); }

function init() {
    scene = new THREE.Scene();
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

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
    animate();
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

init();