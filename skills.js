/********************************************************************
 *  Skills Trainer – lógica principal
 *  CDN libs:
 *    idb  : https://cdn.jsdelivr.net/npm/idb@7/+esm
 *    toast: window.Toastify
 *******************************************************************/
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';
import { checkAchievements, registerReview } from './gamification.js';
import { thresholds, warmUpNeed, dayCount } from './poolHelpers.js';
import { renderRich } from './richRender.js';
function iconPath (state){
  return `./assets/${state === 'Not started' ? 'Notstarted' : state}.png`;
}

// ───────────────────────────────── Base de datos
const DB_VER = 2;
const db = await openDB('skills-trainer', DB_VER, {
  upgrade (db) {
    if (!db.objectStoreNames.contains('progress')) {
      db.createObjectStore('progress', { keyPath: 'skillId' });
    }
  }
});

// Estados posibles y su orden
const STATES = ['Not started', 'Attempted', 'Familiar', 'Proficient', 'Mastered'];
const WARMUP_REPS = 3;
const WARMUP_INT  = 0.02;
const MAX_RECO = 4;
let   RECO_SET = new Set();   

/*  Decide las 4 habilidades con mejor prioridad (se llama una vez) */
async function buildGlobalRecommendations () {
  const recs = await db.getAll('progress');                //  estado guardado
  const map  = Object.fromEntries(recs.map(r=>[r.skillId,r]));
  const now  = Date.now();

  /* 1. recorrer todo el catálogo y asignar una puntuación */
  const scored = [];
  for (const b of DATA.branches){
    for (const s of b.skills){
      const id   = `${b.name}|${s.name}`;
      const rec  = map[id];
      const due  = isDue(rec);            // incluye warm-up
      if (!due) continue;                 // solo se valoran las “vencidas”

      const stIdx   = STATES.indexOf(rec?.state || 'Not started'); // 0–4
      const overdue = rec ? (now - rec.last) / DAY_MS / rec.interval : 10;
      const score   = 4 * (4 - stIdx) + overdue; // prioridad simple
      scored.push({ id, score });
    }
  }

  /* 2. ordenar por score y quedarnos con las 4 mejores  */
  RECO_SET = new Set(
    scored.sort((a, b) => b.score - a.score)
          .slice(0, MAX_RECO)
          .map(o => o.id)
  );
}

// ───────────────────────────────── Utilidades UI
function toast (msg, ok = true) {
  Toastify({
    text      : msg,
    gravity   : 'top',
    position  : 'center',
    duration  : 2000,
    className : ok ? 'bg-emerald-500' : 'bg-rose-600'
  }).showToast();
}

function $(id) { return document.getElementById(id); }
function hide (...els) { els.forEach(e => e.classList.add('hidden')); }
function show (...els) { els.forEach(e => e.classList.remove('hidden')); }

// Rutas de vistas
const branchView = $('branchView');
const skillView  = $('skillView');
const quizView   = $('quizView');


const summaryView  = $('summaryView');
const summaryBody  = $('summaryBody');
const summaryClose = $('summaryClose');

const pct = (JSON.parse(localStorage.getItem('userCfg')||'{}').pracPct)||5;

let baselineState;   // estado antes de empezar la sesión
// Cache de datos
let DATA;                      // json preguntas
let BIBLIO;                                   // cache de biblio.json
let currentBranch, currentSkill, skillQuestions;
let queue        = [];         // preguntas planificadas
let qIdx         = 0;
let firstTry     = true;
let hintPointer  = 0;
let previewMode  = false;  
const DAY_MS = 86_400_000;
const ICON = s => iconPath(s);         /* (ya existía para biblio.js) */
function isDue (rec, poolN = 10){
  if (!rec) return true;                         // nunca vista

  /* 1· Calentamiento                                                */
  const need = warmUpNeed(rec.state, poolN);
  if (need && (rec.repetitions||0) < need) return true;

  /* 2· Attempted siempre due hasta ser Familiar                     */
  if (rec.state === 'Attempted') return true;

  /* 3· Revisión espaciada – zona-horaria-neutra                     */
  const daysGone = dayCount(Date.now()) - dayCount(rec.last);
  return daysGone >= rec.interval;
}

// ───────────────────────────────── Carga inicial
(async function init () {
  DATA   = await (await fetch('./assets/questions.json')).json();
  BIBLIO = await (await fetch('./assets/biblio.json')).json();
  await buildGlobalRecommendations();    // ← NUEVO
  renderBranches();
  await handleDeepLink();
})();
/*  Una habilidad es RECOMENDABLE cuando … 
    –  está vencida  (isDue = true)                           ► repasar ya
    –  ó   está en estado bajo (< Familiar)  Y  no está bloqueada
      (bloqueada = !isDue && intervalo>0)                    ► seguir aprendiendo
    Cualquier skill bloqueada deja de mostrar la estrella.   */
async function shouldRecommend (branch, skill) {
  const rec = await db.get('progress', `${branch}|${skill}`);
  const due = isDue(rec);                       // ya incluye warm-up
  if (due) return true;                         // vencida → ⭐

  if (!rec) return true;                        // nunca vista → ⭐ siempre

  const lowState = STATES.indexOf(rec.state) < STATES.indexOf('Familiar');
  /* está bloqueada → no recomendar todavía                            */
  return lowState && due;                       // ← due == false ➜ no ⭐
}
// ───────────────────────────────── Render ramas
function renderBranches () {
  branchView.innerHTML = '';
  DATA.branches.forEach(branch => {
    const card = document.createElement('div');
    card.className = 'bg-white shadow rounded p-5 cursor-pointer hover:ring-2 ring-indigo-400';
    card.innerHTML = `<h3 class="text-xl font-semibold text-center">${branch.name}</h3>`;
    card.onclick = () => openBranch(branch);
    branchView.appendChild(card);
  });
  show(branchView); hide(skillView, quizView);
}
/* ─────────── deep-link ?branch=&skill= ─────────── */
async function handleDeepLink () {
  const p = new URLSearchParams(location.search);
  const bName = p.get('branch') && decodeURIComponent(p.get('branch'));
  if (!bName) return;                                // sin parámetros
  const branch = DATA.branches.find(b=>b.name===bName);
  if (!branch)  return;                              // rama inexistente

  await openBranch(branch);                          // muestra grid

  const sName = p.get('skill') && decodeURIComponent(p.get('skill'));
  if (!sName) return;
  const skill = branch.skills.find(s=>s.name===sName);
  if (!skill) return;

  /* practica directa: ignora bloqueo */
  startSkillSession(skill);
}
function nextReviewDate (rec){
  if (!rec) return null;
  const nextDayCount = dayCount(rec.last) + rec.interval;
  return nextDayCount * DAY_MS;          // el mismo mediodía local
}
async function openBranch (branch) {
  currentBranch = branch;
  $('skillBranchTitle').textContent = branch.name;
  const grid = $('skillGrid');
  grid.innerHTML = '';

  let recoCount = 0;                     // ← NUEVO contador

  for (const skill of branch.skills){
    const state = await getState(branch.name, skill.name);
    const rec   = await db.get('progress',`${branch.name}|${skill.name}`);
    const due   = isDue(rec);

    const card  = document.createElement('div');
    card.className =
      'relative flex flex-col items-center gap-3 bg-white shadow rounded '+
      'p-5 cursor-pointer hover:ring-2 ring-indigo-400';

    card.innerHTML = `
        <img src="${iconPath(state)}" alt="${state}" class="h-16">
        <h4 class="font-semibold text-center">${skill.name}</h4>`;

    /* ─── Recomendar solo si no hemos llegado al límite ─── */
     const id = `${branch.name}|${skill.name}`;
     if (RECO_SET.has(id)) {

      card.insertAdjacentHTML('beforeend',
        `<img src="./assets/star.png" alt="recomendado" class="reco-star">`);
      recoCount++;                       // ← incrementa
    }
      card.onclick = () => {
       if (!due){
        toast(`⏳ Próxima review: ${new Date(next).toLocaleDateString()}`,false);
        return;
      }
      startSkillSession(skill);
    };

    if (!due){  // desactivar visualmente
      card.style.opacity = .45; card.style.cursor='not-allowed';
      /* ─── Botón PREVIEW ─── */
      const btn=document.createElement('button');
      btn.textContent='Preview';
      btn.className='absolute bottom-2 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded bg-gray-300';
      btn.onclick=e=>{
        e.stopPropagation();
        startSkillSession(skill,true);        // preview = true
      };
      card.appendChild(btn);
    }
    grid.appendChild(card);
    }
  hide(branchView, quizView); show(skillView);
}
/* ─── barra de progreso con dots ─────────────────────────────── */
function buildDots (n) {
  const box = $('progressDots');
  box.innerHTML = '';
  for (let i=0;i<n;i++){
    const d = document.createElement('div');
    d.className = 'progress-dot'; box.appendChild(d);
  }
}
function updateDots (idx) {              // idx = posición actual
  const dots = $('progressDots').children;
  [...dots].forEach((d,i)=>{
    d.classList.toggle('active', i===idx);
    d.classList.toggle('done'  , i< idx);
  });
}
/* ---------- ajuste llamada ---------- */
async function startSkillSession (skill, preview=false) {
  currentSkill    = skill;
  previewMode     = preview;
  $('quizSkillTitle').textContent = `${currentBranch.name} › ${skill.name}`;
  skillQuestions  = [...skill.questions];
  queue           = await generateQueue(await getStateObj()); // ← await
  qIdx            = 0;
  baselineState   = await getState(currentBranch.name, skill.name);
  loadQuestion();
  buildDots(queue.length);

  hide(branchView, skillView); show(quizView);
}

/* ---------------------------------------------------------------
   Genera cola de práctica  +  “Laguna de Memoria” local
   – base = lógica anterior por dificultad
   – +15 % preguntas de otras skills «Mastered» con ≥ 50 % intervalo
-----------------------------------------------------------------*/
async function generateQueue(progress) {
  const pctCfg = (JSON.parse(localStorage.getItem('userCfg') || '{}').pracPct) || 5;
  const N = Math.min(40, Math.max(5, Math.ceil(skillQuestions.length * (pctCfg / 100))));
  const low = skillQuestions.filter(q => q.difficulty <= 2);
  const mid = skillQuestions.filter(q => q.difficulty === 3);
  const high = skillQuestions.filter(q => q.difficulty >= 4);

  const up = STATES.indexOf(progress?.state || 'Not started') >= STATES.indexOf('Proficient');
  const take = (arr, n) => arr.sort(() => 0.5 - Math.random()).slice(0, n);

  // --------- Ajustar pesos según hitRate ---------
  const hitRate = (branch, skill, level) => {
    const st = JSON.parse(localStorage.getItem('stats') || '{}');
    const k = `${branch}|${skill}|diff${level}`;
    if (!st[k] || st[k].seen < 4) return -1;
    return st[k].hits / st[k].seen;
  };

  const rLow = hitRate(currentBranch.name, currentSkill.name, 2);
  const rMid = hitRate(currentBranch.name, currentSkill.name, 3);
  const rHigh = hitRate(currentBranch.name, currentSkill.name, 4);

  let wLow = 0.4, wMid = 0.4, wHigh = 0.2;
  if (rLow >= 0 && rLow < 0.6) wLow += 0.1;
  if (rMid >= 0 && rMid < 0.6) wMid += 0.1;
  if (rHigh >= 0 && rHigh > 0.8) {
    wHigh = Math.min(wHigh + 0.1, 0.4);
    wLow = Math.max(wLow - 0.05, 0.2);
  }

  const total = wLow + wMid + wHigh;
  wLow /= total; wMid /= total; wHigh /= total;

  let base = up
    ? [...take(high, Math.ceil(N * wHigh)), ...take(mid, Math.ceil(N * wMid)), ...take(low, Math.ceil(N * wLow))]
    : [...take(low, Math.ceil(N * wLow)), ...take(mid, Math.ceil(N * wMid)), ...take(high, Math.ceil(N * wHigh))];

  // --------- Laguna local (otras skills) ---------
  const records = await db.getAll('progress');
  const map = Object.fromEntries(records.map(r => [r.skillId, r]));
  const today = Date.now();
  const lagPool = [];

  DATA.branches.forEach(b => {
    b.skills.forEach(s => {
      if (b.name === currentBranch.name && s.name === currentSkill.name) return;
      const rec = map[`${b.name}|${s.name}`];
      if (!rec) return;

      const days = (today - rec.last) / DAY_MS;

      if ((rec.state === 'Mastered' || rec.state === 'Proficient') && days / rec.interval >= 0.5) {
        const qs = s.questions;
        if (qs.length) {
          const q = qs[Math.floor(Math.random() * qs.length)];
          lagPool.push(q);
        }
      }
    });
  });

  const lagN = Math.min(Math.round(base.length * 0.15) || 1, lagPool.length);
  base = [...base, ...take(lagPool, lagN)];

  return base.sort(() => 0.5 - Math.random());
}

// ───────────────────────────────── Pintar pregunta
async function loadQuestion () {
  updateDots(qIdx);
  const q = queue[qIdx];
  await renderRich($('qText'), q.question);

  // opciones
  const form = $('optionsForm');
  form.innerHTML = '';
  q.options.forEach(async (opt, i) => {
    const id = `opt${i}`;
    form.insertAdjacentHTML('beforeend', `
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="radio" name="answer" value="${i}" class="text-indigo-600">
        <span id="${id}"></span>
      </label>
    `);
    await renderRich(document.getElementById(id), opt.text);
  });

  // Reset controles
  firstTry    = true;
  hintPointer = 0;
  hide($('hintsBox'), $('explanationBox'), $('btnNext'));
  hide($('relatedBox'));        //  justo después de resetear hints/exp.
  show($('btnCheck'), $('btnSkip'));
}

// ───────────────────────────────── Botones
$('btnCheck').onclick = checkAnswer;
$('btnSkip' ).onclick = () => handleResult(false, true);
$('btnNext' ).onclick = nextQuestion;
$('backBranches').onclick = renderBranches;
$('backSkills').onclick   = () => openBranch(currentBranch);

function checkAnswer (e) {
  e.preventDefault();
  const sel = $('optionsForm').querySelector('input[name="answer"]:checked');
  if (!sel) { toast('Selecciona una opción', false); return; }

  const q     = queue[qIdx];
  const ok    = q.options[+sel.value].correct;

  if (ok) {
    /* ─── acierto ─────────────────────── */
    const goodFirst = firstTry;
    if(!previewMode) updateState(goodFirst);/* ← sólo si no preview */
    toast(goodFirst ? '✅ ¡Correcto!' : 'Correcto (tarde)', true);
    showHintsAndExplanation();              // acceso directo
    nextReady(true);
  } else {
    /* ─── fallo ───────────────────────── */
    if(!previewMode) updateState(false);    // ← sólo si no preview
    toast('❌ Incorrecto', false);
    if (firstTry) firstTry = false;
    revealHintOrExplain();
  }
}

// Skip cuenta como incorrecto directo
function handleResult (correct, skip = false) {
  if(!previewMode) updateState(correct && firstTry);
  nextReady(correct);
  if (skip) {
    showHintsAndExplanation(true);    // mostrar todo
  }
}

function nextReady () {
  hide($('btnCheck'), $('btnSkip')); show($('btnNext'));
}

function nextQuestion () {
  if (++qIdx < queue.length) {
    updateDots(qIdx);
    loadQuestion();
  } else {
    buildSkillSummary();          // NUEVO
  }
}

async function buildSkillSummary () {
  summaryBody.innerHTML = '';

  const rec   = await db.get('progress', `${currentBranch.name}|${currentSkill.name}`);
  const afterIdx  = STATES.indexOf(rec?.state || 'Not started');
  const beforeIdx = STATES.indexOf(baselineState);
  const diff      = afterIdx - beforeIdx;
  const before    = STATES[beforeIdx];
  const after     = STATES[afterIdx];

  summaryBody.innerHTML = `
    <tr>
      <td>${currentBranch.name} › <b>${currentSkill.name}</b></td>
      <td class="text-center ${diff>0?'summary-up':diff<0?'summary-down':'summary-same'}">
        ${diff>0?'⬆':diff<0?'⬇':'→'}
        <span class="text-xs block">${before} → ${after}</span>
      </td>
    </tr>`;

  hide(quizView); show(summaryView);
}

summaryClose.onclick = () => { hide(summaryView); show(skillView); };
function getRelated(branchName, skillName) {
  const b = BIBLIO.branches.find(x => x.name === branchName);
  const s = b?.skills.find(x => x.name === skillName);
  return s ? { fragment: s.content.slice(0, 220) + '…', full: s } : null;
}
function showRelated() {
  const rel = getRelated(currentBranch.name, currentSkill.name);
  if (!rel) return;
  $('relatedContent').innerHTML = rel.fragment;
  $('relatedLink').href =
    `biblio.html?branch=${encodeURIComponent(currentBranch.name)}&skill=${encodeURIComponent(currentSkill.name)}`;
  show($('relatedBox'));
}
// -------------------------------------------------- pistas / explicación
function revealHintOrExplain () {
  const q      = queue[qIdx];
  const hints  = q.hints || [];

  if (hintPointer < hints.length) {
    $('hintsList').insertAdjacentHTML('beforeend',
      `<li>${hints[hintPointer++]}</li>`);
    show($('hintsBox'));
  } else {
    showExplanation(q);
    nextReady(false);
  }
}
async function showExplanation (q) {
  await renderRich($('explanationText'), q.explanation || '');
  show($('explanationBox'));
  showRelated(); 
}
function showHintsAndExplanation (allHints = false) {
  const q = queue[qIdx];
  if (allHints) {
    $('hintsList').innerHTML = q.hints.map(h => `<li>${h}</li>`).join('');
    show($('hintsBox'));
  }
  showExplanation(q);
}

// ───────────────────────────────── Gestión de progreso
async function getState (branchName, skillName) {
  const rec = await db.get('progress', `${branchName}|${skillName}`);
  return rec?.state || 'Not started';
}
async function getStateObj () {
  return await db.get('progress', `${currentBranch.name}|${currentSkill.name}`);
}

/* ---------------------------------------------------------------
   Guarda progreso (práctica habilidad) + “Reaprendizaje”
-----------------------------------------------------------------*/
async function updateState (firstTryCorrect) {
  const sev = (JSON.parse(localStorage.getItem('userCfg')||'{}').severity)||2;
  const key = `${currentBranch.name}|${currentSkill.name}`;
  let rec   = await db.get('progress', key) ?? {
        skillId:key,state:'Not started',interval:1,efactor:2.5,
        streak:0,last:0,consecutiveFails:0
      };

  const poolN = currentSkill.questions.length;
  const { up, down, minInt } = thresholds(poolN);   // ← NUEVO

  /* ───── Reaprendizaje: contador de fallos ───── */
  if (firstTryCorrect) {
    rec.streak++;
    if (rec.streak >= up) {              // ← usa umbral dinámico
      idx = Math.min(idx + 1, 4);
      rec.streak = 0;
    }
  } else {
    rec.streak = 0;
    idx = Math.max(idx - down, 1);       // ← bajada flexible
  }

  const keyStats = `${key}|diff${q.difficulty}`;
  const st = JSON.parse(localStorage.getItem('stats')||'{}');
  const o  = st[keyStats] || { seen:0, hits:0 };
  o.seen++; if (firstTryCorrect) o.hits++;
  st[keyStats] = o;
  localStorage.setItem('stats', JSON.stringify(st));

  /* ───── Ajuste de estado ───── */
  let idx = STATES.indexOf(rec.state);

  if (firstTryCorrect) {
    rec.streak++;
    if (rec.streak >= 3) { idx=Math.min(idx+1,4); rec.streak=0; }
  } else {
    rec.streak = 0;

    if (rec.state === 'Mastered' && rec.consecutiveFails >= 2) {
      idx  = STATES.indexOf('Familiar');
      toast('⚠️ Volvamos a repasar esto', false);
    } else {
      idx = Math.max(idx - sev, 1);
    }
  }

  if (idx === 0) idx = 1;                // nunca volver a Not started
  rec.state = STATES[idx];

  /* ───── SM-2 light ───── */
  const q = firstTryCorrect ? 5 : 2;
  rec.efactor = Math.max(1.3, rec.efactor+(0.1-(5-q)*(0.08+(5-q)*0.02)));
  rec.interval = firstTryCorrect
        ? (idx<=1?1: idx===2?3: idx===3?7: Math.round(rec.interval*rec.efactor))
        : 1;

  rec.last = Date.now();
  rec.reviewCount = (rec.reviewCount||0) + 1;
  rec.repetitions = (rec.repetitions||0) + 1;
  if (rec.repetitions === 1) toast('💡 Se habilitan 3 repeticiones rápidas para asentar la habilidad');
  const warmReq = warmUpNeed(rec.state, poolN);
  if (warmReq && rec.repetitions < warmReq){
  rec.interval = minInt;
  }
  await db.put('progress', rec);
  registerReview();
  await checkAchievements();
}
window.addEventListener('skill-updated', e => {
  const id = e.detail.skillId;
  updateUI(id); // tu función de refresco parcial
});
