/**
 * PROJECT DETAIL & COMPARISON SLIDER CONTROLLER
 */

document.addEventListener('DOMContentLoaded', () => {
  initProjectDetailPage();
});

function initProjectDetailPage() {
  // Translation helper utilizing global i18n dictionary
  function t(text) {
    if (!text) return '';
    if (typeof window.getTranslation === 'function') {
      return window.getTranslation(text);
    }
    const lang = (document.documentElement.lang || 'en').toLowerCase();
    if (lang === 'en' || !window.SITE_TRANSLATIONS || !window.SITE_TRANSLATIONS[lang]) return text;
    const dict = window.SITE_TRANSLATIONS[lang];
    const trimmed = String(text).trim();
    if (dict[trimmed]) return dict[trimmed];
    const clean = trimmed.replace(/\s+/g, ' ');
    if (dict[clean]) return dict[clean];
    const lowerDict = window.LOWER_CASE_DICTS && window.LOWER_CASE_DICTS[lang];
    if (lowerDict && lowerDict[clean.toLowerCase()]) return lowerDict[clean.toLowerCase()];
    return text;
  }

  if (typeof PORTFOLIO_PROJECTS === 'undefined') return;

  // 1. Get project ID from URL parameters
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id') || (PORTFOLIO_PROJECTS[0] ? PORTFOLIO_PROJECTS[0].id : 'dior-sauvage-luxury-fragrance');

  const project = PORTFOLIO_PROJECTS.find(p => p.id === projectId) || PORTFOLIO_PROJECTS[0];

  // 2. Populate Page Details
  document.title = `${project.title} | 3D Visualization Case Study`;
  
  const titleEl = document.getElementById('projectTitle');
  const catEl = document.getElementById('projectCategory');
  const descEl = document.getElementById('projectDescription');
  function updateProjectTexts() {
    if (titleEl) titleEl.textContent = t(project.title);
    if (catEl) catEl.textContent = t(project.categoryLabel || '3D Showcase');
    if (descEl) descEl.textContent = t(project.fullDesc || project.shortDesc);
  }
  updateProjectTexts();

  // 3. Setup Video Showcase (Single reel or Multi-turntable switcher)
  const videoContainer = document.getElementById('projectVideoContainer');
  const videoPlayer = document.getElementById('projectVideoPlayer');
  const videoSource = document.getElementById('projectVideoSource');
  const turntableSwitcher = document.getElementById('turntableSwitcherContainer');
  const turntableTabsList = document.getElementById('turntableTabsList');
  const singleVideoNotice = document.getElementById('singleVideoNotice');

  if (videoContainer && videoPlayer && videoSource) {
    const videoFrame = document.getElementById('projectVideoFrame');
    
    // Auto-adapt aspect ratio and frame width based on video orientation
    function adaptVideoFrame() {
      const w = videoPlayer.videoWidth;
      const h = videoPlayer.videoHeight;
      if (w && h && videoFrame) {
        videoFrame.style.aspectRatio = `${w} / ${h}`;
        if (w < h) {
          // Vertical format (Reels / 9:16)
          videoContainer.style.maxWidth = '440px';
        } else {
          // Standard horizontal cinema format (16:9)
          videoContainer.style.maxWidth = '960px';
        }
      }
    }

    videoPlayer.addEventListener('loadedmetadata', adaptVideoFrame);
    if (videoPlayer.videoWidth) {
      adaptVideoFrame();
    }

    if (project.videos && Array.isArray(project.videos) && project.videos.length > 0) {
      videoContainer.style.display = 'block';
      const initialVideo = project.videos[0];
      videoSource.src = initialVideo.url;
      videoPlayer.poster = project.renderImage || project.thumbnail || '';
      videoPlayer.load();
      videoPlayer.play().catch(() => {});

      if (turntableSwitcher && turntableTabsList && project.videos.length > 1) {
        turntableSwitcher.style.display = 'block';
        if (singleVideoNotice) singleVideoNotice.style.display = 'none';

        turntableTabsList.innerHTML = project.videos.map((vid, idx) => `
          <button type="button" class="turntable-reel-btn ${idx === 0 ? 'active' : ''}" data-video-url="${vid.url}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>${vid.title}</span>
          </button>
        `).join('');

        const reelButtons = turntableTabsList.querySelectorAll('.turntable-reel-btn');
        reelButtons.forEach(btn => {
          btn.addEventListener('click', () => {
            reelButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const targetUrl = btn.getAttribute('data-video-url');
            videoSource.src = targetUrl;
            videoPlayer.load();
            videoPlayer.play().catch(() => {});
          });
        });
      } else if (turntableSwitcher) {
        turntableSwitcher.style.display = 'none';
        if (singleVideoNotice) singleVideoNotice.style.display = 'block';
      }
    } else if (project.videoUrl) {
      videoContainer.style.display = 'block';
      videoSource.src = project.videoUrl;
      videoPlayer.src = project.videoUrl;
      videoPlayer.poster = project.renderImage || project.thumbnail || '';
      videoPlayer.load();
      videoPlayer.play().catch(() => {});
      if (turntableSwitcher) turntableSwitcher.style.display = 'none';
      if (singleVideoNotice) singleVideoNotice.style.display = 'block';
    } else {
      videoContainer.style.display = 'none';
    }
  }

  // 4. Setup Uncropped Hero Stage or Comparison Slider
  const heroStage = document.getElementById('projectHeroStage');
  const heroImg = document.getElementById('projectHeroImg');
  const heroBackdrop = document.getElementById('projectHeroBackdrop');
  const heroZoomLink = document.getElementById('projectHeroZoomLink');
  const heroZoomBadge = document.getElementById('projectHeroZoomBadge');
  const comparisonContainer = document.getElementById('projectComparisonContainer');
  const sliderContainer = document.getElementById('comparisonSlider');
  const afterWrapper = document.getElementById('sliderAfterWrapper');
  const handle = document.getElementById('sliderHandle');
  const beforeImg = document.getElementById('sliderBeforeImg');
  const afterImg = document.getElementById('sliderAfterImg');
  const dragNotice = document.getElementById('sliderDragNotice');

  if (project.hasComparison && project.clayImage && sliderContainer && afterWrapper && handle && beforeImg && afterImg) {
    if (heroStage) heroStage.style.display = 'none';
    if (comparisonContainer) comparisonContainer.style.display = 'block';
    beforeImg.src = project.renderImage;
    afterImg.src = project.clayImage;
    afterWrapper.style.display = 'block';
    afterWrapper.style.width = '100%';
    afterWrapper.style.clipPath = 'inset(0 50% 0 0)';
    handle.style.display = 'flex';
    handle.style.left = '50%';
    const labels = sliderContainer.querySelectorAll('.slider-label');
    labels.forEach(l => l.style.display = 'block');
    if (dragNotice) dragNotice.style.display = 'block';
    initSliderInteractions(sliderContainer, afterWrapper, handle);
  } else {
    // Master 3D render image is ALWAYS the HERO!
    if (comparisonContainer) comparisonContainer.style.display = 'none';
    if (heroStage) {
      heroStage.style.display = 'flex';
      const renderSrc = project.renderImage || project.thumbnail;
      if (heroImg) {
        heroImg.src = renderSrc;
        heroImg.alt = `${project.title} - Uncropped 3D Render`;
      }
      if (heroBackdrop) {
        heroBackdrop.src = renderSrc;
      }
      if (heroZoomLink) {
        heroZoomLink.href = renderSrc;
      }
      if (heroZoomBadge) {
        heroZoomBadge.href = renderSrc;
      }
    }
  }

  // 5. Setup Interactive Full-Resolution Lightbox
  const lightboxModal = document.getElementById('projectLightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxOpenFull = document.getElementById('lightboxOpenFull');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');

  function openLightbox(src, caption) {
    if (!lightboxModal || !lightboxImg) {
      window.open(src, '_blank');
      return;
    }
    lightboxImg.src = src;
    if (lightboxCaption) lightboxCaption.textContent = caption || project.title;
    if (lightboxOpenFull) lightboxOpenFull.href = src;
    lightboxModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxModal) return;
    lightboxModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (closeLightboxBtn) {
    closeLightboxBtn.addEventListener('click', closeLightbox);
  }
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal || e.target.id === 'closeLightboxBtn') closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  // Attach Lightbox to Hero Render
  if (heroImg) {
    heroImg.style.cursor = 'zoom-in';
    heroImg.addEventListener('click', (e) => {
      e.preventDefault();
      openLightbox(heroImg.src, `${project.title} - Full Resolution Render`);
    });
  }
  if (heroZoomBadge) {
    heroZoomBadge.addEventListener('click', (e) => {
      e.preventDefault();
      openLightbox(heroImg ? heroImg.src : (project.renderImage || project.thumbnail), `${project.title} - Full Resolution Render`);
    });
  }
  if (heroZoomLink) {
    heroZoomLink.addEventListener('click', (e) => {
      e.preventDefault();
      openLightbox(heroImg ? heroImg.src : (project.renderImage || project.thumbnail), `${project.title} - Full Resolution Render`);
    });
  }

  window.openProjectLightbox = openLightbox;

  // 6. Setup Gallery Grid (for additional renders, details & wireframes)
  const gallerySection = document.getElementById('projectGallerySection');
  const galleryGrid = document.getElementById('projectGalleryGrid');

  if (gallerySection && galleryGrid && project.gallery && project.gallery.length > 0) {
    gallerySection.style.display = 'block';
    galleryGrid.innerHTML = project.gallery.map((imgSrc, idx) => `
      <div class="glass-panel" style="overflow: hidden; padding: 0.5rem; transition: transform 0.25s ease, border-color 0.25s ease;">
        <a href="${imgSrc}" onclick="event.preventDefault(); window.openProjectLightbox('${imgSrc}', '${project.title} - Detail Pass ${idx + 1}');" style="display: block; overflow: hidden; border-radius: var(--radius-md); position: relative; aspect-ratio: 16 / 11; background: radial-gradient(circle at center, rgba(32, 38, 54, 0.75) 0%, rgba(11, 13, 18, 0.98) 100%); cursor: zoom-in;">
          <img src="${imgSrc}" alt="" aria-hidden="true" style="position: absolute; inset: -15%; width: 130%; height: 130%; object-fit: cover; filter: blur(24px) brightness(0.35); opacity: 0.55; pointer-events: none;" />
          <img src="${imgSrc}" alt="${project.title} View ${idx + 1}" style="position: relative; z-index: 1; width: 100%; height: 100%; object-fit: contain; padding: 0.5rem; display: block; transition: transform 0.4s ease;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'" />
        </a>
        <div style="padding: 0.75rem 0.5rem 0.25rem; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">Angle / Detail Pass ${idx + 1}</span>
          <a href="${imgSrc}" onclick="event.preventDefault(); window.openProjectLightbox('${imgSrc}', '${project.title} - Detail Pass ${idx + 1}');" style="font-size: 0.8rem; color: var(--accent-gold); display: inline-flex; align-items: center; gap: 0.3rem; cursor: pointer;">
            <span>Inspect 4K</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>
      </div>
    `).join('');
  } else if (gallerySection) {
    gallerySection.style.display = 'none';
  }

  // 7. Setup Commission Modal & Channels
  const commissionModal = document.getElementById('commissionModal');
  const openCommissionBtns = document.querySelectorAll('.open-commission-btn');
  const closeCommissionBtn = document.getElementById('closeCommissionModalBtn');
  const commissionRefEl = document.getElementById('commissionModalRef');
  const commissionEmailBtn = document.getElementById('commissionEmailBtn');
  const commissionFormBtn = document.getElementById('commissionFormBtn');

  if (commissionRefEl) {
    commissionRefEl.textContent = `Project Reference: "${project.title}" (${project.categoryLabel || '3D Asset'})`;
  }

  if (commissionEmailBtn) {
    const emailSubject = encodeURIComponent(`Project Inquiry: Commission Similar 3D Assets (${project.title})`);
    const emailBody = encodeURIComponent(
      `Hello Mustafa,\n\nI reviewed your "${project.title}" project on your portfolio and I would like to commission similar 3D assets for my brand.\n\nProject Scope:\n- Estimated Asset Count: \n- Required Deliverables (e.g. 8K Renders, WebAR / GLB, 3D Print STL, Commercial Animation): \n- 3D Model or Photo Reference Availability: \n- Target Delivery Timeline: \n\nBest regards,\n`
    );
    commissionEmailBtn.href = `mailto:mustafagamal.3d@gmail.com?subject=${emailSubject}&body=${emailBody}`;
  }

  if (commissionFormBtn) {
    commissionFormBtn.href = `contact.html?project=${encodeURIComponent(project.title)}&cat=${encodeURIComponent(project.category || '')}`;
  }

  function openCommissionModal() {
    if (!commissionModal) return;
    commissionModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeCommissionModal() {
    if (!commissionModal) return;
    commissionModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  openCommissionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openCommissionModal();
    });
  });

  if (closeCommissionBtn) {
    closeCommissionBtn.addEventListener('click', closeCommissionModal);
  }

  if (commissionModal) {
    commissionModal.addEventListener('click', (e) => {
      if (e.target === commissionModal) closeCommissionModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && commissionModal && commissionModal.classList.contains('active')) {
      closeCommissionModal();
    }
  });

  // Re-apply site language to dynamically injected project details
  if (typeof window.reapplyLanguage === 'function') {
    window.reapplyLanguage();
  }

  window.addEventListener('languageChanged', () => {
    if (typeof updateProjectTexts === 'function') {
      updateProjectTexts();
    }
    if (typeof window.reapplyLanguage === 'function') {
      window.reapplyLanguage();
    }
  });
}

function initSliderInteractions(container, afterWrapper, handle) {
  let isDragging = false;

  function setSliderPosition(x) {
    const rect = container.getBoundingClientRect();
    let pos = (x - rect.left) / rect.width;
    pos = Math.max(0.02, Math.min(0.98, pos));
    
    const percentage = pos * 100;
    afterWrapper.style.width = '100%';
    afterWrapper.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
    container.style.setProperty('--slider-pos', `${percentage}%`);
    handle.style.left = `${percentage}%`;
  }

  // Mouse Events
  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    setSliderPosition(e.clientX);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    setSliderPosition(e.clientX);
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Touch Events for Mobile
  container.addEventListener('touchstart', (e) => {
    isDragging = true;
    setSliderPosition(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    setSliderPosition(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });
}
