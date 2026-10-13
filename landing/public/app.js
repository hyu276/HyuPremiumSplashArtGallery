const CONTENT_URL = 'https://raw.githubusercontent.com/hyu276/HyuPremiumSplashArtGallery/refs/heads/content/landing-artwork/landing/content/artworks.json';
    const DERIVATIVE_URL = /^https:\/\/hyu-premium-media\.csquocnguyen\.workers\.dev\/media\/artworks\/variants\/[a-z0-9-]+-(?:640|960|1600)\.webp$/;
    const mobileCrop = matchMedia('(max-width: 780px)');
    let artworkConfig = {slots:{}};
    const previewMode = new URLSearchParams(location.search).get('artwork-preview') === '1' && window.parent !== window;
    let draftReceived = false;
    let lastPreviewSlot = null;
    function validSlot(settings) {
      const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.y) && value.x >= 0 && value.x <= 100 && value.y >= 0 && value.y <= 100;
      return settings && DERIVATIVE_URL.test(settings.src) && point(settings.desktop) && point(settings.mobile)
        && Number.isFinite(settings.zoom) && settings.zoom >= 1 && settings.zoom <= 1.5
        && Number.isFinite(settings.dim) && settings.dim >= 0 && settings.dim <= 1;
    }
    function applyArtwork(image) {
      const settings = artworkConfig.slots[image.dataset.imageSlot];
      if (!validSlot(settings)) return;
      if (image.src !== settings.src) image.src = settings.src;
      const crop = mobileCrop.matches ? settings.mobile : settings.desktop;
      image.style.setProperty('--image-position', `${crop.x}% ${crop.y}%`);
      image.style.setProperty('--image-scale', settings.zoom);
      image.parentElement.style.setProperty('--image-dim', settings.dim);
    }
    function applyAllArtwork() { document.querySelectorAll('[data-image-slot]').forEach(applyArtwork); }
    async function fetchArtwork(url, timeoutMs) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {cache:'no-store', signal:controller.signal});
        if (!response.ok) throw new Error('Artwork configuration unavailable');
        const data = await response.json();
        if (data.version !== 1 || !data.slots || typeof data.slots !== 'object') throw new Error('Invalid artwork configuration');
        return data;
      } finally { clearTimeout(timeout); }
    }
    async function loadArtwork() {
      try { const defaults = await fetchArtwork('/artwork-defaults.json', 4000); if (!draftReceived) { artworkConfig = defaults; applyAllArtwork(); } } catch { /* HTML image sources remain visible. */ }
      try {
        const published = await fetchArtwork(CONTENT_URL, 5000);
        if (!draftReceived) { artworkConfig = {slots:{...artworkConfig.slots, ...published.slots}}; applyAllArtwork(); }
      } catch { /* Keep the bundled, reviewed default. */ }
    }
    void loadArtwork();
    if (previewMode) {
      document.body.classList.add('artwork-preview-mode');
      window.addEventListener('message', event => {
        if (event.origin !== 'https://hyu276.github.io' || event.source !== window.parent || event.data?.type !== 'hyu-artwork-preview' || event.data.version !== 1) return;
        const draft = event.data.config;
        const expectedSlots = [...document.querySelectorAll('[data-image-slot], .concept-tab[data-slot]')].map(node => node.dataset.imageSlot || node.dataset.slot);
        if (draft?.version !== 1 || !draft.slots || typeof draft.slots !== 'object' || expectedSlots.some(id => !validSlot(draft.slots[id]))) return;
        draftReceived = true;
        artworkConfig = draft;
        const slot = event.data.slot;
        const tab = [...document.querySelectorAll('.concept-tab')].find(item => item.dataset.slot === slot);
        if (tab) selectTab(tab);
        applyAllArtwork();
        const image = [...document.querySelectorAll('[data-image-slot]')].find(item => item.dataset.imageSlot === slot);
        const section = image?.closest('.concept-panel, section, article, figure') || image;
        if (section && lastPreviewSlot !== slot) { section.scrollIntoView({block:'center',behavior:'auto'}); lastPreviewSlot=slot; }
      });
      document.addEventListener('click', event => { if (event.target.closest('a, [data-open-ebook]')) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
      document.addEventListener('submit', event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
      window.parent.postMessage({type:'hyu-artwork-preview-ready'},'https://hyu276.github.io');
    }
    mobileCrop.addEventListener('change', applyAllArtwork);
    const menuButton = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('#navLinks');
    menuButton.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
      menuButton.setAttribute('aria-label', isOpen ? 'Đóng menu' : 'Mở menu');
    });
    navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      navLinks.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false');
    }));

    const tabs = [...document.querySelectorAll('.concept-tab')];
    const panel = document.querySelector('#conceptPanel');
    const conceptTitle = document.querySelector('#conceptTitle');
    const conceptCopy = document.querySelector('#conceptCopy');
    const conceptImage = document.querySelector('#conceptImage');
    function selectTab(tab) {
      tabs.forEach(item => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; });
      panel.setAttribute('aria-labelledby', tab.id);
      conceptTitle.textContent = tab.dataset.title;
      conceptCopy.textContent = tab.dataset.copy;
      conceptImage.dataset.imageSlot = tab.dataset.slot;
      applyArtwork(conceptImage);
      panel.classList.remove('is-changing');
      void panel.offsetWidth;
      panel.classList.add('is-changing');
      conceptImage.alt = `Artwork concept ${tab.dataset.title} — Hyu Premium`;
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].focus(); selectTab(tabs[next]);
      });
    });

    const modal = document.querySelector('#ebookModal');
    const closeModal = document.querySelector('.modal-close');
    const frame = document.querySelector('#brevoSignupFrame');
    const formShell = document.querySelector('#brevoFormShell');
    const legacyConfirmation = document.querySelector('#legacyEbookConfirmation');
    let previousFocus = null;
    function loadBrevoForm() {
      if (!frame.getAttribute('src')) frame.setAttribute('src', frame.dataset.src);
    }
    function openModal(event) {
      event.preventDefault();
      previousFocus = event.currentTarget;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      loadBrevoForm();
      closeModal.focus();
    }
    function hideModal() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      previousFocus?.focus();
    }
    document.querySelectorAll('[data-open-ebook]').forEach(button => button.addEventListener('click', openModal));
    closeModal.addEventListener('click', hideModal);
    modal.addEventListener('click', event => { if (event.target === modal) hideModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && modal.classList.contains('open')) hideModal(); });
    modal.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll('a[href], button:not([disabled]), iframe:not([hidden]), input:not([disabled])')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    const confirmationToken = new URLSearchParams(location.search).get('confirm');
    if (confirmationToken) {
      history.replaceState({}, '', location.pathname + location.hash);
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      formShell.hidden = true;
      const note = modal.querySelector('.demo-note');
      if (note) note.hidden = true;
      legacyConfirmation.hidden = false;
      const confirmButton = document.createElement('button');
      confirmButton.type = 'button'; confirmButton.className = 'button';
      confirmButton.textContent = 'XÁC NHẬN EMAIL →';
      const confirmStatus = document.createElement('div');
      confirmStatus.className = 'form-message';
      confirmStatus.setAttribute('role', 'status');
      legacyConfirmation.append(confirmButton, confirmStatus);
      confirmButton.focus();
      confirmButton.addEventListener('click', async () => {
        confirmButton.disabled = true;
        confirmStatus.textContent = 'Đang xác nhận…';
        try {
          const response = await fetch('/.netlify/functions/ebook', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'confirm',token:confirmationToken})});
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Không thể xác nhận.');
          confirmStatus.textContent = data.message; confirmButton.hidden = true;
        } catch (error) { confirmStatus.textContent = error.message || 'Lỗi kết nối.'; confirmButton.disabled = false; }
      });
    }
