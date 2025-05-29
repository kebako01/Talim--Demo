/*  searchDataset.js  – genera el índice para el buscador global  */
let CACHE;

export async function getDataset () {
  if (CACHE) return CACHE;

  /* Páginas fijas */
  const pages = [
    { label:'Inicio',        icon:'home',            link:'index.html'   },
    { label:'Habilidades',   icon:'rectangle-stack', link:'skill.html'   },
    { label:'Biblioteca',    icon:'book-open',       link:'biblio.html'  },
    { label:'Progreso',      icon:'chart-bar',       link:'progress.html'},
    { label:'Configuración', icon:'cog-6-tooth',     link:'config.html'  }
  ];

  /* Ramas + skills de biblio.json */
  let extra = [];
  try {
    const bib = await (await fetch('./assets/biblio.json')).json();
    bib.branches.forEach(b => {
      extra.push({
        label: `${b.name}`,
        icon : 'folder',
        link : `biblio.html?branch=${encodeURIComponent(b.name)}`
      });
      b.skills.forEach(s => {
        extra.push({
          label:`${b.name} › ${s.name}`,
          icon :'academic-cap',
          link :`biblio.html?branch=${encodeURIComponent(b.name)}&skill=${encodeURIComponent(s.name)}`
        });
      });
    });
  } catch (err) {
    console.error('No se pudo leer biblio.json:', err);
  }

  CACHE = [...pages, ...extra];
  return CACHE;
}
