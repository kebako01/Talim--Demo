/* =========================================================
   NAVBAR GLOBAL  – logo · enlaces · 🔍search · (espaciador) · 🔥 · ❕ · ⚙️ · 🌙
   Se auto-inyecta en <body> y emite el evento ‘header-ready’
   ========================================================= */

/* ——— Sprite Heroicons (solo una vez) ——— */
if (!document.getElementById('heroicons-sprite')) {
  const s = document.createElement('script');
  s.id  = 'heroicons-sprite';
  s.src = 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/dist/24/outline.js';
  document.head.prepend(s);
}

document.addEventListener('DOMContentLoaded', () => {
  /* ---------- Contenedor <header> ---------- */
  const page = location.pathname.split('/').pop() || 'index.html';
  const h = Object.assign(document.createElement('header'), {
    id:    'globalNav',
    className:
      'flex items-center gap-4 px-4 py-2 bg-white/95 dark:bg-slate-900/95 ' +
      'backdrop-blur supports-[backdrop-filter]:bg-white/60 ' +
      'sticky top-0 z-40 shadow'
  });
  document.body.prepend(h);

  /* ---------- Logo ---------- */
  const brand = document.createElement('a');
  brand.href  = './index.html';
  brand.className =
    'flex items-center hover:opacity-80 transition-opacity group';
  brand.innerHTML = `
    <img src="./assets/logo.png" alt="Talim"
         class="h-12 pointer-events-none select-none
                transition-transform group-hover:scale-105">`;
  h.appendChild(brand);

  /* ---------- Enlaces principales ---------- */
  const links = [
    ['index.html',    'Home',        'home'],
    ['skill.html',    'Habilidades', 'rectangle-stack'],
    ['biblio.html',   'Biblioteca',  'book-open'],
    ['progress.html', 'Progreso',    'chart-bar']
  ];
  links.forEach(([href, txt, icon]) => {
    const a = document.createElement('a');
    a.href = './' + href;
    a.className =
      'nav flex items-center gap-1.5 px-3 py-1.5 rounded-md ' +
      'hover:bg-slate-100 dark:hover:bg-slate-800';
    if (page === href) a.setAttribute('aria-current', 'page');
    a.innerHTML = `
      <svg class="w-5 h-5 stroke-current" fill="none" stroke-width="1.5">
        <use href="#heroicons-outline-${icon}"></use>
      </svg>
      <span>${txt}</span>`;
    h.appendChild(a);
  });

  /* ---------- Buscador global (NO crece) ---------- */
  const searchForm = document.createElement('form');
  searchForm.id = 'globalSearch';
  searchForm.autocomplete = 'off';
  searchForm.className =
    'relative hidden sm:block max-w-xs sm:max-w-sm lg:max-w-md';
  searchForm.innerHTML = `
    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5
                text-slate-400 pointer-events-none"
         xmlns="http://www.w3.org/2000/svg" fill="none"
         viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round"
            d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 4.5 4.5
               a7.5 7.5 0 0 0 12.15 12.15z"/>
    </svg>
    <input id="searchInput" type="search" placeholder="Buscar…"
           class="w-full pl-10 pr-3 py-2 rounded-lg bg-slate-100
                  focus:bg-white focus:outline-none focus:ring-2
                  focus:ring-indigo-400 transition-colors dark:bg-slate-800
                  dark:focus:bg-slate-900">
    <div id="searchDrop"
         class="hidden absolute left-0 right-0 top-full mt-1 bg-white
                border border-slate-200 rounded-lg shadow-lg z-50
                max-h-80 overflow-y-auto text-sm"></div>`;
  h.appendChild(searchForm);

  /* ---------- ESPACIADOR que empuja el resto a la derecha ---------- */
  const spacer = Object.assign(document.createElement('div'), {
    id: 'navSpacer',
    style: 'flex:1'
  });
  h.appendChild(spacer);

  /* ---------- Racha 🔥 ---------- */
  (async () => {
    const { openDB } = await import('https://cdn.jsdelivr.net/npm/idb@7/+esm');
    const db   = await openDB('skills-trainer', 1);
    const rows = await db.getAll('progress');
    const DAY  = 86_400_000;
    const iso  = t => new Date(t).toISOString().slice(0, 10);
    const today= (()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime();})();
    const days = new Set(rows.map(r => iso(r.last)));
    let streak = 0;
    for (let off = 0; ; off++) {
      if (days.has(iso(today - off * DAY))) streak++;
      else break;
    }
    const s = document.createElement('span');
    s.title = 'Racha de práctica';
    s.className = 'font-semibold text-amber-500 select-none';
    s.textContent = `${streak} 🔥`;
    h.appendChild(s);
  })();

  /* ---------- Botón gamificación ❕ ---------- */
  const miniBtn = document.createElement('button');
  miniBtn.id = 'gamiMini';
  miniBtn.className = 'relative nav text-lg';   // grande para que destaque
  miniBtn.title = 'Progreso gamificación';
  miniBtn.textContent = '❕';

  const pop = document.createElement('div');
  pop.id = 'gamiPop';
  pop.className =
    'hidden absolute right-0 mt-2 w-60 bg-white shadow-lg ' +
    'border border-slate-200 rounded-lg p-4 z-50 text-sm';
  miniBtn.appendChild(pop);

  let hov = false;
  miniBtn.onmouseenter = () => { hov = true;  showPop(); };
  miniBtn.onmouseleave = () => { hov = false; hideLater(); };
  pop.onmouseenter     = () => { hov = true; };
  pop.onmouseleave     = () => { hov = false; hideLater(); };
  function hideLater () { setTimeout(() => !hov && pop.classList.add('hidden'), 160); }

  h.appendChild(miniBtn);

  /* ---------- Configuración ⚙️ ---------- */
  const cfg = document.createElement('a');
  cfg.href = './config.html';
  cfg.className = 'nav';
  cfg.title  = 'Configuración';
  cfg.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 1.5v1.636a.75.75 0 0 1-.611.733 8.254 8.254 0 0 0-2.743 1.14.75.75 0 0 1-.928-.118L5.4 3.723 3.723 5.4l1.168 1.568a.75.75 0 0 1-.118.928 8.254 8.254 0 0 0-1.14 2.743.75.75 0 0 1-.733.611H1.5v2.25h1.636c.359 0 .674.256.733.611a8.254 8.254 0 0 0 1.14 2.743.75.75 0 0 1-.118.928L3.723 18.6 5.4 20.277l1.568-1.168a.75.75 0 0 1 .928.118 8.254 8.254 0 0 0 2.743 1.14.75.75 0 0 1 .611.733V22.5h2.25v-1.636a.75.75 0 0 1 .611-.733 8.254 8.254 0 0 0 2.743-1.14.75.75 0 0 1 .928-.118l1.568 1.168 1.677-1.677-1.168-1.568a.75.75 0 0 1 .118-.928 8.254 8.254 0 0 0 1.14-2.743.75.75 0 0 1 .733-.611H22.5v-2.25h-1.636a.75.75 0 0 1-.733-.611 8.254 8.254 0 0 0-1.14-2.743.75.75 0 0 1 .118-.928l1.168-1.568L18.6 3.723l-1.568 1.168a.75.75 0 0 1-.928-.118 8.254 8.254 0 0 0-2.743-1.14.75.75 0 0 1-.611-.733V1.5h-2.25zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
    </svg>
  `;
  h.appendChild(cfg);

  /* (El botón 🌙 se añadirá desde config.js y quedará aún más a la derecha) */

  /* ======================================================
            BUSCADOR · Autocompletado rápido
     ====================================================== */
  (async () => {
    let DATA = [];
    try {
      const { getDataset } = await import('./searchDataset.js');
      DATA = await getDataset();
    } catch (e) { console.error('Search dataset error:', e); }

    const input = searchForm.querySelector('#searchInput');
    const drop  = searchForm.querySelector('#searchDrop');

    const draw = hits => {
      drop.innerHTML = hits.length
        ? hits.map(h => `
            <a href="${h.link}"
               class="flex items-center gap-2 px-4 py-2 hover:bg-slate-100">
              <svg class="w-4 h-4 text-slate-400 stroke-current"
                   fill="none" stroke-width="1.5">
                <use href="#heroicons-outline-${h.icon}"></use>
              </svg>
              <span>${h.label}</span>
            </a>`).join('')
        : '<p class="px-4 py-3 text-slate-500">Sin resultados</p>';
    };

    input.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      if (q.length < 2) { drop.classList.add('hidden'); return; }
      const hits = DATA.filter(d => d.label.toLowerCase().includes(q)).slice(0, 10);
      draw(hits); drop.classList.remove('hidden');
    });
    input.addEventListener('blur', () =>
      setTimeout(() => drop.classList.add('hidden'), 120));
    searchForm.onsubmit = ev => ev.preventDefault();
  })();

  /* ----------------- Pop-up gamificación ----------------- */
  async function showPop () {
    const { nextProgress } = await import('./gamification.js');
    const list = await nextProgress();
    pop.innerHTML = list.length
      ? list.map(ev => `
          <div class="mb-3 last:mb-0">
            <div class="flex justify-between items-center">
              <span>${ev.name}</span>
              <span class="font-semibold">${Math.round(ev.pct * 100)}%</span>
            </div>
            <div class="h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
              <div class="h-full bg-indigo-500"
                   style="width:${ev.pct * 100}%"></div>
            </div>
          </div>`).join('')
      : '<p>¡Todos los logros conseguidos! 🎉</p>';
    pop.classList.remove('hidden');
  }

  /* ---------- Avisar a otros módulos ---------- */
  document.dispatchEvent(new Event('header-ready'));
});
