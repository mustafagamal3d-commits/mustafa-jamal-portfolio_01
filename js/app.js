/**
 * GLOBAL APPLICATION SCRIPTS
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  highlightActiveNav();
  initDynamicYear();
  initFloatingContact();
  initLanguageSelector();
});

/* Mobile Menu Navigation */
function initMobileNav() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const drawer = document.getElementById('mobileDrawer');
  
  if (!menuBtn || !drawer) return;

  menuBtn.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', isOpen);
    menuBtn.innerHTML = isOpen 
      ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`
      : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
  });

  // Close drawer when clicking outside or pressing ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      drawer.classList.remove('open');
      menuBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
    }
  });
}

/* Highlight Active Nav Link */
function highlightActiveNav() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-links a');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

/* Dynamic Footer Year */
function initDynamicYear() {
  const yearEl = document.getElementById('currentYear');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

/* Toast Notifications */
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `${iconSvg} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Global export
window.showToast = showToast;

/* Floating Quick Contact Speed Dial (Omnipresent Widget) */
function toggleFloatingContact(e) {
  if (e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
  }
  const widget = document.getElementById('floatingContactWidget');
  const items = document.getElementById('floatingContactItems');
  const pill = document.getElementById('floatingContactPill');
  const iconChat = document.getElementById('floatingIconChat');
  const iconClose = document.getElementById('floatingIconClose');
  if (!widget || !items) return;

  const isOpen = widget.classList.contains('is-open');
  if (isOpen) {
    widget.classList.remove('is-open');
    items.style.display = 'none';
    if (pill) pill.style.display = 'block';
    if (iconChat) iconChat.style.display = 'flex';
    if (iconClose) iconClose.style.display = 'none';
  } else {
    widget.classList.add('is-open');
    items.style.display = 'flex';
    items.style.opacity = '1';
    items.style.visibility = 'visible';
    items.style.pointerEvents = 'auto';
    if (pill) pill.style.display = 'none';
    if (iconChat) iconChat.style.display = 'none';
    if (iconClose) iconClose.style.display = 'flex';
  }
}
window.toggleFloatingContact = toggleFloatingContact;

function initFloatingContact() {
  const toggleBtn = document.getElementById('floatingToggleBtn');
  const pill = document.getElementById('floatingContactPill');

  if (toggleBtn) {
    toggleBtn.onclick = toggleFloatingContact;
  }
  if (pill) {
    pill.onclick = toggleFloatingContact;
  }

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    const w = document.getElementById('floatingContactWidget');
    if (w && w.classList.contains('is-open') && !w.contains(e.target)) {
      toggleFloatingContact(e);
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const w = document.getElementById('floatingContactWidget');
      if (w && w.classList.contains('is-open')) {
        toggleFloatingContact(e);
      }
    }
  });
}

/* Navbar Language Selector */
function initLanguageSelector() {
  const wrapper = document.getElementById('langDropdownWrapper');
  const toggleBtn = document.getElementById('langToggleBtn');
  const currentCodeEl = document.getElementById('langCurrentCode');
  const langOptions = document.querySelectorAll('.lang-option-item');

  if (!wrapper || !toggleBtn) return;

  const supportedLangs = {
    'en': { code: 'EN', name: 'English' },
    'ar': { code: 'AR', name: 'العربية', dir: 'rtl' },
    'de': { code: 'DE', name: 'Deutsch' },
    'it': { code: 'IT', name: 'Italiano' },
    'fr': { code: 'FR', name: 'Français' },
    'tr': { code: 'TR', name: 'Türkçe' },
    'zh': { code: 'ZH', name: '中文' },
    'es': { code: 'ES', name: 'Español' }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const langFromUrl = urlParams.get('lang');
  const savedLang = langFromUrl || localStorage.getItem('site_preferred_lang') || 'en';

  function applyLanguage(langKey, save = false) {
    if (!supportedLangs[langKey]) langKey = 'en';

    if (typeof window.applySiteLanguage === 'function') {
      window.applySiteLanguage(langKey, save);
    } else {
      if (save) {
        try {
          localStorage.setItem('site_preferred_lang', langKey);
        } catch (e) {}
      }
      if (currentCodeEl) {
        currentCodeEl.textContent = supportedLangs[langKey].code;
      }
      langOptions.forEach(opt => {
        const isSelected = opt.getAttribute('data-lang') === langKey;
        opt.classList.toggle('active', isSelected);
        opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }
  }

  applyLanguage(savedLang, false);

  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = wrapper.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  langOptions.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.preventDefault();
      const chosenLang = opt.getAttribute('data-lang');
      applyLanguage(chosenLang, true);
      wrapper.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');

      const toastMessages = {
        'ar': 'تم تفعيل اللغة العربية بنجاح',
        'de': 'Sprache auf Deutsch umgestellt',
        'fr': 'Langue changée en Français',
        'it': 'Lingua cambiata in Italiano',
        'es': 'Idioma cambiado a Español',
        'tr': 'Dil Türkçe olarak güncellendi',
        'zh': '已成功切换至中文',
        'en': 'Language switched to English'
      };
      if (window.showToast && toastMessages[chosenLang]) {
        window.showToast(toastMessages[chosenLang], 'success');
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (wrapper.classList.contains('open') && !wrapper.contains(e.target)) {
      wrapper.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wrapper.classList.contains('open')) {
      wrapper.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}
