/**
 * @name Watch Later
 * @description Ajoute un bouton "Watch Later" sur les fiches et les affiches, avec un onglet dédié dans la barre de navigation.
 * @updateUrl none
 * @version 3.0.0
 * @author Toi
 */

(() => {
  // ─────────────────────────────────────────────
  // STORAGE
  // ─────────────────────────────────────────────
  const STORAGE_KEY = 'stremio_watch_later';

  function getList() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function saveList(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function isInList(id) {
    return getList().some(item => item.id === id);
  }

  function addToList(item) {
    if (isInList(item.id)) return false;
    const list = getList();
    list.unshift({ ...item, addedAt: Date.now() });
    saveList(list);
    return true;
  }

  function removeFromList(id) {
    saveList(getList().filter(item => item.id !== id));
  }

  // ─────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const existing = document.getElementById('wl-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'wl-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
      background: ${type === 'success' ? '#7b5ea7' : '#555'};
      color: #fff; padding: 10px 22px; border-radius: 8px;
      font-size: 14px; font-weight: 600; z-index: 999999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4); opacity: 1;
      transition: opacity 0.4s ease; pointer-events: none;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 2500);
  }

  // ─────────────────────────────────────────────
  // EXTRACTION
  // ─────────────────────────────────────────────
  function extractMetaFromDetailPage() {
    const url = window.location.hash || window.location.href;
    const idMatch = url.match(/\/detail\/([^/]+)\/([^/]+)/);
    const title = document.querySelector('[class*="name-"] h1, [class*="title-"] h1, h1')?.textContent?.trim()
      || document.title?.replace(' - Stremio', '').trim() || 'Titre inconnu';
    const poster = document.querySelector('[class*="poster-"] img, [class*="background-"] img')?.src || '';
    if (idMatch) return { id: `${idMatch[1]}:${idMatch[2]}`, type: idMatch[1], title, poster };
    return null;
  }

  function extractMetaFromPoster(posterEl) {
    const link = posterEl.closest('a[href*="/detail/"]') || posterEl.querySelector('a[href*="/detail/"]');
    if (!link) return null;
    const match = link.getAttribute('href')?.match(/\/detail\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    const title = posterEl.querySelector('[class*="name-"], [class*="title-"], [class*="label-"]')?.textContent?.trim() || 'Titre inconnu';
    const poster = posterEl.querySelector('img')?.src || '';
    return { id: `${match[1]}:${match[2]}`, type: match[1], title, poster };
  }

  // ─────────────────────────────────────────────
  // BADGE
  // ─────────────────────────────────────────────
  function updateBadge() {
    const badge = document.getElementById('wl-nav-badge');
    if (!badge) return;
    const count = getList().length;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  // ─────────────────────────────────────────────
  // ONGLET NAV — injecté et surveillé en permanence
  // ─────────────────────────────────────────────
  function injectNavTab() {
    if (document.getElementById('wl-nav-tab')) return;

    const nav = document.querySelector('.vertical-nav-bar-qGRze.vertical-nav-bar-container-UPAkA');
    if (!nav) return;

    const tab = document.createElement('a');
    tab.id = 'wl-nav-tab';
    tab.tabIndex = -1;
    tab.title = 'Watch Later';
    tab.className = 'nav-tab-button-tW6qT nav-tab-button-container-dYhs0 button-container-zVLH6';
    tab.href = '#';
    tab.style.position = 'relative';

    tab.innerHTML = `
      <svg class="icon-TzPrK" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <circle cx="256" cy="256" r="192" style="stroke:currentcolor;stroke-width:32;fill:none;"/>
        <line x1="256" y1="256" x2="256" y2="144" style="stroke:currentcolor;stroke-width:32;stroke-linecap:round;"/>
        <line x1="256" y1="256" x2="320" y2="288" style="stroke:currentcolor;stroke-width:32;stroke-linecap:round;"/>
      </svg>
      <div class="label-BCz2f">Watch Later</div>
      <span id="wl-nav-badge" style="
        display:none; position:absolute; top:6px; right:6px;
        background:#e53935; color:#fff; font-size:10px; font-weight:700;
        min-width:18px; height:18px; border-radius:999px;
        align-items:center; justify-content:center; padding:0 4px;
        pointer-events:none;
      ">0</span>
    `;

    tab.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showWatchLaterPage();
    });

    nav.appendChild(tab);
    updateBadge();
  }

  // Écoute les clics sur les onglets natifs pour fermer notre page
  function listenNativeNavClicks() {
    const nav = document.querySelector('.vertical-nav-bar-qGRze.vertical-nav-bar-container-UPAkA');
    if (!nav || nav.dataset.wlListener) return;
    nav.dataset.wlListener = '1';
    nav.addEventListener('click', (e) => {
      const clickedTab = e.target.closest('a.nav-tab-button-tW6qT');
      // Si c'est un onglet natif (pas notre Watch Later), on ferme la page
      if (clickedTab && clickedTab.id !== 'wl-nav-tab') {
        hideWatchLaterPage();
      }
    });
  }

  // ─────────────────────────────────────────────
  // PAGE WATCH LATER
  // ─────────────────────────────────────────────
  let watchLaterVisible = false;

  function showWatchLaterPage() {
    watchLaterVisible = true;

    let page = document.getElementById('wl-page');
    if (!page) {
      page = document.createElement('div');
      page.id = 'wl-page';
      page.style.cssText = `
        position: fixed;
        top: 0; right: 0; bottom: 0;
        left: 70px;
        background: #0e0e12;
        z-index: 50;
        overflow-y: auto;
        padding: 40px 32px;
        box-sizing: border-box;
      `;
      document.body.appendChild(page);
    }

    renderWatchLaterPage(page);
    page.style.display = 'block';

    // Marquer notre onglet comme actif
    const tab = document.getElementById('wl-nav-tab');
    if (tab) tab.style.opacity = '1';
  }

  function hideWatchLaterPage() {
    watchLaterVisible = false;
    const page = document.getElementById('wl-page');
    if (page) page.style.display = 'none';
    const tab = document.getElementById('wl-nav-tab');
    if (tab) tab.style.opacity = '';
  }

  function renderWatchLaterPage(container) {
    const list = getList();
    container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = `display:flex; align-items:center; gap:14px; margin-bottom:32px;`;
    header.innerHTML = `
      <svg viewBox="0 0 512 512" width="36" height="36" xmlns="http://www.w3.org/2000/svg" style="color:#fff;flex-shrink:0;">
        <circle cx="256" cy="256" r="192" style="stroke:currentcolor;stroke-width:32;fill:none;"/>
        <line x1="256" y1="256" x2="256" y2="144" style="stroke:currentcolor;stroke-width:32;stroke-linecap:round;"/>
        <line x1="256" y1="256" x2="320" y2="288" style="stroke:currentcolor;stroke-width:32;stroke-linecap:round;"/>
      </svg>
      <div>
        <div style="font-size:26px;font-weight:800;color:#fff;">Watch Later</div>
        <div style="font-size:13px;color:#888;margin-top:2px;">${list.length} titre${list.length !== 1 ? 's' : ''}</div>
      </div>
    `;
    container.appendChild(header);

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;gap:16px;`;
      empty.innerHTML = `
        <svg viewBox="0 0 512 512" width="72" height="72" xmlns="http://www.w3.org/2000/svg">
          <circle cx="256" cy="256" r="192" style="stroke:#444;stroke-width:32;fill:none;"/>
          <line x1="256" y1="256" x2="256" y2="144" style="stroke:#444;stroke-width:32;stroke-linecap:round;"/>
          <line x1="256" y1="256" x2="320" y2="288" style="stroke:#444;stroke-width:32;stroke-linecap:round;"/>
        </svg>
        <div style="font-size:17px;color:#555;font-weight:600;">Ta liste est vide</div>
        <div style="font-size:13px;color:#444;">Survole une affiche et clique sur 🕐 pour ajouter un titre</div>
      `;
      container.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = `display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:20px;`;

    list.forEach(item => {
      const card = document.createElement('div');
      card.style.cssText = `position:relative;cursor:pointer;`;

      const img = document.createElement('img');
      img.src = item.poster || '';
      img.alt = item.title;
      img.style.cssText = `
        width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;
        background:#1e1e2a;display:block;transition:transform 0.2s,box-shadow 0.2s;
      `;
      img.addEventListener('mouseenter', () => { img.style.transform = 'scale(1.04)'; img.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)'; });
      img.addEventListener('mouseleave', () => { img.style.transform = ''; img.style.boxShadow = ''; });
      img.addEventListener('click', () => {
        const [type, id] = item.id.split(':');
        hideWatchLaterPage();
        window.location.hash = `#/detail/${type}/${id}/`;
      });

      const label = document.createElement('div');
      label.textContent = item.title;
      label.style.cssText = `color:#ddd;font-size:12px;margin-top:8px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;

      const removeBtn = document.createElement('button');
      removeBtn.innerHTML = '✕';
      removeBtn.title = 'Retirer';
      removeBtn.style.cssText = `
        position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.75);
        color:#fff;border:none;border-radius:50%;width:24px;height:24px;
        font-size:12px;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:2;
      `;
      card.addEventListener('mouseenter', () => { removeBtn.style.display = 'flex'; });
      card.addEventListener('mouseleave', () => { removeBtn.style.display = 'none'; });
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromList(item.id);
        renderWatchLaterPage(container);
        updateBadge();
        showToast(`"${item.title}" retiré`);
      });

      card.appendChild(img);
      card.appendChild(label);
      card.appendChild(removeBtn);
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  // ─────────────────────────────────────────────
  // BOUTON — PAGE DÉTAIL
  // ─────────────────────────────────────────────
  function injectDetailButton() {
    if (document.querySelector('.wl-detail-btn')) return;
    const meta = extractMetaFromDetailPage();
    if (!meta) return;
    const actionZone = document.querySelector('[class*="action-buttons-"], [class*="buttons-container-"], [class*="meta-links-"]');
    if (!actionZone) return;

    const btn = document.createElement('button');
    btn.className = 'wl-detail-btn';
    btn.innerHTML = isInList(meta.id) ? '✅ Dans Watch Later' : '🕐 Watch Later';
    btn.style.cssText = `
      display:inline-flex;align-items:center;gap:6px;padding:8px 18px;
      background:rgba(123,94,167,0.85);color:#fff;border:none;border-radius:6px;
      font-size:13px;font-weight:600;cursor:pointer;margin-left:8px;transition:background 0.2s;
    `;
    btn.onmouseenter = () => btn.style.background = 'rgba(123,94,167,1)';
    btn.onmouseleave = () => btn.style.background = 'rgba(123,94,167,0.85)';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const added = addToList(meta);
      if (added) {
        btn.innerHTML = '✅ Dans Watch Later';
        showToast(`"${meta.title}" ajouté à Watch Later`);
        updateBadge();
      } else {
        showToast(`"${meta.title}" est déjà dans ta liste`, 'info');
      }
    });

    actionZone.appendChild(btn);
  }

  // ─────────────────────────────────────────────
  // BOUTON — HOVER SUR AFFICHE
  // ─────────────────────────────────────────────
  function injectHoverButtons() {
    const posters = document.querySelectorAll('[class*="poster-container-"]:not([data-wl-injected])');
    posters.forEach(poster => {
      poster.setAttribute('data-wl-injected', '1');
      poster.style.position = 'relative';

      const btn = document.createElement('button');
      btn.className = 'wl-hover-btn';
      btn.title = 'Watch Later';

      // Affiche directement ✅ si déjà dans la liste
      const updateBtnState = () => {
        const meta = extractMetaFromPoster(poster);
        if (meta && isInList(meta.id)) {
          btn.textContent = '✅';
          btn.style.opacity = '1'; // toujours visible si déjà ajouté
        } else {
          btn.textContent = '🕐';
          btn.style.opacity = '0'; // caché jusqu'au hover
        }
      };

      btn.style.cssText = `
        position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.7);
        color:#fff;border:none;border-radius:50%;width:30px;height:30px;
        font-size:15px;cursor:pointer;display:flex;align-items:center;
        justify-content:center;opacity:0;transition:opacity 0.2s;z-index:10;
      `;

      poster.addEventListener('mouseenter', () => {
        const meta = extractMetaFromPoster(poster);
        // Ne montrer le hover que si pas déjà ajouté
        if (!meta || !isInList(meta.id)) btn.style.opacity = '1';
      });
      poster.addEventListener('mouseleave', () => {
        const meta = extractMetaFromPoster(poster);
        // Garder visible si déjà dans la liste
        if (!meta || !isInList(meta.id)) btn.style.opacity = '0';
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const meta = extractMetaFromPoster(poster);
        if (!meta) return;
        const added = addToList(meta);
        if (added) {
          btn.textContent = '✅';
          btn.style.opacity = '1'; // reste visible après ajout
          showToast(`"${meta.title}" ajouté à Watch Later`);
          updateBadge();
        } else {
          showToast(`"${meta.title}" est déjà dans ta liste`, 'info');
        }
      });

      updateBtnState();
      poster.appendChild(btn);
    });
  }

  // ─────────────────────────────────────────────
  // OBSERVER & ROUTING
  // ─────────────────────────────────────────────
  window.addEventListener('hashchange', () => {
    // Ferme la page Watch Later si on navigue via le hash (onglets natifs)
    if (watchLaterVisible) hideWatchLaterPage();

    const hash = window.location.hash;
    if (hash.includes('/detail/')) setTimeout(injectDetailButton, 800);
    setTimeout(injectHoverButtons, 1000);
  });

  // MutationObserver : ré-injecte l'onglet et les boutons si le DOM change
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      injectNavTab();
      listenNativeNavClicks();
      injectHoverButtons();
      if (window.location.hash.includes('/detail/')) injectDetailButton();
    }, 200);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Init
  setTimeout(() => {
    injectNavTab();
    listenNativeNavClicks();
    injectHoverButtons();
    updateBadge();
    console.log('[Watch Later] Plugin chargé ✅ v3.0.0');
  }, 1500);

})();
