/* Tema claro / oscuro compartido ─────────────────────────────── */

const KEY       = 'theme';
const prefers   = window.matchMedia('(prefers-color-scheme: dark)').matches;
const saved     = localStorage.getItem(KEY);

/* esperamos a que exista <html> (DOMContentLoaded) */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(saved || (prefers ? 'dark' : 'light'));
  /* si el header aún no existía, lo insertaremos cuando llegue */
  document.addEventListener('header-ready', placeToggle, {once:true});
  placeToggle();          // sólo si hay <header>
});

/* ---------- Botón ---------- */
function placeToggle(){
  const header = document.querySelector('header');
  if (!header) return;                          // aún no existe

  if (document.getElementById('themeToggle')) return; // ya añadido

  const btn       = document.createElement('button');
  btn.id          = 'themeToggle';
  btn.type        = 'button';
  btn.textContent = icon();
  btn.onclick     = () => { const t = nextTheme(); applyTheme(t); btn.textContent = icon(); };

  /* ----- posición fija: antes del enlace de Configuración ------ */
  const cfgLink = header.querySelector('a[href="./config.html"]');
  if (cfgLink) header.insertBefore(btn, cfgLink);   // siempre antes
  else         header.appendChild(btn);             // por si falla
}

/* ---------- helpers ---------- */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(KEY, t);
}
const isDark  = () => document.documentElement.dataset.theme === 'dark';
const nextTheme = () => {
  const current = document.documentElement.dataset.theme;
  const themes = ['light', 'dark', 'pink'];
  const nextIndex = (themes.indexOf(current) + 1) % themes.length;
  return themes[nextIndex];
};

// Actualizar la función icon
const icon = () => {
  const theme = document.documentElement.dataset.theme;
  return {
    'light': '🌙',
    'dark': '🌞',
    'pink': '🌸'
  }[theme];
};


/* ---------- Perfil (vista / edición) --------------------------- */
const DEFAULT_AVATAR = './assets/avatar-default.png';
const $ = id => document.getElementById(id);

/* ➊ ¿Estamos en la página que tiene la sección perfil? */
if ($('profileSection')) {
  function loadProfile () {
    const cfg = JSON.parse(localStorage.getItem('userCfg') || '{}');
    $('profileName'  ).textContent = cfg.name   || 'Tu nombre';
    $('profileAvatar').src        = cfg.avatar || DEFAULT_AVATAR;
    $('uName'  ).value = cfg.name   || '';
    $('uAvatar').value = cfg.avatar || '';
  }
  loadProfile();

  /* -- toggle edición -- */
  $('editProfileBtn').onclick = () => {
    $('profileDisplay').classList.add   ('hidden');
    $('profileEdit'  ).classList.remove ('hidden');
  };

  $('cancelProfile').onclick = () => {
    $('profileEdit'  ).classList.add   ('hidden');
    $('profileDisplay').classList.remove('hidden');
  };

  $('saveProfile').onclick = () => {
    const cfg = JSON.parse(localStorage.getItem('userCfg') || '{}');
    cfg.name   = $('uName').value.trim()   || cfg.name   || 'Anónimo';
    cfg.avatar = $('uAvatar').value.trim() || cfg.avatar || DEFAULT_AVATAR;
    localStorage.setItem('userCfg', JSON.stringify(cfg));
    loadProfile();
    $('profileEdit'  ).classList.add   ('hidden');
    $('profileDisplay').classList.remove('hidden');
    toast('✔ Perfil actualizado');
    document.dispatchEvent(new CustomEvent('user-change', {detail: cfg}));
  };
}
