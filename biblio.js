/******************************************************************
 *  Biblioteca de conceptos
 *  – Muestra contenido en lugar de preguntas
 *  – Estado/espaciado compartido con Skills & Diagnóstico
 *****************************************************************/
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';
import { renderRich } from './richRender.js';
function iconPath (state){
  return `./assets/${state === 'Not started' ? 'Notstarted' : state}.png`;
}
const DB_VER = 2;
/*  BD & constantes  */
const db = await openDB('skills-trainer', DB_VER, {
  upgrade (db) {
    if (!db.objectStoreNames.contains('progress')) {
      db.createObjectStore('progress', { keyPath: 'skillId' });
    }
  }
});
const STATES = ['Not started','Attempted','Familiar','Proficient','Mastered'];
const ICON = s => iconPath(s);
function toast (m,ok=true){ Toastify({text:m,duration:2000,gravity:'top',
  className:ok?'bg-emerald-600':'bg-rose-600'}).showToast(); }

const $ = id => document.getElementById(id);
const hide = (...e)=>e.forEach(el=>el.classList.add('hidden'));
const show = (...e)=>e.forEach(el=>el.classList.remove('hidden'));

/*  Vistas  */
const branchView = $('branchView');
const skillView  = $('skillView');
const readView   = $('readView');

const MAX_RECO = 4;
let   RECO_SET = new Set();
/*  Datos runtime */
let DATA, currentBranch, currentSkill;
const DAY_MS = 86_400_000;


function isDue (rec){
  if (!rec) return true;                                 // nunca vista
  if (rec.state === 'Attempted') return true;            // nivel bajo
  const gone = (Date.now() - rec.last) / DAY_MS;
  return gone >= rec.interval;                           // revisión vencida
}

async function buildGlobalRecommendations (){
  const recs = await db.getAll('progress');
  const map  = Object.fromEntries(recs.map(r=>[r.skillId,r]));
  const now  = Date.now();

  const scored = [];
  for (const b of DATA.branches){
    for (const s of b.skills){
      const id  = `${b.name}|${s.name}`;
      const rec = map[id];
      if (!isDue(rec)) continue;                         // solo «vencidas»
      const stIdx   = STATES.indexOf(rec?.state || 'Not started');
      const overdue = rec ? (now - rec.last)/DAY_MS / (rec.interval||1) : 10;
      const score   = 4*(4-stIdx) + overdue;             // prioridad simple
      scored.push({ id, score });
    }
  }
  RECO_SET = new Set(
    scored.sort((a,b)=>b.score-a.score)
          .slice(0,MAX_RECO)
          .map(o=>o.id)
  );
}
/*  Carga inicial */
/* ─────────── Carga inicial + deep-link ─────────── */
(async function init () {
  DATA = await (await fetch('./assets/biblio.json')).json();
  await buildGlobalRecommendations();   //  ← NUEVO
  await handleDeepLink();
})();

/* ─────────── deep-link desde ?branch=&skill= ─────────── */
async function handleDeepLink () {
  const params      = new URLSearchParams(location.search);
  const branchName  = params.get('branch') && decodeURIComponent(params.get('branch'));
  const skillName   = params.get('skill')  && decodeURIComponent(params.get('skill'));

  if (!branchName) {               // sin parámetros → pantalla inicial
    renderBranches(); return;
  }

  const branch = DATA.branches.find(b => b.name === branchName);
  if (!branch) {                   // parámetro erróneo
    renderBranches(); return;
  }

  await openBranch(branch);        // pinta grid de habilidades

  if (skillName) {
    const skill = branch.skills.find(s => s.name === skillName);
    if (skill) openSkill(skill);   // abre vista de lectura directamente
  }
}
/*  ¿Muestra la estrella?  */
async function shouldRecommend(branch, skill){
  const rec = await db.get('progress',`${branch}|${skill}`);
  if (!rec) return true;                       // nunca tocada → recomendar
  const stateIdx   = STATES.indexOf(rec.state); // 0..4
  const overdue    = rec.last ? (Date.now()-rec.last)/DAY_MS > rec.interval : true;
  return stateIdx < STATES.indexOf('Familiar') || overdue;
}
/*  Render ramas */
function renderBranches(){
  branchView.innerHTML='';
  DATA.branches.forEach(b=>{
    const card=document.createElement('div');
    card.className='bg-white shadow rounded p-5 cursor-pointer hover:ring-2 ring-indigo-400';
    card.innerHTML=`<h3 class="text-xl font-semibold text-center">${b.name}</h3>`;
    card.onclick=()=>openBranch(b);
    branchView.appendChild(card);
  });
  show(branchView); hide(skillView,readView);
}

/*  Render habilidades */
async function openBranch(b){
  currentBranch=b;
  $('branchTitle').textContent=b.name;
  const grid=$('skillGrid');
  grid.innerHTML='';
  for (const s of b.skills){
    const st  = await getState(b.name, s.name);
    const c   = document.createElement('div');
    c.className = 'relative flex flex-col items-center gap-3 bg-white shadow rounded p-5 cursor-pointer hover:ring-2 ring-indigo-400';
    c.innerHTML = `
        <img src="${ICON(st)}" class="h-16">
        <h4 class="font-semibold text-center">${s.name}</h4>
    `;
     const id = `${b.name}|${s.name}`;
    if (RECO_SET.has(id)){
      c.insertAdjacentHTML('beforeend',
        `<img src="./assets/star.png" alt="recomendado" class="reco-star">`);
    }
    c.onclick = () => openSkill(s);
    grid.appendChild(c);
    }
  hide(branchView,readView); show(skillView);
}

/* ─────── variables paginación ─────── */
// ─────────── variables paginación ───────────
let pages = []; // guardará strings ya ENRIQUECIDOS
let pIdx = 0;

// ─────────── helpers paginación ───────────
// paginator basado en tokens
function paginate(raw, max = 1000){
  const out = [];
  let buf='';
  for (const para of raw.split(/\n{2,}/)){          // trocea por párrafos
    if (buf.length + para.length > max){
      out.push(buf.trim()); buf='';
    }
    buf += (buf?'\n\n':'') + para;
  }
  if (buf) out.push(buf.trim());
  return out;        // devuelve Markdown crudo → lo procesará marked
}

async function renderPage(i) {
  pIdx = i;
  $('pageIndic').textContent = `${i + 1}/${pages.length}`;
  $('nextPage').disabled = i === pages.length - 1;
  $('prevPage').disabled = i === 0;
  await renderRich($('contentBox'), pages[i]);
  $('btnDone').classList.toggle('hidden', i !== pages.length - 1);
}

/* ─────── listeners paginación ─────── */
$('nextPage').onclick = () => {
  if (pIdx < pages.length - 1) renderPage(pIdx + 1);
};
$('prevPage').onclick = () => {
  if (pIdx > 0) renderPage(pIdx - 1);
};
document.addEventListener('keydown', e => {
  if (readView.classList.contains('hidden')) return;
  if (e.key === 'ArrowRight' && pIdx < pages.length - 1) renderPage(pIdx + 1);
  if (e.key === 'ArrowLeft' && pIdx > 0) renderPage(pIdx - 1);
});


/*  Vista lectura */
async function openSkill(skill) {
  currentSkill = skill;
  $('readSkillTitle').textContent = `${currentBranch.name} › ${skill.name}`;
  pages = paginate(skill.content); // ya devuelve HTML
  await renderRich($('contentBox'), pages[0]);
  hide(branchView, skillView);
  show(readView);
}
/*  Botones */
$('backBranches').onclick = renderBranches;
$('backSkills').onclick   = () => openBranch(currentBranch);
$('btnDone'     ).onclick = () => finishRead(true);
$('btnSkip'     ).onclick = () => finishRead(false);

/*  Finalizar lectura */
async function finishRead(done){
  await updateState(done);
  toast(done?'✔ Registrado':'Omitido',done);
  openBranch(currentBranch);            // refresca estados
}

/*  Estado */
async function getState(branch,skill){
  const r=await db.get('progress',`${branch}|${skill}`); return r?.state||'Not started';
}
/* ---------------------------------------------------------------
   Guarda progreso de LECTURA + ajuste por baseDifficulty
-----------------------------------------------------------------*/
async function updateState (firstTry) {
  const id = `${currentBranch.name}|${currentSkill.name}`;
  let rec  = await db.get('progress', id) ?? {
        skillId:id,state:'Not started',interval:1,efactor:2.5,
        last:0,streak:0,consecutiveFails:0
      };

  /* ─── ajuste de estado simple (lectura) ─── */
  let idx = STATES.indexOf(rec.state);
  if (firstTry) idx = Math.min(idx + 1, 4);
  else          idx = Math.max(idx - 1, 1);
  if (idx === 0) idx = 1;
  rec.state = STATES[idx];

  /* ─── SM-2 light + baseDifficulty ─── */
  const skillDifficulty = currentSkill.baseDifficulty || 3;   // <<< NUEVO
  const q = firstTry ? 5 : 2;
  rec.efactor = Math.max(1.3,
                rec.efactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  rec.interval = firstTry
      ? (rec.interval === 1 ? 3
         : rec.interval === 3 ? 7
         : Math.round(rec.interval * rec.efactor))
      : 1;

  rec.interval = Math.round(rec.interval * (skillDifficulty / 3)); // <<< NUEVO

  rec.last = Date.now();
  await db.put('progress', rec);
}
window.addEventListener('skill-updated', e => {
  const id = e.detail.skillId;
  updateUI(id); // tu función de refresco parcial
});
