/**
 * PORTFOLIO GALLERY CONTROLLER
 * Handles category filtering, live search, uncropped cards, and quick preview lightbox
 */

document.addEventListener('DOMContentLoaded', () => {
  initPortfolioGrid();
});

function initPortfolioGrid() {
  const gridContainer = document.getElementById('portfolioGrid');
  const filterBtns = document.querySelectorAll('.filter-tab-btn');
  const searchInput = document.getElementById('portfolioSearchInput');

  if (!gridContainer || typeof PORTFOLIO_PROJECTS === 'undefined') return;

  let activeCategory = 'all';
  let searchQuery = '';

  // 1. Render initial items
  renderCards(filterProjects());

  // 3. Search Input & Clear Listener
  const clearBtn = document.getElementById('clearSearchBtn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      if (clearBtn) clearBtn.style.display = searchQuery ? 'flex' : 'none';
      renderCards(filterProjects());
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchQuery = '';
        if (clearBtn) clearBtn.style.display = 'none';
        renderCards(filterProjects());
      }
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearBtn.style.display = 'none';
      renderCards(filterProjects());
      searchInput.focus();
    });
  }

  // 4. Filter Button Clicks
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.getAttribute('data-filter') || 'all';
      renderCards(filterProjects());
    });
  });

  function filterProjects() {
    return PORTFOLIO_PROJECTS.filter(p => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      if (!matchesCategory) return false;

      if (!searchQuery) return true;

      const titleMatch = p.title.toLowerCase().includes(searchQuery);
      const descMatch = (p.shortDesc || '').toLowerCase().includes(searchQuery);
      const catMatch = (p.categoryLabel || '').toLowerCase().includes(searchQuery);
      const clientMatch = (p.client || '').toLowerCase().includes(searchQuery);
      const softwareMatch = (p.software || []).some(s => s.toLowerCase().includes(searchQuery));
      const matMatch = (p.materials || '').toLowerCase().includes(searchQuery);

      return titleMatch || descMatch || catMatch || clientMatch || softwareMatch || matMatch;
    });
  }



  // Security string sanitizer against XSS
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

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderCards(projects) {
    gridContainer.innerHTML = '';

    if (projects.length === 0) {
      gridContainer.innerHTML = `
        <div style="width: 100%; text-align: center; padding: 5rem 1.5rem; color: var(--text-muted);">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.5;">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <div style="font-size: 1.2rem; color: #fff; font-weight: 600; margin-bottom: 0.35rem;">No matching 3D projects found</div>
          <p style="font-size: 0.88rem; max-width: 400px; margin: 0 auto;">Try adjusting your keyword search or switching categories.</p>
        </div>
      `;
      return;
    }

    // Distribute projects into the Editorial Case-Study Stream, strictly preserving exact sequence (1 to 19)
    projects.forEach((p, index) => {
      const row = document.createElement('article');
      row.className = 'editorial-row';
      row.setAttribute('data-id', escapeHtml(p.id));
      row.setAttribute('data-category', escapeHtml(p.category));

            const rawTitle = p.title || '';
      const rawCat = p.categoryLabel || p.category || '';
      const rawDesc = p.shortDesc || p.fullDesc || 'Precision 3D modeling, texturing, and photorealistic CGI rendering.';

      const titleEsc = escapeHtml(t(rawTitle));
      const catLabelEsc = escapeHtml(t(rawCat));
      const indexStr = String(index + 1).padStart(2, '0');
      const descEsc = escapeHtml(t(rawDesc));

      // Check for video cover (e.g. Anything Speaker, Monster Energy, AR/VR 360)
      const isVideo = Boolean((p.category === 'animation' || p.category === 'ar') && p.hasVideo && (p.coverVideoUrl || p.videoUrl));
      const cardVideoSrc = p.coverVideoUrl || p.videoUrl;
      const badgeText = p.category === 'ar' ? t('360° TURNTABLE') : t('CINEMATIC REEL');

      const mediaHtml = isVideo
        ? `
          <video class="editorial-media-video editorial-card-video" src="${escapeHtml(cardVideoSrc)}" poster="${escapeHtml(p.thumbnail)}" autoplay muted loop playsinline preload="metadata"></video>
          <span class="editorial-media-badge"><span class="badge-dot"></span>${badgeText}</span>
        `
        : `
          <img class="editorial-media-img" src="${escapeHtml(p.thumbnail)}" alt="${titleEsc}" loading="lazy" decoding="async" />
        `;

      // Software & Tech pills
      const softwareList = Array.isArray(p.software) && p.software.length > 0 ? p.software.slice(0, 4) : ['Blender', 'Cycles', 'Substance 3D'];
      const softwareTags = softwareList.map(s => `<span class="editorial-tech-tag">${escapeHtml(s)}</span>`).join('');

      row.innerHTML = `
        <!-- Content Column (Frosted Glass Card) -->
        <div class="editorial-card-content">
          <div class="editorial-meta-header">
            <span class="editorial-index-badge">EXHIBITION #${indexStr}</span>
            <span class="editorial-cat-pill">${catLabelEsc}</span>
          </div>

          <h2 class="editorial-title">
            <a href="project-detail.html?id=${escapeHtml(p.id)}" class="editorial-title-link">${titleEsc}</a>
          </h2>

          <p class="editorial-desc">${descEsc}</p>

          <div class="editorial-tech-list">
            ${softwareTags}
          </div>

          <a href="project-detail.html?id=${escapeHtml(p.id)}" class="editorial-action-btn">
            <span>View Full Case Study</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>

        <!-- Media Column (3D Perspective Frame + Halo + 100% Non-Cropped Visual) -->
        <div class="editorial-media-wrapper">
          <div class="editorial-halo"></div>
          <a href="project-detail.html?id=${escapeHtml(p.id)}" class="editorial-display-frame" aria-label="${titleEsc}">
            <div class="editorial-media-ambient" style="background-image: url('${escapeHtml(p.thumbnail)}');"></div>
            ${mediaHtml}
          </a>
        </div>
      `;

      gridContainer.appendChild(row);
    });

    // Auto-manage card video playback with IntersectionObserver (ensures battery/data efficiency & reliable mobile autoplay)
    const cardVideos = gridContainer.querySelectorAll('.editorial-card-video');
    if ('IntersectionObserver' in window) {
      const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const vid = entry.target;
          if (entry.isIntersecting) {
            vid.play().catch(() => {});
          } else {
            vid.pause();
          }
        });
      }, { threshold: 0.1 });
      cardVideos.forEach(vid => videoObserver.observe(vid));
    } else {
      cardVideos.forEach(vid => vid.play().catch(() => {}));
    }

    // Re-apply site language to dynamic cards
    if (typeof window.reapplyLanguage === 'function') {
      window.reapplyLanguage();
    }
  }

  // Responsive re-flow on window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderCards(filterProjects());
    }, 150);
  });

  // 5. Lightbox / Quick Preview Implementation
  initQuickPreviewModal();

  // Listen for language change to update cards and filters dynamically
  window.addEventListener('languageChanged', () => {
    if (typeof window.reapplyLanguage === 'function') {
      window.reapplyLanguage();
    }
  });
}

function initQuickPreviewModal() {
  const modal = document.getElementById('quickPreviewModal');
  const closeBtn = document.getElementById('closeQuickPreviewModal');
  const mainImg = document.getElementById('modalPreviewMainImg');
  const mainVideo = document.getElementById('modalPreviewVideo');
  const titleEl = document.getElementById('modalPreviewTitle');
  const catEl = document.getElementById('modalPreviewCat');
  const descEl = document.getElementById('modalPreviewDesc');
  const thumbsStrip = document.getElementById('modalPreviewThumbsStrip');
  const caseStudyBtn = document.getElementById('modalPreviewCaseStudyBtn');

  if (!modal || !closeBtn) return;

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    if (mainVideo) mainVideo.pause();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      if (mainVideo) mainVideo.pause();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
      if (mainVideo) mainVideo.pause();
    }
  });

  window.openQuickPreview = function(id) {
    const p = PORTFOLIO_PROJECTS.find(item => item.id === id);
    if (!p) return;

    if (titleEl) titleEl.textContent = p.title;
    if (catEl) catEl.textContent = p.categoryLabel;
    if (descEl) descEl.textContent = p.fullDesc || p.shortDesc;
    if (caseStudyBtn) caseStudyBtn.href = `project-detail.html?id=${p.id}`;

    // Collect all media items for carousel
    const mediaItems = [];
    if (p.thumbnail) mediaItems.push({ type: 'image', src: p.thumbnail, label: 'Hero Render' });
    if (p.videos && Array.isArray(p.videos)) {
      p.videos.forEach(v => {
        if (!mediaItems.some(m => m.src === v.url)) {
          mediaItems.push({ type: 'video', src: v.url, label: v.title || '360° Turntable Reel' });
        }
      });
    } else if (p.videoUrl) {
      mediaItems.push({ type: 'video', src: p.videoUrl, label: '3D Reel (Video)' });
    }
    if (p.clayImage && p.clayImage !== p.thumbnail) mediaItems.push({ type: 'image', src: p.clayImage, label: 'Wireframe / Clay' });
    if (p.gallery) {
      p.gallery.forEach((g, idx) => {
        if (!mediaItems.some(m => m.src === g)) {
          mediaItems.push({ type: 'image', src: g, label: `Render Pass ${idx + 1}` });
        }
      });
    }

    function setMainMedia(item) {
      if (item.type === 'video') {
        if (mainImg) mainImg.style.display = 'none';
        if (mainVideo) {
          mainVideo.style.display = 'block';
          mainVideo.src = item.src;
          mainVideo.load();
          mainVideo.play().catch(() => {});
        }
      } else {
        if (mainVideo) {
          mainVideo.pause();
          mainVideo.style.display = 'none';
        }
        if (mainImg) {
          mainImg.style.display = 'block';
          mainImg.src = item.src;
        }
      }
    }

    // Set first media as active
    setMainMedia(mediaItems[0]);

    // Build thumbnail strip
    if (thumbsStrip) {
      thumbsStrip.innerHTML = mediaItems.map((item, idx) => {
        const thumbSrc = item.type === 'video' ? p.thumbnail : item.src;
        return `
          <button type="button" class="preview-thumb-btn ${idx === 0 ? 'active' : ''}" data-idx="${idx}" style="flex-shrink: 0; width: 68px; height: 50px; border-radius: 4px; overflow: hidden; border: 2px solid ${idx === 0 ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)'}; background: #000; padding: 0; cursor: pointer; position: relative;">
            <img src="${thumbSrc}" style="width: 100%; height: 100%; object-fit: contain;" />
            ${item.type === 'video' ? '<span style="position:absolute; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:#c084fc; font-size:14px;">▶</span>' : ''}
          </button>
        `;
      }).join('');

      thumbsStrip.querySelectorAll('.preview-thumb-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          thumbsStrip.querySelectorAll('.preview-thumb-btn').forEach(b => {
            b.classList.remove('active');
            b.style.borderColor = 'rgba(255,255,255,0.15)';
          });
          btn.classList.add('active');
          btn.style.borderColor = 'var(--accent-gold)';
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          setMainMedia(mediaItems[idx]);
        });
      });
    }

    modal.classList.add('active');
  };
}
