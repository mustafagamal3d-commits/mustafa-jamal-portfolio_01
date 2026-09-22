/**
 * NORMAL MAP GENERATOR & TEXTURE SUITE
 * Converts Height / Base Color to Tangent Space Normal Maps using Sobel/Scharr filter kernels.
 * Includes DirectX (-Y) vs OpenGL (+Y) toggle and interactive 3D PBR sphere preview!
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

document.addEventListener('DOMContentLoaded', () => {
  initNormalMapApp();
});

function initNormalMapApp() {
  const fileInput = document.getElementById('textureFileInput');
  const loadSampleBtn = document.getElementById('loadSampleTextureBtn');
  const normalCanvas = document.getElementById('normalCanvas');
  const downloadBtn = document.getElementById('downloadNormalBtn');
  
  // Controls
  const strengthSlider = document.getElementById('strengthSlider');
  const strengthVal = document.getElementById('strengthVal');
  const blurSlider = document.getElementById('blurSlider');
  const blurVal = document.getElementById('blurVal');
  const invertGreenToggle = document.getElementById('invertGreenToggle');
  const invertRedToggle = document.getElementById('invertRedToggle');
  const kernelRadios = document.getElementsByName('kernelType');

  if (!normalCanvas) return;

  const ctx = normalCanvas.getContext('2d', { willReadFrequently: true });
  let sourceImage = new Image();
  let threeScene, threeCamera, threeRenderer, previewSphere, previewMaterial, pointLight;

  // 1. Initialize 3D Preview Sphere
  init3DPreview();

  // 2. Load Sample Image by Default
  loadSourceImage('assets/textures/sample-height-map.jpg');

  if (loadSampleBtn) {
    loadSampleBtn.addEventListener('click', () => {
      loadSourceImage('assets/textures/sample-height-map.jpg');
      window.showToast('Sample geometric displacement map loaded', 'info');
    });
  }

  // 3. File Upload
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          loadSourceImage(event.target.result);
          window.showToast(`Loaded texture: ${file.name}`, 'info');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  function loadSourceImage(src) {
    sourceImage = new Image();
    sourceImage.crossOrigin = 'anonymous';
    sourceImage.onload = () => {
      // Set canvas size (capped at max 1024 for real-time performance, or source dimensions)
      const maxDim = 1024;
      let w = sourceImage.width;
      let h = sourceImage.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      normalCanvas.width = w;
      normalCanvas.height = h;
      renderNormalMap();
    };
    sourceImage.src = src;
  }

  // 4. Sliders & Switches Event Listeners
  if (strengthSlider && strengthVal) {
    strengthSlider.addEventListener('input', () => {
      strengthVal.textContent = strengthSlider.value + 'x';
      debounceRender();
    });
  }

  if (blurSlider && blurVal) {
    blurSlider.addEventListener('input', () => {
      blurVal.textContent = blurSlider.value + 'px';
      debounceRender();
    });
  }

  if (invertGreenToggle) {
    invertGreenToggle.addEventListener('change', () => {
      debounceRender();
      window.showToast(invertGreenToggle.checked ? 'DirectX Format (-Y Green inverted)' : 'OpenGL Format (+Y Green standard)', 'info');
    });
  }

  if (invertRedToggle) {
    invertRedToggle.addEventListener('change', debounceRender);
  }

  kernelRadios.forEach(r => r.addEventListener('change', debounceRender));

  let renderTimeout;
  function debounceRender() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(renderNormalMap, 30);
  }

  // 5. Normal Map Algorithm (Sobel & Scharr Kernels)
  function renderNormalMap() {
    if (!sourceImage.complete || sourceImage.naturalWidth === 0) return;

    const w = normalCanvas.width;
    const h = normalCanvas.height;

    // Draw source to temporary offscreen canvas to extract grayscale height data
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');

    const blurPx = parseInt(blurSlider?.value || '0', 10);
    if (blurPx > 0) {
      offCtx.filter = `blur(${blurPx}px)`;
    }
    offCtx.drawImage(sourceImage, 0, 0, w, h);

    const imgData = offCtx.getImageData(0, 0, w, h);
    const src = imgData.data;
    const outputData = ctx.createImageData(w, h);
    const dst = outputData.data;

    // Precalculate grayscale luminance buffer: (0.299R + 0.587G + 0.114B) / 255.0
    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
      gray[j] = (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) / 255.0;
    }

    const strength = parseFloat(strengthSlider?.value || '5');
    const invertG = invertGreenToggle ? invertGreenToggle.checked : false;
    const invertR = invertRedToggle ? invertRedToggle.checked : false;
    
    let isScharr = false;
    kernelRadios.forEach(r => {
      if (r.checked && r.value === 'scharr') isScharr = true;
    });

    // Convolution weights
    const wCorner = isScharr ? 3.0 : 1.0;
    const wEdge = isScharr ? 10.0 : 2.0;
    const normFactor = isScharr ? 32.0 : 8.0;

    for (let y = 0; y < h; y++) {
      const yPrev = (y > 0 ? y - 1 : 0) * w;
      const yCurr = y * w;
      const yNext = (y < h - 1 ? y + 1 : h - 1) * w;

      for (let x = 0; x < w; x++) {
        const xPrev = x > 0 ? x - 1 : 0;
        const xNext = x < w - 1 ? x + 1 : w - 1;

        // 3x3 Neighborhood
        const tl = gray[yPrev + xPrev];
        const tc = gray[yPrev + x];
        const tr = gray[yPrev + xNext];

        const ml = gray[yCurr + xPrev];
        const mr = gray[yCurr + xNext];

        const bl = gray[yNext + xPrev];
        const bc = gray[yNext + x];
        const br = gray[yNext + xNext];

        // Horizontal gradient (dX)
        const dX = ((tr * wCorner + mr * wEdge + br * wCorner) - (tl * wCorner + ml * wEdge + bl * wCorner)) / normFactor;
        // Vertical gradient (dY)
        const dY = ((bl * wCorner + bc * wEdge + br * wCorner) - (tl * wCorner + tc * wEdge + tr * wCorner)) / normFactor;

        // Tangent space vector
        let nx = -dX * strength;
        let ny = -dY * strength;
        let nz = 1.0;

        if (invertR) nx = -nx;
        if (invertG) ny = -ny; // DirectX flip

        // Normalize
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len;
        ny /= len;
        nz /= len;

        // Map [-1, 1] to RGB [0, 255]
        const pixelIdx = (yCurr + x) * 4;
        dst[pixelIdx]     = Math.round((nx * 0.5 + 0.5) * 255);
        dst[pixelIdx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        dst[pixelIdx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        dst[pixelIdx + 3] = 255;
      }
    }

    ctx.putImageData(outputData, 0, 0);

    // Update 3D sphere material texture
    update3DSphereNormal();
  }

  // 6. Download Button
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = `normal_map_${invertGreenToggle?.checked ? 'DirectX' : 'OpenGL'}_${Date.now()}.png`;
      link.href = normalCanvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.showToast('Normal map downloaded successfully!', 'success');
    });
  }

  // 7. Interactive 3D Sphere Preview Engine (Three.js)
  function init3DPreview() {
    const container = document.getElementById('spherePreviewContainer');
    if (!container) return;

    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    threeCamera.position.z = 2.4;

    threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    threeRenderer.setSize(container.clientWidth || 300, container.clientHeight || 300);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(threeRenderer.domElement);

    // Geometry & Material
    const sphereGeo = new THREE.SphereGeometry(0.85, 64, 64);
    previewMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b4252,
      metalness: 0.2,
      roughness: 0.35,
    });
    previewSphere = new THREE.Mesh(sphereGeo, previewMaterial);
    threeScene.add(previewSphere);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    threeScene.add(ambientLight);

    pointLight = new THREE.PointLight(0xfff4e6, 4.0, 15);
    pointLight.position.set(2, 2, 2.5);
    threeScene.add(pointLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-2, -1, -2);
    threeScene.add(rimLight);

    // Animate light rotation around sphere
    let angle = 0;
    function animate() {
      requestAnimationFrame(animate);
      angle += 0.015;
      pointLight.position.x = Math.cos(angle) * 2.2;
      pointLight.position.y = Math.sin(angle * 0.7) * 1.5;
      pointLight.position.z = Math.sin(angle) * 2.2 + 1;

      previewSphere.rotation.y += 0.003;
      threeRenderer.render(threeScene, threeCamera);
    }
    animate();

    window.addEventListener('resize', () => {
      if (container && threeRenderer && threeCamera) {
        const size = container.clientWidth;
        threeRenderer.setSize(size, size);
        threeCamera.aspect = 1;
        threeCamera.updateProjectionMatrix();
      }
    });
  }

  function update3DSphereNormal() {
    if (!previewMaterial || !normalCanvas) return;
    const texture = new THREE.CanvasTexture(normalCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    previewMaterial.normalMap = texture;
    previewMaterial.normalScale.set(1, 1);
    previewMaterial.needsUpdate = true;
  }
}
