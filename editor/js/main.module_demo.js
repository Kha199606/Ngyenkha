		import { handleMeshClick } from './editmaterial.js';
//		import * as POSTPROCESSING from 'https://unpkg.com/postprocessing@6.30.3/build/postprocessing.module.js';

		
		// --- Globals ---
        let scene, camera, renderer, controls, currentModel, currentEnvMap;
        const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
        let annotations = []; const annotationSprites = []; let annotationCounter = 1;
        const ANNOTATION_LAYER = 1;
        let controlKit = null; let mainPanel = null;
        let popupElement, popupNameElement, popupNoteElement, popupCloseButton, popupPrevButton, popupNextButton;
        let currentPopupAnnotationId = null;
        const SPRITE_SCREEN_SIZE = 0.04;
        let loadedModelFile = null; let loadedHDRIFile = null; let isPublishing = false;
		let ambientLight, directionalLight;
		let backgroundSphere;
		let mixer, animationActions = [], longestAction = null, longestDuration = 0;
		let progressSliderInstance, rangeSliderInstance, isDraggingSlider = false;
		let annotationListGroup = null;
		let pinModel = null;
		const gltfLoader = new THREE.GLTFLoader();

		
		const materialsData = [];
		currentModel?.traverse(obj => {
		  if (obj.isMesh && obj.material && obj.material.isMeshStandardMaterial) {
			const mat = obj.material;
			materialsData.push({
			  uuid: obj.uuid, // quan trọng để xác định đúng mesh trong viewer
			  color: mat.color?.getHex(),
			  metalness: mat.metalness,
			  roughness: mat.roughness,
			  opacity: mat.opacity,
			  transparent: mat.transparent,
			  envMapIntensity: mat.envMapIntensity,
			  // texture URLs (DataURI nếu đã đổi)
			  map: mat.map?.image?.src || null,
			  normalMap: mat.normalMap?.image?.src || null,
			  metalnessMap: mat.metalnessMap?.image?.src || null,
			  roughnessMap: mat.roughnessMap?.image?.src || null,
			  aoMap: mat.aoMap?.image?.src || null,
			  emissiveMap: mat.emissiveMap?.image?.src || null,
			});
		  }
		});
		
        const controlSettings = {
            modelFileName: 'Chưa chọn file', hdriFileName: 'Chưa chọn file', exposure: 1.0, backgroundColor: '#1a1a1a',ambientIntensity: 0.3,
							ambientColor: '#ffffff',
							dirIntensity: 0.8,
							dirColor: '#ffffff', bgOpacity: 1.0,
            annotationsVisible: true,
            selectModel: () => document.getElementById('modelFileInput').click(),
            selectHDRI: () => document.getElementById('hdriFileInput').click(),
            publishModel: async function() {
                if (isPublishing) { console.warn("Đang xuất bản..."); return; }
                console.log("DEBUG: publishModel (HTML Export) function called.");
                if (!loadedModelFile) { alert("Vui lòng tải model trước."); return; }
                isPublishing = true; document.getElementById('info').textContent = 'Đang chuẩn bị file...'; console.log("DEBUG: Reading file data...");
                try {
                    const modelDataUrl = await readFileAsDataURL(loadedModelFile);
                    const hdriDataUrl = loadedHDRIFile ? await readFileAsDataURL(loadedHDRIFile) : null;
                    if (!modelDataUrl) throw new Error("Không thể đọc dữ liệu model.");
                    const dataToEmbed = { modelDataUrl, modelFileName: loadedModelFile.name, hdriDataUrl, annotations, exposure: controlSettings.exposure, annotationsVisible: controlSettings.annotationsVisible };
					dataToEmbed.materialsData = materialsData;
                    let embeddedDataJSONString;
                    try {
                        const jsonData = JSON.stringify(dataToEmbed); // Dữ liệu gốc -> JSON string
                        embeddedDataJSONString = JSON.stringify(jsonData); // JSON string -> JS string literal (escape + quotes)
                        console.log("DEBUG: Data prepared and double-stringified.");
                    } catch (e) { console.error("Lỗi stringify dữ liệu nhúng:", e); throw new Error("Lỗi chuẩn bị dữ liệu."); }
                    const viewerHTML = createViewerHTML(embeddedDataJSONString); // Truyền chuỗi JS đã escape
                    console.log("DEBUG: Viewer HTML content created.");
                    const blob = new Blob([viewerHTML], { type: 'text/html' }); const blobUrl = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = blobUrl; const safeFilename = loadedModelFile.name.split('.')[0] || 'model'; link.download = `${safeFilename}_viewer.html`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(blobUrl); console.log("DEBUG: Download triggered."); document.getElementById('info').textContent = 'File viewer đã được tạo!';
                } catch (error) { console.error("Lỗi xuất bản:", error); alert(`Lỗi xuất bản: ${error.message}`); document.getElementById('info').textContent = 'Lỗi xuất bản!';
                } finally {
                    isPublishing = false;
                    setTimeout(() => { document.getElementById('info').textContent = 'Nhấp đúp để tạo Annotation | Nhấp STT để xem chi tiết & di chuyển camera'; }, 4000);
                }
            }
        };

        // --- Initialization Flow ---
        document.addEventListener('DOMContentLoaded', () => {
            console.log("DOM loaded. Initializing...");
            initThree();
            initPopup();
			makePopupDraggable();
            addEventListeners();
            initEditorModeControls();
			
			gltfLoader.load('../img/pin.glb', gltf => {
				pinModel = gltf.scene;
				console.log("✅ pin.glb loaded.");
			}, undefined, err => {
				console.error("❌ Không thể load pin.glb:", err);
			});
			
            console.log("Initialization complete (Editor Mode).");
			
			// --- Tự động tải file mặc định nếu không có gì được chọn
			fetch('../model/default.glb')
			  .then(response => {
				if (!response.ok) throw new Error('Không tìm thấy default.glb');
				return response.blob();
			  })
			  .then(blob => {
				const file = new File([blob], 'default.glb', { type: 'model/gltf-binary' });
				loadedModelFile = file;
				loadModel(file, loadAnnotationsFromFileIfExists);
			  })
			  .catch(err => console.warn('Không thể tải default.glb:', err));

			fetch('../model/default.hdr')
			  .then(response => {
				if (!response.ok) throw new Error('Không tìm thấy default.hdr');
				return response.blob();
			  })
			  .then(blob => {
				const file = new File([blob], 'default.hdr', { type: 'application/octet-stream' });
				loadedHDRIFile = file;
				loadHDRI(file);
			  })
			  .catch(err => console.warn('Không thể tải default.hdr:', err));

			
//			loadAnnotationsFromFileIfExists();
        });

        // --- Three.js Setup ---
        function initThree() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(controlSettings.backgroundColor);
            const canvas = document.getElementById('three-canvas');
			
		
			
            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
            camera.position.set(0, 1, 5);
            camera.layers.enable(0);
            camera.layers.enable(ANNOTATION_LAYER);
			
			
            renderer = new THREE.WebGLRenderer({
                canvas: canvas,
                antialias: true
            });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = controlSettings.exposure;
            renderer.outputEncoding = THREE.sRGBEncoding;
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.target.set(0, 1, 0);
            controls.update();
			
            ambientLight = new THREE.AmbientLight(controlSettings.ambientColor, controlSettings.ambientIntensity);
			scene.add(ambientLight);
			
            directionalLight = new THREE.DirectionalLight(controlSettings.dirColor, controlSettings.dirIntensity);
			directionalLight.position.set(5, 10, 7.5);
			scene.add(directionalLight);
            animate();
            console.log("Three.js initialized.");
        }
		
		 function animate() {
			requestAnimationFrame(animate);

			controls.update();

			// Cập nhật tiến trình animation nếu đang chạy
			if (animationActions.length > 0 && !animationActions[0].paused) {
				const t = autoIncrementTimeline();
				if (t !== undefined) {
					mixer.update(0); // thời gian đã set ở autoIncrementTimeline
					if (!isDraggingSlider && progressSliderInstance) {
						progressSliderInstance.update({ from: t });
					}
				}
			}
			repositionCurrentPopup();
			updateAnnotationSpritePositions();
			renderer.render(scene, camera);
		}


	
		function deleteCurrentAnnotation() {
			if (currentPopupAnnotationId === null) {
				alert("Bạn cần chọn annotation bằng cách nhấn vào số để hiển thị popup.");
				return;
			}

			const index = annotations.findIndex(a => a.id === currentPopupAnnotationId);
			if (index === -1) {
				alert("Không tìm thấy annotation cần xóa.");
				return;
			}

			const sprite = annotationSprites[index];
			if (sprite) {
				if (sprite.material.map) sprite.material.map.dispose();
				sprite.material.dispose();
				scene.remove(sprite);
			}

			annotations.splice(index, 1);
			annotationSprites.splice(index, 1);

			currentPopupAnnotationId = null;
			updateAnnotationListControlKit();
			hideAnnotationPopup();

			alert("Đã xóa annotation.");
		}

		
		
		function exportAnnotationsToJSON() {
			if (!annotations || annotations.length === 0) {
				alert("Không có annotation nào để xuất.");
				return;
			}

			const data = {
				annotations,
				annotationCounter
			};

			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = 'default.json'; // tên cố định
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(link.href);

			alert("Đã xuất annotations ra file default.json.");
		}



		
        function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); hideAnnotationPopup(); }

        // --- ControlKit Setup ---
        function initEditorModeControls() {
			try {
				controlKit = new ControlKit();
				mainPanel = controlKit.addPanel({
					label: 'CONTROL PANEL',
					width: 200,
					align: 'right',
					fixed: false,
					opacity: 0.95,
					position: [15, 15]
				});
				mainPanel.addGroup({
					label: 'Tải File',
				}).addStringInput(controlSettings, 'modelFileName', {
					label: 'Model:',
					readonly: true
				}).addButton('Chọn Model', controlSettings.selectModel).addStringInput(controlSettings, 'hdriFileName', {
					label: 'HDRI:',
					readonly: true
				}).addButton('Chọn HDRI', controlSettings.selectHDRI);
				
				mainPanel.addGroup({ label: 'Môi trường' })
				.addColor(controlSettings, 'backgroundColor', {
					label: 'Màu nền',
					onChange: (value) => {
						scene.background = new THREE.Color(value);
					}
				})
				.addNumberInput(controlSettings, 'exposure', {
					label: 'Exposure', step: 0.1, min: 0, max: 3,
					onChange: (value) => {
						renderer.toneMappingExposure = value;
					}
				
				})
				.addNumberInput(controlSettings, 'bgOpacity', {
					label: 'HDRI Background Opacity',
					step: 0.05, min: 0, max: 1,
					onChange: (value) => {
						if (backgroundSphere && backgroundSphere.material) {
							backgroundSphere.material.opacity = value;
							backgroundSphere.material.needsUpdate = true;
						}
					}
				})
				;
				
				mainPanel.addGroup({ label: 'Ánh sáng' })
				.addColor(controlSettings, 'ambientColor', {
					label: 'Ambient Color',
					onChange: (val) => {
						ambientLight.color.set(val);
					}
				})
				.addNumberInput(controlSettings, 'ambientIntensity', {
					label: 'Ambient Intensity',
					step: 0.1, min: 0, max: 5,
					onChange: (val) => {
						ambientLight.intensity = val;
					}
				})
				.addColor(controlSettings, 'dirColor', {
					label: 'Directional Color',
					onChange: (val) => {
						directionalLight.color.set(val);
					}
				})
				.addNumberInput(controlSettings, 'dirIntensity', {
					label: 'Directional Intensity',
					step: 0.1, min: 0, max: 5,
					onChange: (val) => {
						directionalLight.intensity = val;
					}
				});
				const annotationMainGroup = mainPanel.addGroup({
					label: 'Annotations'
				});
				annotationMainGroup
				.addCheckbox(controlSettings, 'annotationsVisible', {
					label: 'Hiện Annotations',
					onChange: () => toggleAnnotationsVisibility(controlSettings.annotationsVisible)
				})
				.addButton('Xuất Bản File HTML', controlSettings.publishModel, {
					label: 'Xuất Bản HTML'
				})
				.addButton('Lưu Annot', exportAnnotationsToJSON, {
					label: 'Lưu Annot'
				})
				.addButton('Xóa Annot', clearAnnotations, {
					label: 'Xóa Annot'
				});

				// 👇 Tạo sub-group hiển thị danh sách annotation có thể xóa từng cái
//				annotationListGroup = annotationMainGroup.addGroup({
//					label: 'Danh sách Annot'
//				});

//				updateAnnotationListControlKit(); // Khởi tạo lần đầu
				console.log("ControlKit initialized.");
			} catch (error) {
				console.error("Error initializing ControlKit:", error);
				alert("Lỗi khởi tạo bảng điều khiển.");
			}
		}

		function saveAnnotationsToLocal() {
			if (!annotations || annotations.length === 0) {
				alert("Không có annotation nào để lưu.");
				return;
			}

			const saveData = {
				annotations,
				annotationCounter,
			};

			localStorage.setItem('savedAnnotations', JSON.stringify(saveData));
			alert("Đã lưu annotations vào localStorage.");
		}


		function loadAnnotationsFromFileIfExists() {
            // <<< Quan trọng: Chỉ chạy nếu pinModel đã load xong >>>
            if (!pinModel) {
                console.warn("[Load Annotations] Waiting for pinModel to load...");
                return;
            }
             if (!currentModel) {
                console.warn("[Load Annotations] Waiting for currentModel to load...");
                return;
             }

			fetch('../model/default.json') // Hoặc tên file JSON của bạn
				.then(res => {
					if (!res.ok) throw new Error(`Could not fetch default.json: ${res.statusText}`);
					return res.json();
				})
				.then(data => {
					console.log("[LOAD ANNOT] Raw JSON data:", data);
					if (!data || !Array.isArray(data.annotations)) {
                         throw new Error("Invalid JSON file or missing 'annotations' array.");
                    }

                    // Xóa marker cũ trước khi load mới
                    clearAnnotations(true); // true để chỉ xóa marker, không xóa data (sẽ ghi đè ngay sau đây)

					annotations = data.annotations.map(annoData => ({
                        ...annoData,
                        // Chuyển đổi lại thành Vector3 khi cần
                        cameraPositionVec: new THREE.Vector3().fromArray(annoData.cameraPosition || [0,1,5]),
                        cameraTargetVec: new THREE.Vector3().fromArray(annoData.cameraTarget || [0,0,0])
                    }));
					annotationCounter = data.annotationCounter || (annotations.length + 1);
					// annotationSprites array đã được xóa trong clearAnnotations

                    let createdCount = 0;
					annotations.forEach(annotationData => {
                        console.log(`[LOAD ANNOT] Processing ID ${annotationData.id}. Data:`, annotationData);

                        if (!annotationData.meshName || !annotationData.localPosition || !Array.isArray(annotationData.localPosition) || annotationData.localPosition.length !== 3) {
                            console.error(`[LOAD ANNOT] Invalid data for annotation ID ${annotationData.id}. Skipping. MeshName: ${annotationData.meshName}, LocalPos: ${annotationData.localPosition}`);
                            return; // Bỏ qua annotation này nếu thiếu thông tin cơ bản
                        }

						// --- Tạo marker 3D từ dữ liệu đã load ---
						const marker = createAnnotationMarker3D(annotationData);
						if (marker) {
                            marker.visible = controlSettings.annotationsVisible; // Đặt visibility ban đầu
                            scene.add(marker);
                            annotationSprites.push(marker); // Thêm marker mới vào mảng quản lý
                            createdCount++;
                            // userData đã được gán bên trong createAnnotationMarker3D
                            console.log(`[LOAD ANNOT]   -> Successfully created and added marker for ID ${marker.userData.annotationId}`);
                        } else {
                             console.error(`[LOAD ANNOT]   -> Failed to create marker for ID ${annotationData.id}`);
                        }
					});

					// updateAnnotationListControlKit(); // Cập nhật UI nếu có
					console.log(`[LOAD ANNOT] Finished loading. Created ${createdCount} / ${annotations.length} annotation markers from default.json`);
				})
				.catch(err => {
					console.warn("[LOAD ANNOT] Could not load or parse default.json:", err.message);
                    // Không cần xóa annotations ở đây vì có thể là lần load đầu tiên
				});
		}



        // --- Popup Setup ---
        function initPopup() {
        	popupElement = document.getElementById('annotation-popup');
        	popupNameElement = document.getElementById('popup-name');
        	popupNoteElement = document.getElementById('popup-note');
        	popupCloseButton = document.getElementById('popup-close');
        	popupPrevButton = document.getElementById('popup-prev');
        	popupNextButton = document.getElementById('popup-next');
        	if (!popupElement || !popupNameElement || !popupNoteElement || !popupCloseButton || !popupPrevButton || !popupNextButton) {
        		console.error("Lỗi Popup Elements!");
        		return;
        	}
        	console.log("Popup elements found.");
        	popupCloseButton.addEventListener('click', hideAnnotationPopup);
        	popupPrevButton.addEventListener('click', navigateToPreviousAnnotation);
        	popupNextButton.addEventListener('click', navigateToNextAnnotation);


        }
		
		function makePopupDraggable() {
			const popup = document.getElementById('annotation-popup');
			const dragHandle = popup.querySelector('h4'); // kéo từ tiêu đề

			let isDragging = false;
			let offsetX = 0;
			let offsetY = 0;

			function onMouseDown(e) {
				isDragging = true;
				const rect = popup.getBoundingClientRect();
				offsetX = e.clientX - rect.left;
				offsetY = e.clientY - rect.top;
				document.addEventListener('mousemove', onMouseMove);
				document.addEventListener('mouseup', onMouseUp);
			}

			function onMouseMove(e) {
				if (!isDragging) return;
				popup.style.left = `${e.clientX - offsetX}px`;
				popup.style.top = `${e.clientY - offsetY}px`;
			}

			function onMouseUp() {
				isDragging = false;
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
			}

			// Touch support
			function onTouchStart(e) {
				if (e.touches.length !== 1) return;
				isDragging = true;
				const rect = popup.getBoundingClientRect();
				offsetX = e.touches[0].clientX - rect.left;
				offsetY = e.touches[0].clientY - rect.top;
				document.addEventListener('touchmove', onTouchMove);
				document.addEventListener('touchend', onTouchEnd);
			}

			function onTouchMove(e) {
				if (!isDragging || e.touches.length !== 1) return;
				popup.style.left = `${e.touches[0].clientX - offsetX}px`;
				popup.style.top = `${e.touches[0].clientY - offsetY}px`;
			}

			function onTouchEnd() {
				isDragging = false;
				document.removeEventListener('touchmove', onTouchMove);
				document.removeEventListener('touchend', onTouchEnd);
			}

			dragHandle.addEventListener('mousedown', onMouseDown);
			dragHandle.addEventListener('touchstart', onTouchStart);
		}


        // --- Event Listeners ---
        function addEventListeners() {
        	window.addEventListener('resize', onWindowResize);
			renderer.domElement.addEventListener('click', (e) => handleMeshClick(e, renderer, camera, currentModel));
        	renderer.domElement.addEventListener('click', onSingleClick);
        	renderer.domElement.addEventListener('dblclick', onDoubleClick);
        	document.getElementById('modelFileInput').addEventListener('change', handleModelFileSelect);
        	document.getElementById('hdriFileInput').addEventListener('change', handleHDRIFileSelect);
        	console.log("Event listeners attached.");
        }

        // --- File Handling ---
        function handleModelFileSelect(event) { const file = event.target.files[0]; if (file) { loadedModelFile = file; loadModel(file); } else { loadedModelFile = null; } event.target.value = null; }
        function handleHDRIFileSelect(event) { const file = event.target.files[0]; if (file) { loadedHDRIFile = file; loadHDRI(file); } else { loadedHDRIFile = null; } event.target.value = null; }

        // --- Canvas Click/Double Click ---
		function onDoubleClick(event) {
			if (!currentModel) {
				alert("Vui lòng tải model trước.");
				return;
			}

			updateMouseCoords(event);
			raycaster.setFromCamera(mouse, camera);
			raycaster.layers.set(0);
			const intersects = raycaster.intersectObject(currentModel, true);

			if (intersects.length === 0) return;

			const intersect = intersects[0];
			const intersectionPoint = intersect.point;
			const mesh = intersect.object;
			const localPos = mesh.worldToLocal(intersectionPoint.clone());

			const annotationName = prompt(`Annotation ${annotationCounter} - Tên:`, `Annotation ${annotationCounter}`);
			if (annotationName === null) return;
			if (annotationName.trim() === "") {
				alert("Tên không được trống.");
				return;
			}

			const annotationNote = prompt(`Annotation ${annotationCounter} (${annotationName}) - Nội dung:`, `Chi tiết...`);
			if (annotationNote === null) return;

			createAnnotation({
				meshName: mesh.name,
				isSkinned: mesh.isSkinnedMesh,
				localPosition: localPos.toArray(),
				name: annotationName.trim(),
				note: annotationNote,
				cameraPosition: camera.position.clone(),
				cameraTarget: controls.target.clone()
			});
		}


        function onSingleClick(event) {
            if (annotationSprites.length === 0) return;
            updateMouseCoords(event);
            raycaster.setFromCamera(mouse, camera);
            raycaster.layers.set(ANNOTATION_LAYER);
            const intersects = raycaster.intersectObjects(annotationSprites.filter(s => s.visible), false);
            if (intersects.length > 0) {
                const clickedSprite = intersects[0].object;
                const annotationId = clickedSprite.userData.annotationId;
                const annotation = annotations.find(a => a.id === annotationId);
                if (annotation) {
                    console.log(`[Sprite Click] Annotation ${annotation.id}.`);
                    updatePopupContent(annotation);
                    animateCameraToView(annotation.cameraPosition, annotation.cameraTarget);
                }
            } else {
                hideAnnotationPopup();
            }

			
        }

        function updateMouseCoords(event) { const rect = renderer.domElement.getBoundingClientRect(); mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; }

        // --- Annotation Logic ---
		function createAnnotation({ meshName, localPosition, name, note, cameraPosition, cameraTarget }) {
			const annotationData = {
				id: annotationCounter,
				name,
				note,
				meshName,
				localPosition,
				cameraPosition,
				cameraTarget
			};

			const marker = createAnnotationMarker3D(annotationData);
			if (marker) {
				marker.visible = controlSettings.annotationsVisible;
				scene.add(marker);
				annotationSprites.push(marker);
			}

			
			annotations.push(annotationData);
			annotationCounter++;
			updateAnnotationListControlKit();

			console.log("Annotation và view đã lưu:", annotationData);
		}

		
		function createAnnotationMarker3D(annotationData) {
			if (!pinModel) {
				console.warn("⚠️ Chưa load xong pin.glb.");
				return null;
			}

			const marker = pinModel.clone(true);
			marker.traverse(child => {
				if (child.isMesh) {
					child.material = child.material.clone();
					child.material.depthTest = true;
				}
			});

			marker.scale.set(0.2, 0.2, 0.2); // Tùy chỉnh scale marker
			marker.userData.annotationId = annotationData.id;
			marker.userData.meshName = annotationData.meshName;
			marker.userData.positionData = annotationData.localPosition;
			marker.layers.set(ANNOTATION_LAYER);

			const mesh = currentModel?.getObjectByName(annotationData.meshName);
			if (mesh && annotationData.localPosition) {
				const worldPos = mesh.localToWorld(new THREE.Vector3().fromArray(annotationData.localPosition));
				marker.position.copy(worldPos);
			} else {
				console.warn(`Không tìm thấy mesh cho annotation ID ${annotationData.id}`);
				marker.position.set(0, 0, 0);
			}

			return marker;
		}





		function updateAnnotationListControlKit() {
			if (!annotationListGroup) return;

				if (annotationListGroup.__controllers) {
					annotationListGroup.__controllers.forEach(controller => {
						annotationListGroup.remove(controller);
					});
				}


			// Tạo bản sao để tránh thay đổi mảng trong khi đang lặp
			const items = annotations.slice();

			if (items.length === 0) {
				annotationListGroup.addInfo('Không có annotation nào.');
				return;
			}

			items.forEach((a) => {
				annotationListGroup.addButton(`❌ ${a.id} - ${a.name}`, () => {
					const confirmed = confirm(`Xóa annotation "${a.name}" (ID ${a.id})?`);
					if (!confirmed) return;

					const index = annotations.findIndex(item => item.id === a.id);
					if (index === -1) return;

					const sprite = annotationSprites[index];
					if (sprite) {
						if (sprite.material.map) sprite.material.map.dispose();
						sprite.material.dispose();
						scene.remove(sprite);
					}

					annotations.splice(index, 1);
					annotationSprites.splice(index, 1);
					currentPopupAnnotationId = null;
					hideAnnotationPopup();

	//				updateAnnotationListControlKit(); // an toàn vì đã xóa đúng theo ID
				});
			});
		}		
		


        function toggleAnnotationsVisibility(isVisible) { console.log(`Setting annotation visibility to: ${isVisible}`); annotationSprites.forEach(sprite => { sprite.visible = isVisible; }); if (!isVisible) { hideAnnotationPopup(); } }

       // --- Cập nhật hàm xóa để xử lý Object3D ---
		function clearAnnotations(markersOnly = false) {
            console.log(`Clearing annotations... (Markers only: ${markersOnly})`);
			hideAnnotationPopup();
			currentPopupAnnotationId = null;

			annotationSprites.forEach(marker => {
				if (marker) {
					// --- Dispose geometries and materials ---
					marker.traverse(child => {
						if (child.isMesh) {
							if (child.geometry) {
								child.geometry.dispose();
                                // console.log("Disposed geometry for marker child");
							}
							if (child.material) {
                                // Nếu material là array (MultiMaterial)
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(mat => mat.dispose());
                                } else {
                                    // Dispose textures if they exist
                                    for (const key in child.material) {
                                        const value = child.material[key];
                                        if (value && typeof value === 'object' && value.isTexture) {
                                            value.dispose();
                                            // console.log(`Disposed texture ${key}`);
                                        }
                                    }
                                    child.material.dispose();
                                }
                                // console.log("Disposed material(s) for marker child");
							}
						}
					});
					// --- Remove from scene ---
					scene.remove(marker);
				}
			});
			annotationSprites.length = 0; // Clear the array

            if (!markersOnly) {
                annotations = []; // Clear data array
                annotationCounter = 1; // Reset counter
                console.log("Annotation data cleared.");
            }
			// updateAnnotationListControlKit(); // Cập nhật UI nếu có
			console.log("All annotation markers removed from scene.");
		}

        // --- Popup Logic ---
        function updatePopupContent(annotationData) { if (!popupNameElement || !popupNoteElement) { console.error("updatePopupContent failed: Popup elements not ready!"); return; } if (!annotationData) { hideAnnotationPopup(); return; } popupNameElement.textContent = annotationData.name || '[Không tên]'; popupNoteElement.textContent = annotationData.note || ''; currentPopupAnnotationId = annotationData.id; updatePopupNavButtons(); }
		
		function updateAnnotationSpritePositions() {
			if (!currentModel || annotationSprites.length === 0) {
				return;
			}
			annotationSprites.forEach((sprite) => {
				const data = sprite.userData;

				// 2. Kiểm tra xem có đủ dữ liệu không (meshName và positionData là localPosition)
				if (data && data.meshName && data.positionData) {

					// 3. Tìm đối tượng Mesh trong model hiện tại bằng TÊN đã lưu
					const mesh = currentModel.getObjectByName(data.meshName);

					// 4. Nếu tìm thấy Mesh tương ứng
					if (mesh) {
						try {
							// 5. Lấy vị trí cục bộ (localPosition) đã lưu và chuyển thành Vector3
							// Đảm bảo positionData là một mảng hợp lệ
							if (!Array.isArray(data.positionData) || data.positionData.length !== 3) {
								console.error(`[Sprite Update] Dữ liệu positionData không hợp lệ cho Sprite ID ${data.annotationId}:`, data.positionData);
								return; // Bỏ qua sprite này nếu dữ liệu vị trí lỗi
							}
							const localPositionVec = new THREE.Vector3().fromArray(data.positionData);

							// 6. Tính toán vị trí trong không gian thế giới (world space)
							// Hàm localToWorld sử dụng ma trận transform hiện tại của mesh
							const worldPosition = mesh.localToWorld(localPositionVec.clone()); // Dùng clone()

							// 7. Cập nhật trực tiếp thuộc tính .position của đối tượng Sprite
							sprite.position.copy(worldPosition);

							// (Tùy chọn) Đảm bảo sprite luôn hiển thị nếu mesh của nó được tìm thấy
							// sprite.visible = true;

						} catch (error) {
							// Bắt lỗi nếu có vấn đề trong quá trình tính toán (ví dụ: positionData sai định dạng)
							console.error(`[Sprite Update] Lỗi khi tính toán vị trí cho Sprite ID ${data.annotationId}:`, error);
						}

					} else {
						// 8. Nếu không tìm thấy mesh với tên đã lưu
						// Ghi log cảnh báo để dễ dàng debug vấn đề về tên không khớp
						// (Chúng ta đã có log tương tự trong hàm animate, có thể bật/tắt tùy ý)
						 console.warn(`[Sprite Update] (Trong hàm riêng) Không tìm thấy mesh: "${data.meshName}" cho Sprite ID ${data.annotationId}`);

						// (Tùy chọn) Có thể ẩn sprite đi nếu không tìm thấy mesh gốc
						// sprite.visible = false;
					}
				} else {
					// 9. Nếu thiếu dữ liệu cần thiết trên userData của sprite
					// (Có thể xảy ra nếu quá trình tạo annotation bị lỗi)
					 console.warn(`[Sprite Update] (Trong hàm riêng) Bỏ qua Sprite ID ${data?.annotationId} do thiếu data (meshName hoặc positionData)`);
				}
			});
		}
		
		function repositionCurrentPopup() {
			if (!popupElement || currentPopupAnnotationId === null) return;

			const annotation = annotations.find(a => a.id === currentPopupAnnotationId);
			if (!annotation || !annotation.localPosition || !annotation.meshName) {
				hideAnnotationPopup();
				return;
			}

			const mesh = currentModel?.getObjectByName(annotation.meshName);
			if (!mesh) {
				console.warn(`Không tìm thấy mesh để định vị popup cho annotation ID ${annotation.id}`);
				hideAnnotationPopup();
				return;
			}


			// Lấy vị trí của annotation và chuyển đổi từ local space sang world space
			const position3D = mesh.localToWorld(new THREE.Vector3().fromArray(annotation.localPosition));
			const vector = position3D.project(camera);
			if (vector.z > 1) {
				hideAnnotationPopup();
				return;
			}

			const screenX = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
			const screenY = (-vector.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
			const popupWidth = popupElement.offsetWidth;
			const popupHeight = popupElement.offsetHeight;
			const spritePixelRadius = (SPRITE_SCREEN_SIZE * renderer.domElement.clientHeight) / 2;
			const gap = 10;

			let finalLeft = screenX + spritePixelRadius + gap;
			let finalTop = screenY - popupHeight / 2;

			if (finalLeft + popupWidth > window.innerWidth - 10) {
				finalLeft = screenX - spritePixelRadius - gap - popupWidth;
			}
			if (finalTop < 10) {
				finalTop = 10;
			} else if (finalTop + popupHeight > window.innerHeight - 10) {
				finalTop = window.innerHeight - 10 - popupHeight;
			}

			// Di chuyển popup
			popupElement.style.left = `${Math.round(finalLeft)}px`;
			popupElement.style.top = `${Math.round(finalTop)}px`;
			popupElement.classList.add('visible');
		}


		
		
		
        function hideAnnotationPopup() { if (popupElement) { popupElement.classList.remove('visible'); } currentPopupAnnotationId = null; }
        function updatePopupNavButtons() { if (!popupPrevButton || !popupNextButton || currentPopupAnnotationId === null || annotations.length <= 1) { if(popupPrevButton) popupPrevButton.disabled = true; if(popupNextButton) popupNextButton.disabled = true; return; } const sortedAnnotations = [...annotations].sort((a, b) => a.id - b.id); const currentIndex = sortedAnnotations.findIndex(a => a.id === currentPopupAnnotationId); popupPrevButton.disabled = (currentIndex <= 0); popupNextButton.disabled = (currentIndex >= sortedAnnotations.length - 1); }

        // --- Popup Navigation ---
        function navigateToPreviousAnnotation() { if (popupPrevButton.disabled || currentPopupAnnotationId === null) return; const sortedAnnotations = [...annotations].sort((a, b) => a.id - b.id); const currentIndex = sortedAnnotations.findIndex(a => a.id === currentPopupAnnotationId); if (currentIndex > 0) { const prevAnnotation = sortedAnnotations[currentIndex - 1]; updatePopupContent(prevAnnotation); animateCameraToView(prevAnnotation.cameraPosition, prevAnnotation.cameraTarget); } }
        function navigateToNextAnnotation() { if (popupNextButton.disabled || currentPopupAnnotationId === null) return; const sortedAnnotations = [...annotations].sort((a, b) => a.id - b.id); const currentIndex = sortedAnnotations.findIndex(a => a.id === currentPopupAnnotationId); if (currentIndex < sortedAnnotations.length - 1) { const nextAnnotation = sortedAnnotations[currentIndex + 1]; updatePopupContent(nextAnnotation); animateCameraToView(nextAnnotation.cameraPosition, nextAnnotation.cameraTarget); } }

        // --- Camera Animation ---
        function animateCameraToView(targetPosition, targetTarget, duration = 1.2) { if (gsap.isTweening(camera.position) || gsap.isTweening(controls.target)) return; controls.enabled = false; gsap.to(camera.position, { duration: duration, x: targetPosition.x, y: targetPosition.y, z: targetPosition.z, ease: "power3.inOut", onComplete: () => { repositionCurrentPopup(); } }); gsap.to(controls.target, { duration: duration, x: targetTarget.x, y: targetTarget.y, z: targetTarget.z, ease: "power3.inOut", onUpdate: () => controls.update(), onComplete: () => { controls.enabled = true; controls.update(); } }); }

         // Helper to apply EnvMap ---
         function applyEnvMapToModel(model, envMap) { if (!model || !envMap) return; model.traverse(child => { if (child.isMesh && (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial)) { child.material.envMap = envMap; child.material.envMapIntensity = 1.0; child.material.needsUpdate = true; } }); console.log("Đã áp dụng environment map cho model."); }

        // --- Loading Functions ---
        function loadModel(file, onLoadComplete = null) {
        	console.log("DEBUG: loadModel - Start.");
        	clearAnnotations();
        	if (currentModel) {
        		scene.remove(currentModel);
        		currentModel = null;
        		console.log("DEBUG: loadModel - Removed old model.");
        	}
        	controlSettings.modelFileName = file.name; // <<< Cập nhật tên file ngay
        	controlKit.update(); // Cập nhật tên file trên UI
        	console.log(`DEBUG: loadModel - Start loading: ${file.name}`);
        	const filename = file.name.toLowerCase();
        	const reader = new FileReader();
        	let loader;
        	try {
        		console.log("DEBUG: loadModel - Selecting loader...");
        		if (filename.endsWith('.gltf') || filename.endsWith('.glb')) loader = new THREE.GLTFLoader();
        		else if (filename.endsWith('.obj')) loader = new THREE.OBJLoader();
        		else throw new Error(`Unsupported format: .${filename.split('.').pop()}`);
        		console.log(`DEBUG: loadModel - Loader selected: ${loader.constructor.name}`);
        	} catch (error) {
        		console.error("Lỗi chọn loader:", error);
        		alert(`Lỗi: ${error.message}`);
        		controlSettings.modelFileName = 'Lỗi định dạng';
        		controlKit.update();
        		return;
        	}
        	reader.onload = (e) => {
        		console.log("DEBUG: loadModel - FileReader onload triggered.");
        		const contents = e.target.result;
        		controlSettings.modelFileName = `Đang parse: ${file.name}...`;
        		controlKit.update();
        		console.log("DEBUG: loadModel - Starting parse...");
        		let parsePromise;
        		try {
        			if (loader instanceof THREE.GLTFLoader) {
        				parsePromise = new Promise((resolve, reject) => loader.parse(contents, '', resolve, reject));
        			} else if (loader instanceof THREE.OBJLoader) {
        				parsePromise = new Promise((resolve) => resolve(loader.parse(contents)));
        			} else {
        				throw new Error("Loader không xác định");
        			}
        		} catch (parseError) {
        			console.error(`Lỗi parse:`, parseError);
        			alert(`Lỗi parse model`);
        			controlSettings.modelFileName = 'Lỗi parse';
        			controlKit.update();
        			return;
        		}
        		parsePromise.then((result) => {
        			console.log("DEBUG: loadModel - Parse successful.");
        			controlSettings.modelFileName = `Đang xử lý: ${file.name}...`;
        			controlKit.update();
        			if (!result) throw new Error("Parse result invalid.");
        			const modelToAdd = result.scene ? result.scene : result;
        			if (!modelToAdd || !(modelToAdd instanceof THREE.Object3D)) throw new Error("Invalid parsed object.");
        			console.log("DEBUG: loadModel - Model object obtained.");
        			try {
        				modelToAdd.traverse(child => {
        					if (child.isMesh) {
        						child.layers.set(0);
								        if (!child.name) {
											child.name = `mesh_${child.id}`; // hoặc `mesh_${index}` nếu bạn cần tuần tự
										}
								        // Gán userData.tag ổn định (ví dụ từ child.name)
								child.userData.stableId = child.name;
        						if (loader instanceof THREE.OBJLoader) {
        							if (!child.material || child.material.type === 'MeshBasicMaterial') {
        								child.material = new THREE.MeshStandardMaterial({
        									color: 0xcccccc,
        									metalness: 0.5,
        									roughness: 0.5,
        									envMap: currentEnvMap,
        									envMapIntensity: currentEnvMap ? 1.0 : 0
        								});
        							}
        						} else if (child.material && currentEnvMap && (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial)) {
        							child.material.envMap = currentEnvMap;
        							child.material.envMapIntensity = 1.0;
        							child.material.needsUpdate = true;
        						}
        					}
        				});
        				scene.add(modelToAdd);
        				currentModel = modelToAdd;
						
						if (result.animations && result.animations.length) {
							mixer = new THREE.AnimationMixer(modelToAdd);
							animationActions = result.animations.map(clip => {
								const action = mixer.clipAction(clip);
								action.play();
								return action;
							});

							longestAction = animationActions.reduce((a, b) => (a._clip.duration > b._clip.duration ? a : b));
							longestDuration = longestAction._clip.duration;

							setupTimelineControls(); // ← Gọi hàm tạo UI timeline
						}

						
        				console.log("DEBUG: loadModel - Model added.");
        				const fitSuccess = fitCameraToObject(currentModel, 1.5);
        				if (!fitSuccess) console.warn("DEBUG: fitCameraToObject issues.");
        				controlSettings.modelFileName = file.name;
//        				alert(`Model "${file.name}" tải thành công!`);
        				console.log("DEBUG: loadModel - Success!");
						if (typeof onLoadComplete === 'function') {
						  onLoadComplete(); // ✅ gọi khi model đã load xong
						}

						
        			} catch (processingError) {
        				console.error(`Lỗi xử lý sau parse:`, processingError);
        				if (currentModel) scene.remove(currentModel);
        				currentModel = null;
        				throw new Error(`Lỗi xử lý model: ${processingError.message}`);
        			}
        		}).catch((error) => {
        			console.error(`Lỗi parse/xử lý:`, error);
        			alert(`Lỗi tải model. ${error.message || 'Xem console.'}`);
        			controlSettings.modelFileName = 'Lỗi tải/xử lý';
        			if (currentModel) scene.remove(currentModel);
        			currentModel = null;
        		}).finally(() => {
        			controlKit.update();
        			console.log(`Hoàn tất xử lý model.`);
        		});
        	};
        	reader.onerror = (e) => {
        		console.error("DEBUG: FileReader error:", e);
        		alert("Lỗi đọc file model.");
        		controlSettings.modelFileName = 'Lỗi đọc file';
        		controlKit.update();
        	};
        	try {
        		console.log("DEBUG: loadModel - Reading file...");
        		if (loader instanceof THREE.GLTFLoader) reader.readAsArrayBuffer(file);
        		else if (loader instanceof THREE.OBJLoader) reader.readAsText(file);
        	} catch (readError) {
        		console.error("DEBUG: FileReader start error:", readError);
        		alert("Lỗi đọc file.");
        		controlSettings.modelFileName = 'Lỗi đọc file';
        		controlKit.update();
        	}
        	console.log("DEBUG: loadModel - End.");
        }
		
		
        function loadHDRI(file) {
        	console.log("DEBUG: loadHDRI - Start.");
        	controlSettings.hdriFileName = file.name; // <<< Cập nhật tên file ngay
        	controlKit.update(); // Cập nhật tên file trên UI
        	if (!file.name.toLowerCase().endsWith('.hdr')) {
        		alert("Chỉ hỗ trợ .hdr cho HDRI.");
        		controlSettings.hdriFileName = 'Chỉ hỗ trợ .hdr';
        		controlKit.update();
        		return;
        	}
        	const reader = new FileReader();
        	reader.onload = (e) => {
        		console.log("DEBUG: loadHDRI - FileReader onload.");
        		const dataUrl = e.target.result;
        		const loader = new THREE.RGBELoader();
        		console.log("DEBUG: loadHDRI - Loading via RGBELoader...");
        		try {
        			const onLoad = (texture) => {
        				console.log("DEBUG: loadHDRI - Load success.");
        				if (!(texture instanceof THREE.Texture)) {
        					throw new Error("Result not Texture.");
        				}
        				texture.mapping = THREE.EquirectangularReflectionMapping;
        				if (currentEnvMap) {
        					currentEnvMap.dispose();
        					console.log("DEBUG: loadHDRI - Old envMap disposed.");
        				}
        				if (backgroundSphere) {
							scene.remove(backgroundSphere);
							backgroundSphere.geometry.dispose();
							backgroundSphere.material.dispose();
						}
						const bgGeo = new THREE.SphereGeometry(100, 64, 64);
						const bgMat = new THREE.MeshBasicMaterial({
							map: texture,
							side: THREE.BackSide,
							transparent: true,
							opacity: controlSettings.bgOpacity
						});
						backgroundSphere = new THREE.Mesh(bgGeo, bgMat);
						scene.add(backgroundSphere);

        				scene.environment = texture;
        				currentEnvMap = texture;
        				console.log("DEBUG: loadHDRI - Env applied.");
        				if (currentModel) {
        					applyEnvMapToModel(currentModel, currentEnvMap);
        				}
        				controlSettings.hdriFileName = file.name;
//        				alert(`HDRI "${file.name}" tải thành công!`);
        				console.log("DEBUG: loadHDRI - Success!");
        				controlKit.update();
        			};
        			const onError = (error) => {
        				console.error("DEBUG: loadHDRI - Loader error:", error);
        				alert(`Lỗi tải HDRI. Xem console.`);
        				controlSettings.hdriFileName = 'Lỗi tải';
        				controlKit.update();
        			};
        			loader.load(dataUrl, onLoad, undefined, onError);
        		} catch (error) {
        			console.error(`DEBUG: loadHDRI - Error calling load:`, error);
        			alert(`Lỗi tải HDRI.`);
        			controlSettings.hdriFileName = 'Lỗi loader';
        			controlKit.update();
        		}
        	};
        	reader.onerror = (e) => {
        		console.error("DEBUG: loadHDRI - FileReader error:", e);
        		alert("Lỗi đọc file HDRI.");
        		controlSettings.hdriFileName = 'Lỗi đọc file';
        		controlKit.update();
        	};
        	console.log("DEBUG: loadHDRI - Reading file...");
        	reader.readAsDataURL(file);
        	console.log("DEBUG: loadHDRI - End.");
        }
        function fitCameraToObject(object, offset = 1.3) { console.log("DEBUG: fitCameraToObject - Start."); let box; try { box = new THREE.Box3().setFromObject(object); } catch (e) { console.error("DEBUG: fitCameraToObject - Error BBox:", e); return false; } console.log("DEBUG: fitCameraToObject - BBox:", box); const isBoxValid = !box.isEmpty() && Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z) && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z); if (!isBoxValid) { console.warn("DEBUG: fitCameraToObject - BBox invalid."); return false; } const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3()); const maxSize = Math.max(size.x, size.y, size.z); console.log(`DEBUG: fitCameraToObject - Size: ${maxSize.toFixed(2)}`); if (maxSize < Number.EPSILON) { console.warn("DEBUG: fitCameraToObject - Size near zero."); camera.position.set(center.x, center.y, center.z + 1); controls.target.copy(center); controls.minDistance = 0.01; controls.maxDistance = 10; controls.update(); return false; } const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360)); const fitWidthDistance = fitHeightDistance / camera.aspect; const distance = offset * Math.max(fitHeightDistance, fitWidthDistance); const direction = controls.target.clone().sub(camera.position).normalize().multiplyScalar(distance); controls.maxDistance = distance * 20; controls.minDistance = Math.max(0.01, distance / 20); controls.target.copy(center); camera.near = Math.max(0.001, distance / 1000); camera.far = distance * 100; camera.updateProjectionMatrix(); camera.position.copy(controls.target).sub(direction); controls.update(); console.log(`DEBUG: fitCameraToObject - Done.`); return true; }
        // --- Helper: Read File as Data URL (Async) ---
        function readFileAsDataURL(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = (event) => resolve(event.target.result); reader.onerror = (error) => reject(error); reader.readAsDataURL(file); }); }
		
				
function setupTimelineControls() {
    const timelineElement = document.getElementById('timeline');
    const pauseResumeButton = document.getElementById('timeline-pause-resume');
    if (!mixer || !longestAction || animationActions.length === 0) return;

    timelineElement.style.display = 'block';
    pauseResumeButton.onclick = togglePlayPause;
    updatePlayPauseButton();

    $("#timeline-range-input").ionRangeSlider({
        skin: "flat", type: "double", min: 0, max: longestDuration,
        from: 0, to: longestDuration, step: 0.01, grid: true,
        grid_num: 10, prettify: (num) => num.toFixed(1),
    });
    rangeSliderInstance = $("#timeline-range-input").data("ionRangeSlider");

    $("#timeline-progress-input").ionRangeSlider({
        skin: "flat", type: "single", min: 0, max: longestDuration,
        from: 0, step: 0.01, grid: false, prettify: (num) => num.toFixed(1),
        hide_min_max: true, hide_from_to: false,
        onStart: () => {
            isDraggingSlider = true;
           
        },
        onChange: data => {
            animationActions.forEach(a => a.time = data.from);
            mixer.update(0);
        },
        onFinish: () => {
            isDraggingSlider = false;
        }
    });
    progressSliderInstance = $("#timeline-progress-input").data("ionRangeSlider");
}

function togglePlayPause() {
    if (animationActions.length === 0 || !progressSliderInstance) return;
    const newPaused = !animationActions[0].paused;
    if (!newPaused) {
        const t = progressSliderInstance.result.from;
        animationActions.forEach(a => a.time = t);
        mixer.update(0);
    }
    animationActions.forEach(a => a.paused = newPaused);
    updatePlayPauseButton();
}


function updatePlayPauseButton() {
    const btn = document.getElementById('timeline-pause-resume');
    if (btn && animationActions.length > 0) {
        btn.classList.toggle('paused', animationActions[0].paused);
    }
}

function autoIncrementTimeline() {
    if (!progressSliderInstance || !mixer || animationActions.length === 0) return;

    const range = rangeSliderInstance?.result;
    if (!range) return;

    const minT = range.from;
    const maxT = range.to;

    let currentSliderTime = progressSliderInstance.result.from;
    let newTime = currentSliderTime + 0.01;

    if (newTime > maxT) newTime = minT;
    newTime = Math.min(Math.max(newTime, minT), maxT);

    progressSliderInstance.update({ from: newTime });
    animationActions.forEach(action => action.time = newTime);
    return newTime;
}


		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
        // --- Helper: Create Viewer HTML Template ---
        function createViewerHTML(embeddedDataJSONString) { // <<< embeddedDataJSONString là chuỗi đã stringify 2 lần
            return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>3D Model Viewer</title>
    <style>
        body { margin: 0; overflow: hidden; font-family: sans-serif; background-color: #1a1a1a; color: #fff; } #info { position: absolute; top: 10px; width: 100%; text-align: center; z-index: 1; pointer-events: none; color: #ccc; font-size: 0.9em; } #three-canvas { display: block; width: 100vw; height: 100vh; cursor: default; } #annotation-popup { visibility: hidden; opacity: 0; position: absolute; background-color: rgba(40, 40, 40, 0.9); border: 1px solid #666; border-radius: 5px; padding: 10px 15px; padding-bottom: 35px; color: #eee; max-width: 250px; min-width: 180px; z-index: 1001; pointer-events: auto; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 0.9em; line-height: 1.4; -webkit-user-select: none; -ms-user-select: none; user-select: none; transition: opacity 0.2s ease-in-out; } #annotation-popup.visible { visibility: visible; opacity: 1; } #annotation-popup h4 { margin: 0 0 8px 0; padding-bottom: 5px; border-bottom: 1px solid #555; font-size: 1.1em; color: #00aaff; } #annotation-popup p { margin: 0; white-space: pre-wrap; word-wrap: break-word; } #popup-close { position: absolute; top: 5px; right: 5px; background: rgba(80, 80, 80, 0.8); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; line-height: 18px; text-align: center; font-weight: bold; cursor: pointer; font-size: 14px; padding: 0; z-index: 2; } #popup-close:hover { background: rgba(120, 0, 0, 0.9); } .popup-nav { position: absolute; bottom: 8px; left: 15px; right: 15px; display: flex; justify-content: space-between; } .popup-nav button { background: rgba(80, 80, 80, 0.8); color: #fff; border: 1px solid #aaa; border-radius: 3px; padding: 2px 10px; cursor: pointer; font-size: 1.1em; } .popup-nav button:hover:not(:disabled) { background: rgba(100, 100, 100, 0.9); } .popup-nav button:disabled { opacity: 0.4; cursor: not-allowed; } #viewer-controls { position: absolute; bottom: 15px; right: 15px; z-index: 100; background-color: rgba(40, 40, 40, 0.8); padding: 8px 12px; border-radius: 5px; } #viewer-controls label { margin-right: 8px; vertical-align: middle; } #viewer-controls input[type="checkbox"] { vertical-align: middle; }
    </style>
</head>
<body>
    <div id="info">Đang tải viewer...</div> <canvas id="three-canvas"></canvas>
    <div id="annotation-popup"> <button id="popup-close">X</button> <h4 id="popup-name">Name</h4> <p id="popup-note">Note</p> <div class="popup-nav"> <button id="popup-prev">< Trước</button> <button id="popup-next">Sau ></button> </div> </div>
    <div id="viewer-controls"> <label for="viewer-toggle-annotations">Hiện Annotations:</label> <input type="checkbox" id="viewer-toggle-annotations"> </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
    <script src="https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js"><\/script> <script src="https://unpkg.com/three@0.128.0/examples/js/loaders/RGBELoader.js"><\/script> <script src="https://unpkg.com/three@0.128.0/examples/js/loaders/OBJLoader.js"><\/script> <script src="https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js"><\/script> <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.11.5/gsap.min.js"><\/script>
    <script>
        let scene, camera, renderer, controls, currentModel, currentEnvMap; const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let annotations = []; const annotationSprites = []; let annotationCounter = 1; const ANNOTATION_LAYER = 1; let popupElement, popupNameElement, popupNoteElement, popupCloseButton, popupPrevButton, popupNextButton; let currentPopupAnnotationId = null; const SPRITE_SCREEN_SIZE = 0.07; let annotationsVisible = true; let viewerToggleCheckbox = null; let embeddedData = null;
        const viewerDataString = ${embeddedDataJSONString}; // <<< Nhúng chuỗi JS

        document.addEventListener('DOMContentLoaded', () => {
            console.log("Viewer DOM loaded."); try { embeddedData = JSON.parse(viewerDataString); console.log("Embedded data parsed:", embeddedData); annotationsVisible = embeddedData.annotationsVisible !== undefined ? embeddedData.annotationsVisible : true; initViewerUI(); initThree(); initPopup(); addEventListeners(); loadDataFromEmbed(); } catch (error) { console.error("Lỗi parse/xử lý dữ liệu nhúng:", error); document.getElementById('info').textContent = 'Lỗi tải dữ liệu viewer!'; alert("Lỗi tải dữ liệu viewer."); } });
        function initViewerUI() { document.getElementById('info').textContent = 'Chế độ xem'; const controlsDiv = document.getElementById('viewer-controls'); viewerToggleCheckbox = document.getElementById('viewer-toggle-annotations'); if (controlsDiv && viewerToggleCheckbox) { controlsDiv.style.display = 'block'; viewerToggleCheckbox.checked = annotationsVisible; viewerToggleCheckbox.addEventListener('change', (event) => { annotationsVisible = event.target.checked; toggleAnnotationsVisibility(annotationsVisible); }); } else { console.error("Viewer controls missing."); } }
        function initThree() { scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1a1a); const canvas = document.getElementById('three-canvas'); camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000); camera.position.set(0, 1, 5); camera.layers.enable(0); camera.layers.enable(ANNOTATION_LAYER); renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(window.devicePixelRatio); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputEncoding = THREE.sRGBEncoding; controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.05; controls.target.set(0, 1, 0); controls.update(); const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); scene.add(ambientLight); const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); directionalLight.position.set(5, 10, 7.5); scene.add(directionalLight); animate(); }
		
        function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
		
        function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); hideAnnotationPopup(); }
        function initPopup() { popupElement = document.getElementById('annotation-popup'); popupNameElement = document.getElementById('popup-name'); popupNoteElement = document.getElementById('popup-note'); popupCloseButton = document.getElementById('popup-close'); popupPrevButton = document.getElementById('popup-prev'); popupNextButton = document.getElementById('popup-next'); if (!popupElement || !popupNameElement || !popupNoteElement || !popupCloseButton || !popupPrevButton || !popupNextButton) { console.error("Lỗi Popup Elements!"); return; } popupCloseButton.addEventListener('click', hideAnnotationPopup); popupPrevButton.addEventListener('click', navigateToPreviousAnnotation); popupNextButton.addEventListener('click', navigateToNextAnnotation); }
        function addEventListeners() { window.addEventListener('resize', onWindowResize); renderer.domElement.addEventListener('click', onSingleClick); }
        function loadDataFromEmbed() { if (!embeddedData) return; console.log("Loading from embed..."); if (embeddedData.exposure !== undefined) { renderer.toneMappingExposure = parseFloat(embeddedData.exposure) || 1.0; } try { if (!Array.isArray(embeddedData.annotations)) throw new Error("Invalid annotations data."); annotations = embeddedData.annotations.map(a => ({ ...a, position: new THREE.Vector3(a.position?.x || 0, a.position?.y || 0, a.position?.z || 0), cameraPosition: new THREE.Vector3(a.cameraPosition?.x || 0, a.cameraPosition?.y || 0, a.cameraPosition?.z || 0), cameraTarget: new THREE.Vector3(a.cameraTarget?.x || 0, a.cameraTarget?.y || 0, a.cameraTarget?.z || 0) })); annotationCounter = annotations.length > 0 ? Math.max(...annotations.map(a => a.id)) + 1 : 1; recreateAnnotationSpritesFromData(); toggleAnnotationsVisibility(annotationsVisible); } catch (e) { console.error("Lỗi annotations:", e); annotations = []; } const hdriPromise = new Promise((resolve) => { if (embeddedData.hdriDataUrl) { const loader = new THREE.RGBELoader(); loader.load(embeddedData.hdriDataUrl, (texture) => { texture.mapping = THREE.EquirectangularReflectionMapping; if (currentEnvMap) currentEnvMap.dispose(); scene.background = texture; scene.environment = texture; currentEnvMap = texture; resolve(); }, undefined, (error) => { console.error("Lỗi tải HDRI:", error); resolve(); }); } else { resolve(); } }); hdriPromise.then(() => { if (embeddedData.modelDataUrl && embeddedData.modelFileName) { let loader; const modelFilenameLower = embeddedData.modelFileName.toLowerCase(); try { if (modelFilenameLower.endsWith('.gltf') || modelFilenameLower.endsWith('.glb')) { loader = new THREE.GLTFLoader(); } else if (modelFilenameLower.endsWith('.obj')) { loader = new THREE.OBJLoader(); } else { throw new Error("Unsupported format."); } loader.load(embeddedData.modelDataUrl, (result) => { const modelToAdd = result.scene ? result.scene : result; if (!modelToAdd || !(modelToAdd instanceof THREE.Object3D)) throw new Error("Invalid model."); if(currentModel) scene.remove(currentModel); modelToAdd.traverse(child => { if (child.isMesh) { child.layers.set(0); applyEnvMapToModel(modelToAdd, currentEnvMap); } }); scene.add(modelToAdd); currentModel = modelToAdd; fitCameraToObject(currentModel, 1.5); document.getElementById('info').textContent = \`Xem model: \${embeddedData.modelFileName}\`; }, undefined, (error) => { console.error(\`Lỗi tải model:\`, error); alert("Lỗi tải model."); document.getElementById('info').textContent = 'Lỗi tải model!'; }); } catch(loaderError) { console.error("Lỗi loader model:", loaderError); alert("Lỗi xử lý model."); document.getElementById('info').textContent = 'Lỗi tải model!'; } } else { console.error("Thiếu model data/filename."); document.getElementById('info').textContent = 'Lỗi thiếu dữ liệu model!'; } }); }
        function onSingleClick(event) { if (annotationSprites.length === 0) return; updateMouseCoords(event); raycaster.setFromCamera(mouse, camera); raycaster.layers.set(ANNOTATION_LAYER); const intersects = raycaster.intersectObjects(annotationSprites.filter(s => s.visible), false); if (intersects.length > 0) { const clickedSprite = intersects[0].object; const annotationId = clickedSprite.userData.annotationId; const annotation = annotations.find(a => a.id === annotationId); if (annotation) { updatePopupContent(annotation); animateCameraToView(annotation.cameraPosition, annotation.cameraTarget); } } else { hideAnnotationPopup(); } }
        function updateMouseCoords(event) { const rect = renderer.domElement.getBoundingClientRect(); mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; }
        function createAnnotationSprite(annotationData) { const canvas = document.createElement('canvas'); const context = canvas.getContext('2d'); const size = 64; canvas.width = size; canvas.height = size; const number = annotationData.id.toString(); const radius = size / 2 - 4; context.fillStyle = 'rgba(0, 100, 220, 0.75)'; context.beginPath(); context.arc(size / 2, size / 2, radius, 0, Math.PI * 2); context.fill(); context.strokeStyle = 'rgba(255, 255, 255, 0.8)'; context.lineWidth = 2; context.stroke(); context.fillStyle = 'white'; context.font = \`bold \${size / 2.8}px Arial\`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(number, size / 2, size / 2 + 1); const texture = new THREE.CanvasTexture(canvas); texture.needsUpdate = true; const spriteMaterial = new THREE.SpriteMaterial({ map: texture, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0.85 }); const sprite = new THREE.Sprite(spriteMaterial); sprite.position.copy(annotationData.position); sprite.scale.set(SPRITE_SCREEN_SIZE, SPRITE_SCREEN_SIZE, SPRITE_SCREEN_SIZE); sprite.layers.set(ANNOTATION_LAYER); sprite.userData.annotationId = annotationData.id; sprite.userData.isAnnotation = true; return sprite; }
        function recreateAnnotationSpritesFromData() { annotationSprites.forEach(sprite => scene.remove(sprite)); annotationSprites.length = 0; annotations.forEach(annotationData => { try { if (!annotationData.position || typeof annotationData.position !== 'object') throw new Error('Missing position'); annotationData.position = new THREE.Vector3(annotationData.position.x, annotationData.position.y, annotationData.position.z); if (annotationData.cameraPosition && typeof annotationData.cameraPosition === 'object') annotationData.cameraPosition = new THREE.Vector3(annotationData.cameraPosition.x, annotationData.cameraPosition.y, annotationData.cameraPosition.z); else annotationData.cameraPosition = new THREE.Vector3(); if (annotationData.cameraTarget && typeof annotationData.cameraTarget === 'object') annotationData.cameraTarget = new THREE.Vector3(annotationData.cameraTarget.x, annotationData.cameraTarget.y, annotationData.cameraTarget.z); else annotationData.cameraTarget = new THREE.Vector3(); const sprite = createAnnotationSprite(annotationData); sprite.visible = annotationsVisible; scene.add(sprite); annotationSprites.push(sprite); } catch(e) { console.error(\`Error recreating sprite for annotation \${annotationData.id}:\`, e); } }); console.log(\`Viewer: Recreated \${annotationSprites.length} sprites.\`); }
        function toggleAnnotationsVisibility(isVisible) { annotationSprites.forEach(sprite => { sprite.visible = isVisible; }); if (!isVisible) hideAnnotationPopup(); if (viewerToggleCheckbox && viewerToggleCheckbox.checked !== isVisible) viewerToggleCheckbox.checked = isVisible; }
        function updatePopupContent(annotationData) { if (!popupNameElement || !popupNoteElement) return; if (!annotationData) { hideAnnotationPopup(); return; } popupNameElement.textContent = annotationData.name || '[No Name]'; popupNoteElement.textContent = annotationData.note || ''; currentPopupAnnotationId = annotationData.id; updatePopupNavButtons(); }
        function repositionCurrentPopup() { if (!popupElement || currentPopupAnnotationId === null) return; const annotation = annotations.find(a => a.id === currentPopupAnnotationId); if (!annotation) { hideAnnotationPopup(); return; } const position3D = annotation.position.clone(); const vector = position3D.project(camera); if (vector.z > 1) { hideAnnotationPopup(); return; } const screenX = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth; const screenY = (-vector.y * 0.5 + 0.5) * renderer.domElement.clientHeight; const popupWidth = popupElement.offsetWidth; const popupHeight = popupElement.offsetHeight; const spritePixelRadius = (SPRITE_SCREEN_SIZE * renderer.domElement.clientHeight) / 2; const gap = 10; let finalLeft = screenX + spritePixelRadius + gap; let finalTop = screenY - popupHeight / 2; if (finalLeft + popupWidth > window.innerWidth - 10) finalLeft = screenX - spritePixelRadius - gap - popupWidth; if (finalTop < 10) finalTop = 10; else if (finalTop + popupHeight > window.innerHeight - 10) finalTop = window.innerHeight - 10 - popupHeight; popupElement.style.left = \`\${Math.round(finalLeft)}px\`; popupElement.style.top = \`\${Math.round(finalTop)}px\`; popupElement.classList.add('visible'); }
        function hideAnnotationPopup() { if (popupElement) popupElement.classList.remove('visible'); currentPopupAnnotationId = null; }
        function updatePopupNavButtons() { if (!popupPrevButton || !popupNextButton || currentPopupAnnotationId === null || annotations.length <= 1) { if(popupPrevButton) popupPrevButton.disabled = true; if(popupNextButton) popupNextButton.disabled = true; return; } const sortedAnnotations = [...annotations].sort((a, b) => a.id - b.id); const currentIndex = sortedAnnotations.findIndex(a => a.id === currentPopupAnnotationId); popupPrevButton.disabled = (currentIndex <= 0); popupNextButton.disabled = (currentIndex >= sortedAnnotations.length - 1); }
        function navigateToPreviousAnnotation() { if (popupPrevButton.disabled || currentPopupAnnotationId === null) return; const sortedAnnotations = [...annotations].sort((a, b) => a.id - b.id); const currentIndex = sortedAnnotations.findIndex(a => a.id === currentPopupAnnotationId); if (currentIndex > 0) { const prevAnnotation = sortedAnnotations[currentIndex - 1]; updatePopupContent(prevAnnotation); animateCameraToView(prevAnnotation.cameraPosition, prevAnnotation.cameraTarget); } }
        function navigateToNextAnnotation() { if (popupNextButton.disabled || currentPopupAnnotationId === null) return; const sortedAnnotations = [...annotations].sort((a, b) => a.id - b.id); const currentIndex = sortedAnnotations.findIndex(a => a.id === currentPopupAnnotationId); if (currentIndex < sortedAnnotations.length - 1) { const nextAnnotation = sortedAnnotations[currentIndex + 1]; updatePopupContent(nextAnnotation); animateCameraToView(nextAnnotation.cameraPosition, nextAnnotation.cameraTarget); } }
        function animateCameraToView(targetPosition, targetTarget, duration = 1.2) { if (gsap.isTweening(camera.position) || gsap.isTweening(controls.target)) return; controls.enabled = false; gsap.to(camera.position, { duration: duration, x: targetPosition.x, y: targetPosition.y, z: targetPosition.z, ease: "power3.inOut", onComplete: () => { repositionCurrentPopup(); } }); gsap.to(controls.target, { duration: duration, x: targetTarget.x, y: targetTarget.y, z: targetTarget.z, ease: "power3.inOut", onUpdate: () => controls.update(), onComplete: () => { controls.enabled = true; controls.update(); } }); }
        function applyEnvMapToModel(model, envMap) { if (!model || !envMap) return; model.traverse(child => { if (child.isMesh && (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial)) { child.material.envMap = envMap; child.material.envMapIntensity = 1.0; child.material.needsUpdate = true; } }); console.log("Viewer: Applied env map."); }
        function fitCameraToObject(object, offset = 1.3) { const box = new THREE.Box3().setFromObject(object); const isBoxValid = !box.isEmpty() && Number.isFinite(box.min.x) && Number.isFinite(box.min.y) && Number.isFinite(box.min.z) && Number.isFinite(box.max.x) && Number.isFinite(box.max.y) && Number.isFinite(box.max.z); if (!isBoxValid) { console.warn("Viewer: Invalid BBox."); return false; } const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3()); const maxSize = Math.max(size.x, size.y, size.z); if (maxSize < Number.EPSILON) { console.warn("Viewer: Model size near zero."); camera.position.set(center.x, center.y, center.z + 1); controls.target.copy(center); controls.minDistance = 0.01; controls.maxDistance = 10; controls.update(); return false; } const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360)); const fitWidthDistance = fitHeightDistance / camera.aspect; const distance = offset * Math.max(fitHeightDistance, fitWidthDistance); const direction = controls.target.clone().sub(camera.position).normalize().multiplyScalar(distance); controls.maxDistance = distance * 20; controls.minDistance = Math.max(0.01, distance / 20); controls.target.copy(center); camera.near = Math.max(0.001, distance / 1000); camera.far = distance * 100; camera.updateProjectionMatrix(); camera.position.copy(controls.target).sub(direction); controls.update(); console.log("Viewer: Camera fit."); return true; }

    <\/script>
</body>
</html>`;
        } // Kết thúc hàm createViewerHTML
		
