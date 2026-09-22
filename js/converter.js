/**
 * GLTF/GLB PACKER & 3D TEXTURE OPTIMIZER PIPELINE
 * 100% Client-Side WebGL Architecture
 * Built on Three.js (r160) with GLTFLoader, GLTFExporter, OrbitControls, and JSZip
 */

import * as THREE from './libs/three.module.js';
import { GLTFLoader } from './libs/GLTFLoader.js';
import { GLTFExporter } from './libs/GLTFExporter.js';
import { OrbitControls } from './libs/OrbitControls.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initConverterPipeline);
} else {
  initConverterPipeline();
}

function initConverterPipeline() {
  // State
  let activeMode = 'to-glb'; // 'to-glb' | 'to-gltf'
  let currentModel = null;
  let currentModelGroup = null;
  let modelFileName = 'model-optimized.glb';
  let initialTotalBytes = 0;
  let estimatedTotalBytes = 0;
  let coreGeometryBytes = 0;
  let originalMaterialsMap = new Map();
  let detectedTextures = []; // Array of { id, name, originalSize, originalWidth, originalHeight, format, quality, maxRes, keep, role, texture, canvas, thumbUrl, estSize, compressedBlob }
  let activeShaderMode = 'lit';
  let isAutoRotating = false;

  // Viewport Three.js instances
  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let animFrameId = null;

  // DOM Elements
  const tabToGlb = document.getElementById('tabToGlb');
  const tabToGltf = document.getElementById('tabToGltf');
  const dropArea = document.getElementById('converterDropArea');
  const fileInput = document.getElementById('converterFileInput');
  const browseFilesBtn = document.getElementById('browseFilesBtn');
  const loadSampleBtn = document.getElementById('loadSampleConverterBtn');
  const dropTitle = document.getElementById('dropTitle');
  const dropSubtitle = document.getElementById('dropSubtitle');

  // Pipeline Grid (Packer)
  const packerPipelineGrid = document.getElementById('packerPipelineGrid');
  const coreAssetsCountBadge = document.getElementById('coreAssetsCountBadge');
  const coreAssetsList = document.getElementById('coreAssetsList');
  const texturesCountBadge = document.getElementById('texturesCountBadge');
  const textureItemList = document.getElementById('textureItemList');
  const globalFormatSelect = document.getElementById('globalFormatSelect');
  const globalQualitySlider = document.getElementById('globalQualitySlider');
  const globalQualityVal = document.getElementById('globalQualityVal');
  const globalResSelect = document.getElementById('globalResSelect');

  // Packing Summary
  const outputFileNameInput = document.getElementById('outputFileNameInput');
  const summaryInitialSize = document.getElementById('summaryInitialSize');
  const summaryOptimizedSize = document.getElementById('summaryOptimizedSize');
  const summarySavingsBadge = document.getElementById('summarySavingsBadge');
  const summaryChannelsCount = document.getElementById('summaryChannelsCount');
  const resetPipelineBtn = document.getElementById('resetPipelineBtn');
  const startPackGlbBtn = document.getElementById('startPackGlbBtn');
  const exportZipBtn = document.getElementById('exportZipBtn');
  const convertProgressContainer = document.getElementById('convertProgressContainer');
  const convertProgressBar = document.getElementById('convertProgressBar');
  const convertStatusText = document.getElementById('convertStatusText');
  const convertPercentText = document.getElementById('convertPercentText');

  // 3D Viewport
  const liveViewportCanvas = document.getElementById('liveViewportCanvas');
  const liveViewportContainer = document.getElementById('liveViewportContainer');
  const viewportLoader = document.getElementById('viewportLoader');
  const vpTrisCount = document.getElementById('vpTrisCount');
  const vpVertsCount = document.getElementById('vpVertsCount');
  const vpArReadyBadge = document.getElementById('vpArReadyBadge');
  const vpAutoRotateBtn = document.getElementById('vpAutoRotateBtn');

  // Unpacker Elements
  const unpackerPipelineContainer = document.getElementById('unpackerPipelineContainer');
  const unpackerFileBadge = document.getElementById('unpackerFileBadge');
  const unpackerDetailsBox = document.getElementById('unpackerDetailsBox');
  const unpackerEmptyPrompt = document.getElementById('unpackerEmptyPrompt');
  const unpackerModelName = document.getElementById('unpackerModelName');
  const unpackerModelSize = document.getElementById('unpackerModelSize');
  const unpackerExtractedStats = document.getElementById('unpackerExtractedStats');
  const unpackerFilesList = document.getElementById('unpackerFilesList');
  const resetUnpackerBtn = document.getElementById('resetUnpackerBtn');
  const startUnpackZipBtn = document.getElementById('startUnpackZipBtn');

  if (!dropArea) return;

  // Initialize Viewport Scene
  initViewport();

  // =========================================================================
  // 1. TABS & MODE SWITCHING
  // =========================================================================
  function setMode(mode) {
    activeMode = mode;
    if (mode === 'to-glb') {
      tabToGlb.classList.add('active');
      tabToGltf.classList.remove('active');
      dropTitle.innerHTML = 'Drag &amp; Drop .gltf + .bin + texture files or .glb';
      dropSubtitle.textContent = 'Package 3D models and optimize textures with WebP/JPEG compression. 100% private in-browser WebGL pipeline.';
      fileInput.setAttribute('multiple', '');
      fileInput.accept = '.gltf,.bin,.png,.jpg,.jpeg,.webp,.glb';
      if (detectedTextures.length > 0 || currentModel) {
        packerPipelineGrid.style.display = 'grid';
        dropArea.classList.add('is-collapsed');
      } else {
        packerPipelineGrid.style.display = 'none';
        dropArea.classList.remove('is-collapsed');
      }
      unpackerPipelineContainer.style.display = 'none';
    } else {
      tabToGltf.classList.add('active');
      tabToGlb.classList.remove('active');
      dropTitle.innerHTML = 'Drag &amp; Drop a single .glb model to unpack';
      dropSubtitle.textContent = 'Extract embedded geometry buffers, scene hierarchy JSON, and uncompressed PBR texture maps into a standard glTF bundle.';
      fileInput.removeAttribute('multiple');
      fileInput.accept = '.glb';
      packerPipelineGrid.style.display = 'none';
      unpackerPipelineContainer.style.display = 'block';
    }
  }

  tabToGlb.addEventListener('click', () => setMode('to-glb'));
  tabToGltf.addEventListener('click', () => setMode('to-gltf'));

  // =========================================================================
  // 2. DROPZONE & FILE SELECTION
  // =========================================================================
  if (browseFilesBtn) {
    browseFilesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  dropArea.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    handleFilesSelected(Array.from(e.target.files));
  });

  ['dragenter', 'dragover'].forEach(name => {
    dropArea.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropArea.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropArea.classList.remove('drag-over');
    });
  });

  dropArea.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files);
    handleFilesSelected(files);
  });

  // Sample Model Button
  if (loadSampleBtn) {
    loadSampleBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        window.showToast?.('Loading sample 3D Lounge Chair model...', 'info');
        const resp = await fetch('assets/models/sample-chair.glb');
        if (!resp.ok) throw new Error('Could not fetch sample model');
        const blob = await resp.blob();
        const sampleFile = new File([blob], 'sample-chair.glb', { type: 'model/gltf-binary' });
        
        if (activeMode === 'to-gltf') {
          handleUnpackerGlb(sampleFile);
        } else {
          handleFilesSelected([sampleFile]);
        }
      } catch (err) {
        window.showToast?.('Sample loading error: ' + err.message, 'error');
      }
    });
  }

  // =========================================================================
  // 3. FILE INGESTION & PIPELINE TRIGGER
  // =========================================================================
  async function handleFilesSelected(files) {
    if (!files || files.length === 0) return;

    const hasGlb = files.some(f => f.name.toLowerCase().endsWith('.glb'));
    const hasGltf = files.some(f => f.name.toLowerCase().endsWith('.gltf'));

    if (activeMode === 'to-gltf') {
      const glbFile = files.find(f => f.name.toLowerCase().endsWith('.glb'));
      if (!glbFile) {
        window.showToast?.('Please upload a .glb file to unpack', 'error');
        return;
      }
      handleUnpackerGlb(glbFile);
      return;
    }

    // Mode: to-glb
    showViewportLoading(true);
    dropArea.classList.add('is-collapsed');
    packerPipelineGrid.style.display = 'grid';

    try {
      if (hasGlb && !hasGltf && files.length === 1) {
        // Direct GLB optimization
        const glbFile = files[0];
        modelFileName = glbFile.name.replace(/\.[^/.]+$/, '') + '-optimized.glb';
        outputFileNameInput.value = modelFileName;
        initialTotalBytes = glbFile.size;
        
        await loadGlbModel(glbFile);
      } else if (hasGltf || hasGlb) {
        // Multi-file GLTF bundle (.gltf + .bin + textures)
        const mainFile = files.find(f => f.name.toLowerCase().endsWith('.gltf') || f.name.toLowerCase().endsWith('.glb'));
        modelFileName = mainFile.name.replace(/\.[^/.]+$/, '') + '-packed.glb';
        outputFileNameInput.value = modelFileName;
        
        initialTotalBytes = files.reduce((acc, f) => acc + f.size, 0);
        await loadGltfBundle(files, mainFile);
      } else {
        throw new Error('No .gltf or .glb file detected in selected files.');
      }

      window.showToast?.('Model & textures parsed successfully!', 'success');
    } catch (err) {
      console.error('Model ingestion error:', err);
      window.showToast?.('Failed to load 3D model: ' + err.message, 'error');
      resetPipeline();
    } finally {
      showViewportLoading(false);
    }
  }

  // =========================================================================
  // 4. MODEL LOADERS (THREE.JS)
  // =========================================================================

  // Loader for Single GLB
  async function loadGlbModel(file) {
    const objectUrl = URL.createObjectURL(file);
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        objectUrl,
        async (gltf) => {
          renderCoreAssetsList([file]);
          setupSceneWithModel(gltf.scene);
          await extractAndProcessTextures(gltf.scene);
          resolve();
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  // Loader for GLTF + .bin + Loose Textures
  async function loadGltfBundle(files, mainFile) {
    const urlMap = new Map();
    files.forEach(f => {
      urlMap.set(f.name, URL.createObjectURL(f));
    });

    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      const cleanName = url.replace(/^.*[\\\/]/, '');
      if (urlMap.has(cleanName)) {
        return urlMap.get(cleanName);
      }
      return url;
    });

    const loader = new GLTFLoader(manager);
    const mainUrl = urlMap.get(mainFile.name);

    return new Promise((resolve, reject) => {
      loader.load(
        mainUrl,
        async (gltf) => {
          renderCoreAssetsList(files);
          setupSceneWithModel(gltf.scene);
          await extractAndProcessTextures(gltf.scene, files);
          resolve();
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  // Render Core Model Assets List
  function renderCoreAssetsList(files) {
    coreAssetsList.innerHTML = '';
    const coreFiles = files.filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return ext === 'gltf' || ext === 'glb' || ext === 'bin';
    });

    coreAssetsCountBadge.textContent = `${coreFiles.length} File${coreFiles.length === 1 ? '' : 's'}`;

    coreFiles.forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      const row = document.createElement('div');
      row.className = 'asset-item-row';
      
      let iconClass = 'asset-icon-gltf';
      if (ext === 'bin') iconClass = 'asset-icon-bin';
      if (ext === 'glb') iconClass = 'asset-icon-glb';

      row.innerHTML = `
        <div class="asset-item-left">
          <div class="asset-icon-box ${iconClass}">${ext.toUpperCase()}</div>
          <div class="asset-details">
            <span class="asset-filename">${f.name}</span>
            <span class="asset-filesize">${formatBytes(f.size)} &bull; Valid Buffer</span>
          </div>
        </div>
        <span class="badge badge-emerald" style="font-size: 0.72rem;">✓ Ready</span>
      `;
      coreAssetsList.appendChild(row);
    });
  }

  // Place Model in Viewport
  function setupSceneWithModel(modelScene) {
    // Clear previous model
    if (currentModelGroup) {
      scene.remove(currentModelGroup);
    }

    currentModel = modelScene;
    currentModelGroup = new THREE.Group();
    currentModelGroup.add(currentModel);
    scene.add(currentModelGroup);

    // Save original materials for shader switching
    originalMaterialsMap.clear();
    let triangles = 0;
    let vertices = 0;

    currentModel.traverse((node) => {
      if (node.isMesh) {
        originalMaterialsMap.set(node, node.material);
        if (node.geometry) {
          if (node.geometry.index) {
            triangles += node.geometry.index.count / 3;
          } else if (node.geometry.attributes.position) {
            triangles += node.geometry.attributes.position.count / 3;
          }
          if (node.geometry.attributes.position) {
            vertices += node.geometry.attributes.position.count;
          }
        }
      }
    });

    // Update Viewport Stats
    vpTrisCount.textContent = formatNumber(Math.round(triangles));
    vpVertsCount.textContent = formatNumber(vertices);

    // AR Ready check (< 100k tris and < 15MB)
    const isArReady = triangles <= 100000 && initialTotalBytes <= 15 * 1024 * 1024;
    if (isArReady) {
      vpArReadyBadge.className = 'badge badge-emerald';
      vpArReadyBadge.textContent = 'AR Ready ✓';
      vpArReadyBadge.title = 'Polycount and size are within WebAR limits';
    } else {
      vpArReadyBadge.className = 'badge badge-gold';
      vpArReadyBadge.textContent = 'High-Poly';
      vpArReadyBadge.title = 'Model may exceed quick-look AR mobile limits';
    }

    // Frame camera to object
    frameModelInViewport(currentModelGroup);
  }

  // Frame Model in Camera
  function frameModelInViewport(object) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Center model at origin
    object.position.x = -center.x;
    object.position.y = -box.min.y; // Sit on ground grid
    object.position.z = -center.z;

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    cameraZ = Math.max(cameraZ, 0.5);

    camera.position.set(cameraZ * 0.9, cameraZ * 0.7, cameraZ * 1.2);
    controls.target.set(0, size.y * 0.45, 0);
    controls.update();
  }

  // =========================================================================
  // 5. TEXTURE EXTRACTION & COMPRESSION PIPELINE
  // =========================================================================
  async function extractAndProcessTextures(model, uploadedFiles = []) {
    detectedTextures = [];
    const uniqueTextures = new Set();
    const textureRoleMap = new Map();

    // Map texture roles (BaseColor, Normal, Metallic, etc.)
    model.traverse((node) => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(mat => {
          const checks = [
            { key: 'map', role: 'Base Color' },
            { key: 'normalMap', role: 'Normal Map' },
            { key: 'roughnessMap', role: 'Roughness' },
            { key: 'metalnessMap', role: 'Metallic' },
            { key: 'aoMap', role: 'Ambient Occlusion' },
            { key: 'emissiveMap', role: 'Emissive' }
          ];

          checks.forEach(({ key, role }) => {
            const tex = mat[key];
            if (tex && tex.isTexture && !uniqueTextures.has(tex)) {
              uniqueTextures.add(tex);
              textureRoleMap.set(tex, role);
            }
          });
        });
      }
    });

    let texIndex = 1;
    for (const tex of uniqueTextures) {
      let img = tex.image;
      if (!img) continue;

      // Ensure image is loaded
      if (img instanceof ImageBitmap || img instanceof HTMLImageElement || img instanceof HTMLCanvasElement) {
        const w = img.width || img.naturalWidth || 1024;
        const h = img.height || img.naturalHeight || 1024;
        
        // Draw to offscreen canvas to extract thumbnail and uncompressed size
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const thumbUrl = canvas.toDataURL('image/jpeg', 0.6);
        const name = tex.name || (tex.userData && tex.userData.name) || `Texture_${texIndex}_${textureRoleMap.get(tex) || 'Map'}`;
        
        // Match uploaded file if available for original file size
        const matchedFile = uploadedFiles.find(f => f.name.toLowerCase() === name.toLowerCase());
        const origSize = matchedFile ? matchedFile.size : (w * h * 3 * 0.6); // raw estimation if glb internal

        detectedTextures.push({
          id: 'tex_' + texIndex,
          texture: tex,
          name: name,
          role: textureRoleMap.get(tex) || 'PBR Texture',
          originalWidth: w,
          originalHeight: h,
          originalSize: origSize,
          canvas: canvas,
          thumbUrl: thumbUrl,
          format: 'webp',
          quality: 80,
          maxRes: 0,
          keep: true,
          estSize: origSize * 0.35 // initial estimate
        });

        texIndex++;
      }
    }

    texturesCountBadge.textContent = `${detectedTextures.length} Texture${detectedTextures.length === 1 ? '' : 's'}`;
    summaryChannelsCount.textContent = `${detectedTextures.length} Channels Detected`;

    // Render individual texture cards
    renderTextureCards();

    // Re-estimate all texture compression
    await recalculateAllTextures();
  }

  // Render individual cards in UI
  function renderTextureCards() {
    textureItemList.innerHTML = '';

    if (detectedTextures.length === 0) {
      textureItemList.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">
          No standalone image textures detected (Model uses procedural colors or untextured shaders).
        </div>
      `;
      return;
    }

    detectedTextures.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'texture-item-card';
      card.id = `card_${item.id}`;

      card.innerHTML = `
        <div class="texture-item-top">
          <div class="texture-thumb">
            <img src="${item.thumbUrl}" alt="${item.name}" />
          </div>
          <div class="texture-info">
            <span class="texture-name" title="${item.name}">${item.name}</span>
            <div class="texture-meta-badges">
              <span class="badge-tag-sm" style="color: #00d9ff; border-color: rgba(0,217,255,0.2);">${item.role}</span>
              <span class="badge-tag-sm">${item.originalWidth} &times; ${item.originalHeight}</span>
              <span class="badge-tag-sm" id="orig_size_${item.id}">${formatBytes(item.originalSize)}</span>
            </div>
          </div>
          <div style="text-align: right;">
            <label style="font-size: 0.74rem; color: #94a3b8; display: flex; align-items: center; gap: 0.3rem; cursor: pointer;">
              <input type="checkbox" id="keep_${item.id}" ${item.keep ? 'checked' : ''} />
              <span>Keep</span>
            </label>
            <span class="savings-badge" id="savings_${item.id}" style="margin-top: 0.3rem; font-size: 0.72rem;">--</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 0.6rem; align-items: center; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <span style="font-size: 0.75rem; color: #94a3b8;">Format:</span>
            <select id="fmt_${item.id}" class="cyber-select" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; width: 100%;">
              <option value="webp" ${item.format === 'webp' ? 'selected' : ''}>WebP</option>
              <option value="jpeg" ${item.format === 'jpeg' ? 'selected' : ''}>JPEG</option>
              <option value="png" ${item.format === 'png' ? 'selected' : ''}>PNG</option>
              <option value="original" ${item.format === 'original' ? 'selected' : ''}>Orig</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.75rem; color: #94a3b8;">Quality:</span>
            <input type="range" id="q_${item.id}" class="cyber-slider" min="20" max="100" value="${item.quality}" />
            <span class="slider-value-badge" id="q_val_${item.id}" style="font-size: 0.74rem;">${item.quality}%</span>
          </div>
        </div>
      `;

      textureItemList.appendChild(card);

      // Event Listeners for Individual Controls
      const fmtSelect = card.querySelector(`#fmt_${item.id}`);
      const qSlider = card.querySelector(`#q_${item.id}`);
      const qVal = card.querySelector(`#q_val_${item.id}`);
      const keepBox = card.querySelector(`#keep_${item.id}`);

      fmtSelect.addEventListener('change', async (e) => {
        item.format = e.target.value;
        await reestimateTexture(item);
      });

      qSlider.addEventListener('input', (e) => {
        item.quality = parseInt(e.target.value, 10);
        qVal.textContent = `${item.quality}%`;
      });

      qSlider.addEventListener('change', async () => {
        await reestimateTexture(item);
      });

      keepBox.addEventListener('change', (e) => {
        item.keep = e.target.checked;
        card.style.opacity = item.keep ? '1' : '0.45';
        updateSummaryMetrics();
      });
    });
  }

  // Offscreen Compression Estimator for 1 Texture
  async function reestimateTexture(item) {
    if (!item.canvas) return;

    let targetW = item.originalWidth;
    let targetH = item.originalHeight;

    if (item.maxRes > 0 && (targetW > item.maxRes || targetH > item.maxRes)) {
      if (targetW >= targetH) {
        targetH = Math.round((targetH * item.maxRes) / targetW);
        targetW = item.maxRes;
      } else {
        targetW = Math.round((targetW * item.maxRes) / targetH);
        targetH = item.maxRes;
      }
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = targetW;
    offCanvas.height = targetH;
    const ctx = offCanvas.getContext('2d');
    ctx.drawImage(item.canvas, 0, 0, targetW, targetH);

    let mime = 'image/webp';
    if (item.format === 'jpeg') mime = 'image/jpeg';
    else if (item.format === 'png') mime = 'image/png';
    else if (item.format === 'original') mime = 'image/jpeg';

    return new Promise((resolve) => {
      offCanvas.toBlob((blob) => {
        if (blob) {
          item.estSize = blob.size;
          item.compressedBlob = blob;
          
          const savingsEl = document.getElementById(`savings_${item.id}`);
          if (savingsEl) {
            const savingsPercent = Math.round((1 - (blob.size / item.originalSize)) * 100);
            if (savingsPercent > 0) {
              savingsEl.textContent = `-${savingsPercent}% (${formatBytes(blob.size)})`;
              savingsEl.style.color = '#34d399';
            } else {
              savingsEl.textContent = `+${Math.abs(savingsPercent)}%`;
              savingsEl.style.color = '#f59e0b';
            }
          }
        }
        updateSummaryMetrics();
        resolve();
      }, mime, item.quality / 100);
    });
  }

  // Recalculate all textures
  async function recalculateAllTextures() {
    for (const item of detectedTextures) {
      await reestimateTexture(item);
    }
  }

  // Batch / Global Controls
  globalFormatSelect.addEventListener('change', async (e) => {
    const val = e.target.value;
    detectedTextures.forEach(item => {
      item.format = val;
      const sel = document.getElementById(`fmt_${item.id}`);
      if (sel) sel.value = val;
    });
    await recalculateAllTextures();
  });

  globalQualitySlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    globalQualityVal.textContent = `${val}%`;
    detectedTextures.forEach(item => {
      item.quality = val;
      const q = document.getElementById(`q_${item.id}`);
      const qVal = document.getElementById(`q_val_${item.id}`);
      if (q) q.value = val;
      if (qVal) qVal.textContent = `${val}%`;
    });
  });

  globalQualitySlider.addEventListener('change', async () => {
    await recalculateAllTextures();
  });

  globalResSelect.addEventListener('change', async (e) => {
    const res = parseInt(e.target.value, 10);
    detectedTextures.forEach(item => {
      item.maxRes = res;
    });
    await recalculateAllTextures();
  });

  // Update Overall Packing Summary
  function updateSummaryMetrics() {
    let texturesInitial = 0;
    let texturesOptimized = 0;

    detectedTextures.forEach(item => {
      texturesInitial += item.originalSize;
      if (item.keep) {
        texturesOptimized += item.estSize;
      }
    });

    coreGeometryBytes = Math.max(initialTotalBytes - texturesInitial, 150 * 1024);
    estimatedTotalBytes = coreGeometryBytes + texturesOptimized;

    summaryInitialSize.textContent = formatBytes(initialTotalBytes);
    summaryOptimizedSize.textContent = formatBytes(estimatedTotalBytes);

    const reductionPct = Math.round((1 - (estimatedTotalBytes / Math.max(initialTotalBytes, 1))) * 100);
    if (reductionPct > 0) {
      summarySavingsBadge.textContent = `⚡ -${reductionPct}% Saved`;
      summarySavingsBadge.style.color = '#34d399';
    } else {
      summarySavingsBadge.textContent = `⚡ 0% Change`;
      summarySavingsBadge.style.color = '#94a3b8';
    }
  }

  // =========================================================================
  // 6. PACK & EXPORT ACTIONS
  // =========================================================================

  // Action 1: Pack to Standalone GLB
  startPackGlbBtn.addEventListener('click', async () => {
    if (!currentModel) {
      window.showToast?.('Please load a 3D model first', 'error');
      return;
    }

    startPackGlbBtn.disabled = true;
    convertProgressContainer.style.display = 'block';
    updateProgress(15, 'Compressing PBR textures with WebP/JPEG...');

    try {
      // Apply compressed textures to Three.js scene before export
      await applyCompressedTexturesToScene();

      updateProgress(65, 'Packaging binary GLB buffer views...');

      const exporter = new GLTFExporter();
      exporter.parse(
        currentModel,
        (glbArrayBuffer) => {
          updateProgress(100, 'Pack complete! Initiating download...');
          
          const blob = new Blob([glbArrayBuffer], { type: 'model/gltf-binary' });
          let outName = outputFileNameInput.value.trim() || 'model-optimized.glb';
          if (!outName.toLowerCase().endsWith('.glb')) {
            outName += '.glb';
          }

          // Trigger actual file download
          downloadBlob(blob, outName);

          const savedBytes = initialTotalBytes - blob.size;
          const savedPct = Math.max(0, Math.round((savedBytes / Math.max(initialTotalBytes, 1)) * 100));
          const toastMsg = savedPct > 0 
            ? `Packed & downloaded: ${outName} (${formatBytes(blob.size)} - Reduced by ${savedPct}%!)`
            : `Packaged & downloaded: ${outName} (${formatBytes(blob.size)})`;
          window.showToast?.(toastMsg, 'success');
          
          setTimeout(() => {
            convertProgressContainer.style.display = 'none';
            startPackGlbBtn.disabled = false;
          }, 1500);
        },
        (err) => {
          console.error('Packaging error:', err);
          window.showToast?.('Packaging failed: ' + (err.message || err), 'error');
          startPackGlbBtn.disabled = false;
          convertProgressContainer.style.display = 'none';
        },
        { binary: true }
      );
    } catch (err) {
      console.error('Packaging error:', err);
      window.showToast?.('Packaging failed: ' + err.message, 'error');
      startPackGlbBtn.disabled = false;
      convertProgressContainer.style.display = 'none';
    }
  });

  // Action 2: Export Loose glTF ZIP Bundle
  exportZipBtn.addEventListener('click', async () => {
    if (!currentModel) {
      window.showToast?.('Please load a 3D model first', 'error');
      return;
    }

    exportZipBtn.disabled = true;
    convertProgressContainer.style.display = 'block';
    updateProgress(30, 'Exporting loose glTF JSON and buffers...');

    try {
      await applyCompressedTexturesToScene();

      const exporter = new GLTFExporter();
      exporter.parse(
        currentModel,
        async (gltfOutput) => {
          updateProgress(75, 'Creating ZIP archive in browser RAM...');

          const zip = new window.JSZip();
          const baseName = outputFileNameInput.value.replace(/\.[^/.]+$/, '').trim() || 'model-bundle';

          // Separate JSON and buffers
          zip.file(`${baseName}.gltf`, JSON.stringify(gltfOutput, null, 2));

          // Include compressed textures as standalone images in ZIP
          const texFolder = zip.folder('textures');
          detectedTextures.forEach((t, i) => {
            if (t.keep && t.compressedBlob) {
              const ext = t.format === 'webp' ? 'webp' : (t.format === 'png' ? 'png' : 'jpg');
              texFolder.file(`${t.name || 'texture_' + i}.${ext}`, t.compressedBlob);
            }
          });

          updateProgress(90, 'Compressing archive...');
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          downloadBlob(zipBlob, `${baseName}-bundle.zip`);

          updateProgress(100, 'Done!');
          window.showToast?.(`Extracted & downloaded: ${baseName}-bundle.zip`, 'success');

          setTimeout(() => {
            convertProgressContainer.style.display = 'none';
            exportZipBtn.disabled = false;
          }, 1500);
        },
        (err) => {
          throw err;
        },
        { binary: false, embedImages: false }
      );
    } catch (err) {
      console.error('ZIP Export error:', err);
      window.showToast?.('ZIP Export failed: ' + err.message, 'error');
      exportZipBtn.disabled = false;
      convertProgressContainer.style.display = 'none';
    }
  });

  // Helper: inject newly compressed images and user options into Three.js textures
  async function applyCompressedTexturesToScene() {
    for (const item of detectedTextures) {
      if (!item.keep) {
        // Detach excluded texture from materials so it is not packaged into the GLB
        if (currentModel) {
          currentModel.traverse((node) => {
            if (node.isMesh && node.material) {
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              mats.forEach(m => {
                ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach(key => {
                  if (m[key] === item.texture) {
                    m[key] = null;
                    m.needsUpdate = true;
                  }
                });
              });
            }
          });
        }
        continue;
      }

      // Configure export mimeType & quality for GLTFExporter
      item.texture.userData = item.texture.userData || {};
      let targetMime = 'image/jpeg';
      if (item.format === 'webp') targetMime = 'image/webp';
      else if (item.format === 'png') targetMime = 'image/png';
      else if (item.format === 'jpeg') targetMime = 'image/jpeg';
      else if (item.format === 'original') targetMime = 'image/jpeg';

      item.texture.userData.mimeType = targetMime;
      item.texture.userData.quality = item.quality / 100;

      // Ensure compressed blob is generated
      if (!item.compressedBlob && item.canvas) {
        await reestimateTexture(item);
      }

      // Update texture image with compressed / clamped version
      if (item.compressedBlob) {
        const img = new Image();
        const blobUrl = URL.createObjectURL(item.compressedBlob);
        
        await new Promise((resolve) => {
          img.onload = () => {
            item.texture.image = img;
            item.texture.needsUpdate = true;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = blobUrl;
        });
      }
    }
  }

  // Reset Pipeline
  function resetPipeline() {
    if (currentModelGroup) {
      scene.remove(currentModelGroup);
      currentModelGroup = null;
      currentModel = null;
    }
    detectedTextures = [];
    originalMaterialsMap.clear();
    packerPipelineGrid.style.display = 'none';
    dropArea.classList.remove('is-collapsed');
    coreAssetsList.innerHTML = '';
    textureItemList.innerHTML = '';
    summaryInitialSize.textContent = '--';
    summaryOptimizedSize.textContent = '--';
    summarySavingsBadge.textContent = '⚡ -0% Est.';
    vpTrisCount.textContent = '0';
    vpVertsCount.textContent = '0';
    fileInput.value = '';
  }

  resetPipelineBtn.addEventListener('click', resetPipeline);

  // =========================================================================
  // 7. GLB UNPACKER MODE
  // =========================================================================
  async function handleUnpackerGlb(glbFile) {
    unpackerFileBadge.textContent = glbFile.name;
    unpackerModelName.textContent = glbFile.name;
    unpackerModelSize.textContent = formatBytes(glbFile.size);
    unpackerEmptyPrompt.style.display = 'none';
    unpackerDetailsBox.style.display = 'block';

    window.showToast?.('Inspecting GLB container structure...', 'info');

    const objectUrl = URL.createObjectURL(glbFile);
    const loader = new GLTFLoader();

    loader.load(
      objectUrl,
      (gltf) => {
        // Collect embedded assets
        unpackerFilesList.innerHTML = '';
        const baseName = glbFile.name.replace(/\.[^/.]+$/, '');

        // JSON descriptor row
        const jsonRow = document.createElement('div');
        jsonRow.className = 'asset-item-row';
        jsonRow.innerHTML = `
          <div class="asset-item-left">
            <div class="asset-icon-box asset-icon-gltf">JSON</div>
            <div class="asset-details">
              <span class="asset-filename">${baseName}.gltf</span>
              <span class="asset-filesize">Scene Hierarchy & Materials</span>
            </div>
          </div>
          <span class="badge badge-cyan">Scene</span>
        `;
        unpackerFilesList.appendChild(jsonRow);

        // Binary buffer row
        const binRow = document.createElement('div');
        binRow.className = 'asset-item-row';
        binRow.innerHTML = `
          <div class="asset-item-left">
            <div class="asset-icon-box asset-icon-bin">BIN</div>
            <div class="asset-details">
              <span class="asset-filename">${baseName}.bin</span>
              <span class="asset-filesize">Geometry & Index Buffers</span>
            </div>
          </div>
          <span class="badge badge-emerald">Buffer</span>
        `;
        unpackerFilesList.appendChild(binRow);

        // Textures
        let texCount = 0;
        gltf.scene.traverse((node) => {
          if (node.isMesh && node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(m => {
              ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach(key => {
                if (m[key] && m[key].isTexture) {
                  texCount++;
                  const t = m[key];
                  const tRow = document.createElement('div');
                  tRow.className = 'asset-item-row';
                  const w = t.image ? (t.image.width || '1024') : '1024';
                  const h = t.image ? (t.image.height || '1024') : '1024';
                  tRow.innerHTML = `
                    <div class="asset-item-left">
                      <div class="asset-icon-box" style="background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3);">IMG</div>
                      <div class="asset-details">
                        <span class="asset-filename">${t.name || `texture_${texCount}.png`}</span>
                        <span class="asset-filesize">${w} &times; ${h} &bull; ${key}</span>
                      </div>
                    </div>
                    <span class="badge badge-gold">Texture</span>
                  `;
                  unpackerFilesList.appendChild(tRow);
                }
              });
            });
          }
        });

        unpackerExtractedStats.textContent = `1 glTF + 1 .bin + ${texCount} Textures`;

        // Store model for unpack button
        startUnpackZipBtn.onclick = async () => {
          startUnpackZipBtn.disabled = true;
          window.showToast?.('Unpacking GLB into ZIP bundle...', 'info');

          const exporter = new GLTFExporter();
          exporter.parse(
            gltf.scene,
            async (output) => {
              const zip = new window.JSZip();
              zip.file(`${baseName}.gltf`, JSON.stringify(output, null, 2));

              const zipBlob = await zip.generateAsync({ type: 'blob' });
              downloadBlob(zipBlob, `${baseName}-unpacked.zip`);
              window.showToast?.('GLB successfully unpacked and downloaded!', 'success');
              startUnpackZipBtn.disabled = false;
            },
            (err) => {
              window.showToast?.('Unpacking error: ' + err.message, 'error');
              startUnpackZipBtn.disabled = false;
            },
            { binary: false, embedImages: false }
          );
        };
      },
      undefined,
      (err) => {
        window.showToast?.('Could not inspect GLB: ' + err.message, 'error');
      }
    );
  }

  resetUnpackerBtn.addEventListener('click', () => {
    unpackerEmptyPrompt.style.display = 'block';
    unpackerDetailsBox.style.display = 'none';
    unpackerFilesList.innerHTML = '';
    unpackerFileBadge.textContent = 'No File';
    fileInput.value = '';
  });

  // =========================================================================
  // 8. THREE.JS LIVE VIEWPORT SETUP & SHADERS
  // =========================================================================
  function initViewport() {
    if (!liveViewportCanvas || !liveViewportContainer) return;

    const width = liveViewportContainer.clientWidth || 400;
    const height = liveViewportContainer.clientHeight || 280;

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: liveViewportCanvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene & Camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 500);
    camera.position.set(2, 1.8, 2.5);

    // OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;
    controls.minDistance = 0.2;
    controls.maxDistance = 50;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x00b4d8, 0.6);
    fillLight.position.set(-5, -2, -5);
    scene.add(fillLight);

    // Subtle Studio Ground Grid
    const groundGrid = new THREE.GridHelper(8, 16, 0x00b4d8, 0xcbd5e1);
    groundGrid.position.y = 0;
    groundGrid.material.opacity = 0.55;
    groundGrid.material.transparent = true;
    scene.add(groundGrid);

    // Resize Observer
    const ro = new ResizeObserver(() => {
      if (!liveViewportContainer || !renderer || !camera) return;
      const w = liveViewportContainer.clientWidth;
      const h = liveViewportContainer.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(liveViewportContainer);

    // Overlay Shader Buttons
    const shaderButtons = document.querySelectorAll('.vp-btn[data-vp-mode]');
    shaderButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        shaderButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setShaderMode(btn.dataset.vpMode);
      });
    });

    // Auto-Rotate Button
    if (vpAutoRotateBtn) {
      vpAutoRotateBtn.addEventListener('click', () => {
        isAutoRotating = !isAutoRotating;
        vpAutoRotateBtn.classList.toggle('active', isAutoRotating);
      });
    }

    // Animation Loop
    function animate() {
      animFrameId = requestAnimationFrame(animate);
      if (isAutoRotating && currentModelGroup) {
        currentModelGroup.rotation.y += 0.008;
      }
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  }

  // Shader Switching
  function setShaderMode(mode) {
    activeShaderMode = mode;
    if (!currentModel) return;

    currentModel.traverse((node) => {
      if (node.isMesh) {
        const orig = originalMaterialsMap.get(node);
        if (!orig) return;

        switch (mode) {
          case 'lit':
            node.material = orig;
            break;

          case 'wireframe':
            node.material = new THREE.MeshBasicMaterial({
              color: 0x00b4d8,
              wireframe: true
            });
            break;

          case 'normals':
            node.material = new THREE.MeshNormalMaterial();
            break;

          case 'clay':
            node.material = new THREE.MeshStandardMaterial({
              color: 0xd8d8d8,
              roughness: 0.85,
              metalness: 0.1
            });
            break;
        }
      }
    });
  }

  function showViewportLoading(show) {
    if (viewportLoader) {
      viewportLoader.style.display = show ? 'flex' : 'none';
    }
  }

  function updateProgress(pct, status) {
    convertProgressBar.style.width = `${pct}%`;
    convertPercentText.textContent = `${pct}%`;
    convertStatusText.textContent = status;
  }

  // =========================================================================
  // 9. UTILITY FUNCTIONS
  // =========================================================================
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toLocaleString();
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  }
}
