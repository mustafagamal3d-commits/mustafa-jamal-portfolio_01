/**
 * GLB STUDIO PRO - ADVANCED 3D INSPECTOR & EDITOR ENGINE
 * Built on Three.js (r160) with GLTFLoader, GLTFExporter, OrbitControls,
 * Scene Hierarchy, Node Tree Deletion, 11 Material Channels, 3D Grid & Gizmo.
 */

import * as THREE from './libs/three.module.js';
import { OrbitControls } from './libs/OrbitControls.js';
import { GLTFLoader } from './libs/GLTFLoader.js';
import { GLTFExporter } from './libs/GLTFExporter.js';

// Global Studio State
let scene, camera, renderer, controls;
let currentModel = null;
let modelParentGroup = null;
let groundGrid = null;
let pivotHelper = null;
let flippedFaceGroup = null;
let directionalLight, ambientLight, fillLight;
let selectionBoxHelper = null;

let selectedNode = null;
let nodeElementMap = new Map();
let originalMaterialsMap = new Map();
let activeChannel = 'pbr';
let uvCheckerTexture = null;

let initialCameraState = {
  position: new THREE.Vector3(2, 1.5, 2.5),
  target: new THREE.Vector3(0, 0.5, 0)
};

const CHANNEL_LIST = [
  'pbr', 'baseColor', 'metallic', 'roughness', 'normal',
  'ao', 'emissive', 'alpha', 'clay', 'wireframe', 'uvChecker'
];

document.addEventListener('DOMContentLoaded', () => {
  initGlbStudio();
});

function initGlbStudio() {
  const container = document.getElementById('threeCanvasContainer');
  if (!container) return;

  // 1. Setup Three.js Scene, Camera, Renderer
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111726);

  const aspect = container.clientWidth / (container.clientHeight || 620);
  camera = new THREE.PerspectiveCamera(45, aspect, 0.05, 1000);
  camera.position.copy(initialCameraState.position);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(container.clientWidth, container.clientHeight || 620);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // 2. Setup OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.1;
  controls.maxDistance = 500;
  controls.target.copy(initialCameraState.target);

  // 3. Parent Group for Models & Helpers
  modelParentGroup = new THREE.Group();
  modelParentGroup.name = 'ModelParentGroup';
  scene.add(modelParentGroup);

  // 4. Ground Grid & Shadow Plane
  createGroundGrid();

  // 5. Lighting Setup
  setupStudioLighting();

  // 6. Helpers: Pivot & Flipped Faces
  pivotHelper = new THREE.AxesHelper(0.5);
  pivotHelper.visible = false;
  scene.add(pivotHelper);

  flippedFaceGroup = new THREE.Group();
  flippedFaceGroup.visible = false;
  scene.add(flippedFaceGroup);

  // 7. Procedural UV Checker Texture
  uvCheckerTexture = generateUvCheckerTexture();

  // 8. Handle Window / Container Resize
  const resizeObserver = new ResizeObserver(() => {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight || 620;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  // 9. Init UI Event Listeners & Shortcuts
  bindStudioUiEvents();
  bindKeyboardShortcuts();
  initOrientationGizmo();

  // 10. Load Initial Sample Model
  loadSampleChairModel();

  // 11. Animation Loop
  animate();
}

/**
 * Creates infinite-feel 3D Ground Grid
 */
function createGroundGrid() {
  const size = 10;
  const divisions = 20;
  groundGrid = new THREE.GridHelper(size, divisions, 0x00d9ff, 0x24324a);
  groundGrid.position.y = 0;
  groundGrid.material.opacity = 0.65;
  groundGrid.material.transparent = true;
  scene.add(groundGrid);
}

/**
 * Configures studio grade 3-point lighting + ambient
 */
function setupStudioLighting() {
  ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 25;
  directionalLight.shadow.bias = -0.0001;
  const d = 4;
  directionalLight.shadow.camera.left = -d;
  directionalLight.shadow.camera.right = d;
  directionalLight.shadow.camera.top = d;
  directionalLight.shadow.camera.bottom = -d;
  scene.add(directionalLight);

  fillLight = new THREE.DirectionalLight(0x93c5fd, 0.8);
  fillLight.position.set(-5, 4, -5);
  scene.add(fillLight);
}

/**
 * Procedural UV Checkerboard generator
 */
function generateUvCheckerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const rows = 16;
  const cols = 16;
  const blockW = 1024 / cols;
  const blockH = 1024 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isEven = (r + c) % 2 === 0;
      ctx.fillStyle = isEven ? '#f8fafc' : '#1e293b';
      ctx.fillRect(c * blockW, r * blockH, blockW, blockH);

      // Add coordinate text inside each block
      ctx.fillStyle = isEven ? '#0284c7' : '#38bdf8';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const colLetter = String.fromCharCode(65 + (c % 16));
      ctx.fillText(`${colLetter}${r + 1}`, c * blockW + blockW / 2, r * blockH + blockH / 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Load GLB Model from Blob or URL
 */
function loadGlbModel(source, fileName = 'Model.glb', fileSizeText = null) {
  const emptyState = document.getElementById('studioEmptyState');
  if (emptyState) emptyState.classList.remove('hidden');

  if (window.showToast) {
    window.showToast(`Loading: ${fileName}...`, 'info');
  }

  const loader = new GLTFLoader();
  loader.load(
    source,
    (gltf) => {
      onModelLoaded(gltf.scene, fileName, fileSizeText);
      if (emptyState) emptyState.classList.add('hidden');
      if (window.showToast) {
        window.showToast('3D Model loaded successfully!', 'success');
      }
    },
    (xhr) => {
      // Progress
    },
    (error) => {
      console.error('GLTF Load Error:', error);
      if (emptyState) emptyState.classList.add('hidden');
      if (window.showToast) {
        window.showToast('Failed to load GLB file. Please check format.', 'error');
      }
    }
  );
}

function loadSampleChairModel() {
  loadGlbModel('assets/models/sample-chair.glb', 'sample-chair.glb', '4.12 MB');
}

/**
 * Process Loaded Model
 */
function onModelLoaded(modelScene, fileName, fileSizeText) {
  // 1. Clear previous model
  while (modelParentGroup.children.length > 0) {
    const obj = modelParentGroup.children[0];
    modelParentGroup.remove(obj);
  }
  originalMaterialsMap.clear();
  nodeElementMap.clear();
  selectedNode = null;
  flippedFaceGroup.clear();

  currentModel = modelScene;
  modelParentGroup.add(currentModel);

  // 2. Enable shadows and backup materials
  currentModel.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        if (Array.isArray(node.material)) {
          originalMaterialsMap.set(node, [...node.material]);
        } else {
          originalMaterialsMap.set(node, node.material);
        }
      }
    }
  });

  // 3. Auto-fit and center model on grid floor
  fitModelToView(currentModel);

  // 4. Calculate Stats & Dimensions
  calculateModelStatistics(fileSizeText || 'Local Asset');
  updateBoundingBoxDimensions();

  // 5. Build Node Tree in Left Sidebar
  buildSceneHierarchyTree(currentModel);

  // 6. Build Flipped Faces Diagnostic Meshes
  buildFlippedFacesGroup(currentModel);

  // 7. Reset active material channel to Full PBR
  setMaterialChannel('pbr');
}

/**
 * Centers model and positions camera to frame it
 */
function fitModelToView(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Center model so its base sits on Y=0 grid
  model.position.x -= center.x;
  model.position.y -= box.min.y;
  model.position.z -= center.z;

  // Re-compute bounding box with updated position
  box.setFromObject(model);
  box.getSize(size);
  const newCenter = box.getCenter(new THREE.Vector3());

  // Adjust grid size to encompass model
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const targetCamDist = maxDim * 1.8;

  camera.position.set(targetCamDist * 0.9, targetCamDist * 0.7, targetCamDist * 1.2);
  controls.target.copy(newCenter);
  controls.update();

  initialCameraState.position.copy(camera.position);
  initialCameraState.target.copy(controls.target);

  // Position pivot helper at center
  pivotHelper.position.copy(newCenter);
  pivotHelper.scale.set(maxDim * 0.25, maxDim * 0.25, maxDim * 0.25);
}

/**
 * Calculates accurate statistics: Triangles, Vertices, Geometries, Materials, Textures, Texture RAM
 */
function calculateModelStatistics(fileSizeDisplay) {
  if (!currentModel) return;

  let triangles = 0;
  let vertices = 0;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  let totalTextureBytes = 0;

  currentModel.traverse((node) => {
    if (node.isMesh && node.geometry) {
      const geom = node.geometry;
      geometries.add(geom);

      if (geom.index) {
        triangles += geom.index.count / 3;
      } else if (geom.attributes.position) {
        triangles += geom.attributes.position.count / 3;
      }

      if (geom.attributes.position) {
        vertices += geom.attributes.position.count;
      }

      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((mat) => {
        if (!mat) return;
        materials.add(mat);

        const texProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
        texProps.forEach((prop) => {
          const tex = mat[prop];
          if (tex && tex.isTexture && !textures.has(tex)) {
            textures.add(tex);
            if (tex.image && tex.image.width && tex.image.height) {
              // 4 bytes per RGBA pixel * 1.33 for mipmaps
              totalTextureBytes += tex.image.width * tex.image.height * 4 * 1.33;
            } else {
              // Fallback estimated standard 1024x1024
              totalTextureBytes += 1024 * 1024 * 4 * 1.33;
            }
          }
        });
      });
    }
  });

  const estRamMB = (totalTextureBytes / (1024 * 1024)).toFixed(2);

  // Update UI Elements
  const statFileSize = document.getElementById('statFileSize');
  const statPolygons = document.getElementById('statPolygons');
  const statVertices = document.getElementById('statVertices');
  const statGeometries = document.getElementById('statGeometries');
  const statMaterials = document.getElementById('statMaterialsCount');
  const statTextures = document.getElementById('statTexturesCount');
  const statTextureRam = document.getElementById('statTextureRam');

  if (statFileSize) statFileSize.textContent = fileSizeDisplay;
  if (statPolygons) statPolygons.textContent = Math.round(triangles).toLocaleString();
  if (statVertices) statVertices.textContent = vertices.toLocaleString();
  if (statGeometries) statGeometries.textContent = geometries.size.toString();
  if (statMaterials) statMaterials.textContent = materials.size.toString();
  if (statTextures) statTextures.textContent = textures.size.toString();
  if (statTextureRam) statTextureRam.textContent = `${estRamMB} MB`;
}

/**
 * Overall Dimensions (Bounding Box) in cm
 */
function updateBoundingBoxDimensions() {
  if (!currentModel) return;

  const box = new THREE.Box3().setFromObject(currentModel);
  const size = box.getSize(new THREE.Vector3());

  // Dimensions in centimeters
  const xCm = (size.x * 100).toFixed(1);
  const yCm = (size.y * 100).toFixed(1);
  const zCm = (size.z * 100).toFixed(1);

  const dimX = document.getElementById('dimXVal');
  const dimY = document.getElementById('dimYVal');
  const dimZ = document.getElementById('dimZVal');

  if (dimX) dimX.textContent = `${xCm} cm`;
  if (dimY) dimY.textContent = `${yCm} cm`;
  if (dimZ) dimZ.textContent = `${zCm} cm`;
}

/**
 * Builds interactive Node Tree in left sidebar
 */
function buildSceneHierarchyTree(model) {
  const treeContainer = document.getElementById('studioNodeTree');
  if (!treeContainer) return;
  treeContainer.innerHTML = '';

  const rootRow = createTreeNodeElement(model, 'Scene (Root)', '📁', 0);
  treeContainer.appendChild(rootRow);

  function recurse(node, depth) {
    if (!node.children || node.children.length === 0) return;

    node.children.forEach((child) => {
      const isMesh = child.isMesh;
      const icon = isMesh ? '🔷' : '📁';
      const name = child.name || (isMesh ? 'Mesh_Node' : 'Group_Node');
      const row = createTreeNodeElement(child, name, icon, depth);
      treeContainer.appendChild(row);

      // Display associated material tag if mesh
      if (isMesh && child.material) {
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        if (mat) {
          const matRow = document.createElement('div');
          matRow.className = 'studio-tree-node';
          matRow.style.paddingLeft = `${(depth + 1) * 16}px`;
          matRow.style.fontSize = '0.72rem';
          matRow.style.color = '#94a3b8';
          matRow.innerHTML = `<span>🏷️ Material: ${mat.name || 'PBR_Material'}</span>`;
          treeContainer.appendChild(matRow);
        }
      }

      recurse(child, depth + 1);
    });
  }

  recurse(model, 1);
}

function createTreeNodeElement(node, label, icon, depth) {
  const row = document.createElement('div');
  row.className = 'studio-tree-node';
  row.style.paddingLeft = `${depth * 14 + 6}px`;

  const leftSide = document.createElement('div');
  leftSide.className = 'studio-tree-label';
  leftSide.innerHTML = `<span>${icon}</span> <span>${label}</span>`;

  const eyeBtn = document.createElement('button');
  eyeBtn.className = 'studio-tree-eye-btn';
  eyeBtn.title = 'Toggle Visibility';
  eyeBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;

  eyeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    node.visible = !node.visible;
    eyeBtn.classList.toggle('hidden-node', !node.visible);
  });

  row.appendChild(leftSide);
  row.appendChild(eyeBtn);

  // Select Node on click
  row.addEventListener('click', () => {
    document.querySelectorAll('.studio-tree-node').forEach((el) => el.classList.remove('selected'));
    row.classList.add('selected');
    selectNode(node);
  });

  nodeElementMap.set(node, row);
  return row;
}

function selectNode(node) {
  selectedNode = node;

  if (selectionBoxHelper) {
    scene.remove(selectionBoxHelper);
    selectionBoxHelper = null;
  }

  if (selectedNode && selectedNode !== currentModel) {
    selectionBoxHelper = new THREE.BoxHelper(selectedNode, 0x38bdf8);
    scene.add(selectionBoxHelper);
  }
}

/**
 * Delete Selected Node Action
 */
function deleteSelectedNode() {
  if (!selectedNode || selectedNode === currentModel || selectedNode === modelParentGroup) {
    if (window.showToast) {
      window.showToast('Please select a specific child mesh or node to delete', 'info');
    }
    return;
  }

  const parent = selectedNode.parent;
  if (parent) {
    parent.remove(selectedNode);
    if (selectionBoxHelper) {
      scene.remove(selectionBoxHelper);
      selectionBoxHelper = null;
    }
    selectedNode = null;

    // Refresh hierarchy and calculations
    buildSceneHierarchyTree(currentModel);
    calculateModelStatistics('Modified Scene');
    updateBoundingBoxDimensions();

    if (window.showToast) {
      window.showToast('Selected node deleted from scene', 'success');
    }
  }
}

/**
 * Flipped Faces diagnostic mesh generator
 */
function buildFlippedFacesGroup(model) {
  flippedFaceGroup.clear();
  const backfaceMat = new THREE.MeshBasicMaterial({
    color: 0xff0044,
    side: THREE.BackSide,
    wireframe: false
  });

  model.traverse((node) => {
    if (node.isMesh && node.geometry) {
      const redMesh = new THREE.Mesh(node.geometry, backfaceMat);
      redMesh.matrixAutoUpdate = false;
      redMesh.matrix.copy(node.matrixWorld);
      flippedFaceGroup.add(redMesh);
    }
  });
}

/**
 * Material Channels Engine: 11 Modes
 */
function setMaterialChannel(channelName) {
  activeChannel = channelName;

  // Update button active states
  document.querySelectorAll('.studio-channel-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.channel === channelName);
  });

  if (!currentModel) return;

  currentModel.traverse((node) => {
    if (node.isMesh) {
      const orig = originalMaterialsMap.get(node);
      if (!orig) return;

      const singleOrig = Array.isArray(orig) ? orig[0] : orig;

      switch (channelName) {
        case 'pbr':
          node.material = orig;
          break;

        case 'baseColor':
          if (singleOrig.map) {
            node.material = new THREE.MeshBasicMaterial({
              map: singleOrig.map,
              color: singleOrig.color || 0xffffff
            });
          } else {
            node.material = new THREE.MeshBasicMaterial({
              color: singleOrig.color || 0xcccccc
            });
          }
          break;

        case 'metallic':
          // Display metalness map in grayscale or fallback color
          if (singleOrig.metalnessMap) {
            node.material = new THREE.MeshBasicMaterial({ map: singleOrig.metalnessMap });
          } else {
            const m = typeof singleOrig.metalness === 'number' ? singleOrig.metalness : 0.5;
            node.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(m, m, m) });
          }
          break;

        case 'roughness':
          // Display roughness map in grayscale or fallback color
          if (singleOrig.roughnessMap) {
            node.material = new THREE.MeshBasicMaterial({ map: singleOrig.roughnessMap });
          } else {
            const r = typeof singleOrig.roughness === 'number' ? singleOrig.roughness : 0.5;
            node.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(r, r, r) });
          }
          break;

        case 'normal':
          if (singleOrig.normalMap) {
            node.material = new THREE.MeshNormalMaterial({
              normalMap: singleOrig.normalMap,
              normalScale: singleOrig.normalScale || new THREE.Vector2(1, 1)
            });
          } else {
            node.material = new THREE.MeshNormalMaterial();
          }
          break;

        case 'ao':
          if (singleOrig.aoMap) {
            node.material = new THREE.MeshBasicMaterial({ map: singleOrig.aoMap });
          } else {
            node.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
          }
          break;

        case 'emissive':
          if (singleOrig.emissiveMap) {
            node.material = new THREE.MeshBasicMaterial({
              map: singleOrig.emissiveMap,
              color: singleOrig.emissive || 0xffffff
            });
          } else if (singleOrig.emissive && singleOrig.emissive.getHex() > 0) {
            node.material = new THREE.MeshBasicMaterial({ color: singleOrig.emissive });
          } else {
            node.material = new THREE.MeshBasicMaterial({ color: 0x000000 });
          }
          break;

        case 'alpha':
          if (singleOrig.alphaMap) {
            node.material = new THREE.MeshBasicMaterial({ map: singleOrig.alphaMap });
          } else {
            const op = typeof singleOrig.opacity === 'number' ? singleOrig.opacity : 1.0;
            node.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(op, op, op) });
          }
          break;

        case 'clay':
          node.material = new THREE.MeshStandardMaterial({
            color: 0xd8d8d8,
            roughness: 0.85,
            metalness: 0.05
          });
          break;

        case 'wireframe':
          node.material = new THREE.MeshBasicMaterial({
            color: 0x0284c7,
            wireframe: true
          });
          break;

        case 'uvChecker':
          node.material = new THREE.MeshBasicMaterial({
            map: uvCheckerTexture
          });
          break;
      }
    }
  });
}

/**
 * GLTF/GLB Exporter
 */
function exportGlbFile() {
  if (!currentModel) {
    if (window.showToast) window.showToast('No 3D model loaded to export', 'error');
    return;
  }

  // Ensure model is set to original PBR materials before export
  setMaterialChannel('pbr');

  if (window.showToast) window.showToast('Packaging GLB binary file...', 'info');

  const exporter = new GLTFExporter();
  exporter.parse(
    currentModel,
    (glbArrayBuffer) => {
      const blob = new Blob([glbArrayBuffer], { type: 'model/gltf-binary' });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = `glb-studio-export-${Date.now()}.glb`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(downloadLink.href);

      if (window.showToast) {
        window.showToast('GLB file exported and downloaded successfully!', 'success');
      }
    },
    (error) => {
      console.error('Export GLB error:', error);
      if (window.showToast) {
        window.showToast('Failed to export GLB: ' + error.message, 'error');
      }
    },
    { binary: true }
  );
}

/**
 * UI Events & Bindings
 */
function bindStudioUiEvents() {
  // 1. Open File Input
  const fileInput = document.getElementById('studioFileInput');
  const openFileBtn = document.getElementById('studioOpenFileBtn');
  if (openFileBtn && fileInput) {
    openFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        loadGlbModel(url, file.name, sizeMb);
      }
    });
  }

  // 2. Export GLB
  const exportBtn = document.getElementById('studioExportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportGlbFile);
  }

  // 3. Load Sample Model Button
  const loadSampleBtn = document.getElementById('studioSampleBtn');
  if (loadSampleBtn) {
    loadSampleBtn.addEventListener('click', loadSampleChairModel);
  }

  // 4. Delete Selected Node
  const deleteBtn = document.getElementById('btnDeleteSelectedNode');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deleteSelectedNode);
  }

  // 5. Floating Viewport Buttons: Focus (F) & Reset View (R)
  const focusBtn = document.getElementById('btnFocusModel');
  if (focusBtn) {
    focusBtn.addEventListener('click', focusCameraOnSelection);
  }

  const resetBtn = document.getElementById('btnResetView');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetCameraView);
  }

  // 6. Right Panel: Sliders & Switches
  // Light Intensity
  const lightSlider = document.getElementById('sliderLightIntensity');
  const lightValText = document.getElementById('valLightIntensity');
  if (lightSlider) {
    lightSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (lightValText) lightValText.textContent = val.toFixed(1);
      if (directionalLight) directionalLight.intensity = val * 1.2;
      if (ambientLight) ambientLight.intensity = val * 0.8;
    });
  }

  // Exposure
  const exposureSlider = document.getElementById('sliderExposure');
  const exposureValText = document.getElementById('valExposure');
  if (exposureSlider) {
    exposureSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (exposureValText) exposureValText.textContent = val.toFixed(1);
      if (renderer) renderer.toneMappingExposure = val;
    });
  }

  // Show Shadows Toggle
  const toggleShadows = document.getElementById('toggleShowShadows');
  if (toggleShadows) {
    toggleShadows.addEventListener('change', (e) => {
      const active = e.target.checked;
      if (directionalLight) directionalLight.castShadow = active;
      if (renderer) renderer.shadowMap.enabled = active;
    });
  }

  // Show Grid Toggle
  const toggleGrid = document.getElementById('toggleShowGrid');
  if (toggleGrid) {
    toggleGrid.addEventListener('change', (e) => {
      if (groundGrid) groundGrid.visible = e.target.checked;
    });
  }

  // Show Pivot Toggle
  const togglePivot = document.getElementById('toggleShowPivot');
  if (togglePivot) {
    togglePivot.addEventListener('change', (e) => {
      if (pivotHelper) pivotHelper.visible = e.target.checked;
    });
  }

  // Show Flipped Face Toggle
  const toggleFlipped = document.getElementById('toggleShowFlipped');
  if (toggleFlipped) {
    toggleFlipped.addEventListener('change', (e) => {
      if (flippedFaceGroup) flippedFaceGroup.visible = e.target.checked;
    });
  }

  // Background Color
  const bgColorInput = document.getElementById('inputBgColor');
  const viewportArea = document.querySelector('.studio-viewport-area');
  if (bgColorInput) {
    bgColorInput.addEventListener('input', (e) => {
      const col = e.target.value;
      if (scene) scene.background = new THREE.Color(col);
      if (viewportArea) viewportArea.style.backgroundColor = col;
    });
  }

  // Material Channels Stack
  document.querySelectorAll('.studio-channel-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ch = btn.dataset.channel;
      if (ch) setMaterialChannel(ch);
    });
  });

  // Drag & Drop on Viewport
  const dropOverlay = document.getElementById('studioDropzoneOverlay');
  if (viewportArea && dropOverlay) {
    ['dragenter', 'dragover'].forEach((evt) => {
      viewportArea.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropOverlay.classList.add('active');
      });
    });

    ['dragleave', 'drop'].forEach((evt) => {
      viewportArea.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropOverlay.classList.remove('active');
      });
    });

    viewportArea.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      const file = Array.from(files).find((f) =>
        f.name.toLowerCase().endsWith('.glb') || f.name.toLowerCase().endsWith('.gltf')
      );
      if (file) {
        const url = URL.createObjectURL(file);
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        loadGlbModel(url, file.name, sizeMb);
      } else {
        if (window.showToast) window.showToast('Please drop a valid .glb or .gltf file', 'error');
      }
    });
  }

  // Tabs: 3D Viewer & Inspector vs PBR Texture Gallery
  const tabViewer = document.getElementById('tabViewerInspector');
  const tabGallery = document.getElementById('tabTextureGallery');
  const galleryPanel = document.getElementById('studioGalleryPanel');
  const workstation = document.getElementById('studioWorkstation');

  if (tabViewer && tabGallery && galleryPanel && workstation) {
    tabViewer.addEventListener('click', () => {
      tabViewer.classList.add('active');
      tabGallery.classList.remove('active');
      workstation.style.display = 'grid';
      galleryPanel.classList.remove('active');
    });

    tabGallery.addEventListener('click', () => {
      tabGallery.classList.add('active');
      tabViewer.classList.remove('active');
      workstation.style.display = 'none';
      galleryPanel.classList.add('active');
    });
  }

  // AR QR Code & Direct Mobile AR Modal Trigger
  const openArBtn = document.getElementById('openArTriggerBtn');
  const arModal = document.getElementById('arModal');
  const closeArModal = document.getElementById('closeArModal');
  const arDesktopQrBox = document.getElementById('arDesktopQrBox');
  const arMobileDirectBox = document.getElementById('arMobileDirectBox');
  const arMobileLaunchBtn = document.getElementById('arMobileLaunchBtn');
  const arModalSubtitle = document.getElementById('arModalSubtitle');

  if (openArBtn && arModal) {
    openArBtn.addEventListener('click', () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      const currentUrl = encodeURIComponent(window.location.href);
      const qrImg = document.getElementById('arQrCodeImg');
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${currentUrl}&color=0077b6&bgcolor=ffffff`;
      }

      if (isMobile) {
        if (arDesktopQrBox) arDesktopQrBox.style.display = 'none';
        if (arMobileDirectBox) arMobileDirectBox.style.display = 'block';
        if (arModalSubtitle) arModalSubtitle.textContent = 'Tap below to launch augmented reality and place this 3D model into your physical space.';
        
        // Resolve model URL for native AR intent
        const sampleModelPath = 'assets/models/sample-chair.glb';
        const absoluteModelUrl = new URL(sampleModelPath, window.location.href).href;
        
        if (isAndroid && arMobileLaunchBtn) {
          arMobileLaunchBtn.href = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(absoluteModelUrl)}&mode=ar_only#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end;`;
        } else if (arMobileLaunchBtn) {
          arMobileLaunchBtn.href = window.location.href;
        }
      } else {
        if (arDesktopQrBox) arDesktopQrBox.style.display = 'inline-block';
        if (arMobileDirectBox) arMobileDirectBox.style.display = 'none';
        if (arModalSubtitle) arModalSubtitle.textContent = 'Scan this QR code with your iPhone or Android camera to place this 3D model in your room at real-world scale.';
      }

      arModal.classList.add('active');
    });
  }
  if (closeArModal && arModal) {
    closeArModal.addEventListener('click', () => {
      arModal.classList.remove('active');
    });
    arModal.addEventListener('click', (e) => {
      if (e.target === arModal) arModal.classList.remove('active');
    });
  }
}

/**
 * Camera Actions
 */
function focusCameraOnSelection() {
  const targetObj = selectedNode || currentModel;
  if (!targetObj) return;

  const box = new THREE.Box3().setFromObject(targetObj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.5);

  controls.target.copy(center);
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  camera.position.copy(center).add(dir.multiplyScalar(maxDim * 2.0));
  controls.update();

  if (window.showToast) window.showToast('Camera focused on target', 'info');
}

function resetCameraView() {
  camera.position.copy(initialCameraState.position);
  controls.target.copy(initialCameraState.target);
  controls.update();
  if (window.showToast) window.showToast('View reset to default', 'info');
}

/**
 * Keyboard Shortcuts
 */
function bindKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();
    if (key === 'r') {
      resetCameraView();
    } else if (key === 'f') {
      focusCameraOnSelection();
    } else if (key === 'm') {
      setMaterialChannel('pbr');
      if (window.showToast) window.showToast('Channel: Full PBR', 'info');
    } else if (key === 'c') {
      // Cycle Channels
      const idx = CHANNEL_LIST.indexOf(activeChannel);
      const nextIdx = (idx + 1) % CHANNEL_LIST.length;
      setMaterialChannel(CHANNEL_LIST[nextIdx]);
      if (window.showToast) window.showToast(`Channel: ${CHANNEL_LIST[nextIdx]}`, 'info');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNode) {
        deleteSelectedNode();
      }
    }
  });
}

/**
 * 3D Orientation Gizmo (Mini Canvas in bottom right corner)
 */
let gizmoCanvas, gizmoCtx;

function initOrientationGizmo() {
  gizmoCanvas = document.getElementById('orientationGizmoCanvas');
  if (!gizmoCanvas) return;
  gizmoCtx = gizmoCanvas.getContext('2d');
}

function renderOrientationGizmo() {
  if (!gizmoCanvas || !gizmoCtx || !camera) return;

  const w = gizmoCanvas.width;
  const h = gizmoCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = 28;

  gizmoCtx.clearRect(0, 0, w, h);

  // Transform world axes into camera space
  const rotMatrix = new THREE.Matrix4().extractRotation(camera.matrixWorldInverse);

  const axes = [
    { label: 'X', color: '#ef4444', vec: new THREE.Vector3(1, 0, 0) },
    { label: 'Y', color: '#10b981', vec: new THREE.Vector3(0, 1, 0) },
    { label: 'Z', color: '#3b82f6', vec: new THREE.Vector3(0, 0, 1) }
  ];

  axes.forEach((axis) => {
    axis.trans = axis.vec.clone().applyMatrix4(rotMatrix);
  });

  // Sort back-to-front
  axes.sort((a, b) => a.trans.z - b.trans.z);

  axes.forEach((axis) => {
    const x = cx + axis.trans.x * radius;
    const y = cy - axis.trans.y * radius; // inverted screen Y

    // Draw axis line
    gizmoCtx.beginPath();
    gizmoCtx.moveTo(cx, cy);
    gizmoCtx.lineTo(x, y);
    gizmoCtx.strokeStyle = axis.color;
    gizmoCtx.lineWidth = 2.5;
    gizmoCtx.stroke();

    // Draw tip sphere
    gizmoCtx.beginPath();
    gizmoCtx.arc(x, y, 7, 0, Math.PI * 2);
    gizmoCtx.fillStyle = axis.color;
    gizmoCtx.fill();

    // Draw label
    gizmoCtx.fillStyle = '#ffffff';
    gizmoCtx.font = 'bold 8px sans-serif';
    gizmoCtx.textAlign = 'center';
    gizmoCtx.textBaseline = 'middle';
    gizmoCtx.fillText(axis.label, x, y);
  });
}

/**
 * Main Render Loop
 */
function animate() {
  requestAnimationFrame(animate);

  if (controls) controls.update();
  if (selectionBoxHelper) selectionBoxHelper.update();

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }

  renderOrientationGizmo();
}
