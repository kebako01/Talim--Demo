/******************************************************************
 *  Diagnóstico global
 *  – Selecciona preguntas de TODAS las habilidades
 *  – Prioriza por:  1) bajo estado   2) revisión vencida/cercana
 *    y  3) dificultad graduada
 *  – Usa la misma IndexedDB que skills.js   (idb v7 +esm)
 *****************************************************************/
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';
import { checkAchievements, registerReview } from './gamification.js';
import { thresholds, warmUpNeed, dayCount } from './poolHelpers.js';
import { buildMicroQueue } from './queueHelpers.js';
import { renderRich } from './richRender.js';

const STATES = ['Not started','Attempted','Familiar','Proficient','Mastered'];
const WARMUP_REPS = 3;         // nº de aciertos/iteraciones en “calentamiento”
const WARMUP_INT  = 0.02;      // intervalo corto (≈ 0,02 días ≃ 29 min)
const DAY_MS = 86_400_000;
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
const DB_VER = 2;
const db = await openDB('skills-trainer', DB_VER, {
  upgrade (db) {                           // se llama SOLO si la BD aún no existe
    if (!db.objectStoreNames.contains('progress')) {
      db.createObjectStore('progress', { keyPath: 'skillId' });
    }
  }
});

/*  UI helpers */
const $  = id => document.getElementById(id);
const show = (...els) => els.forEach(e=>e.classList.remove('hidden'));
const hide = (...els) => els.forEach(e=>e.classList.add   ('hidden'));
function toast (msg, ok=true) {
  Toastify({ text:msg, duration:2000, gravity:'top', position:'center',
             className: ok?'bg-emerald-600':'bg-rose-600'}).showToast();
}

/*  Elementos  */
const homeArea = $('homeArea');   // ← NUEVO contenedor global
const homeView = $('homeView');   // (card de diagnóstico, se sigue usando)
const quizView = $('quizView');
const diagTitle = $('diagTitle');
const qText   = $('qText');
const options = $('optionsForm');
const btnDone   = $('btnDoneRead'); 

const summaryView  = $('summaryView');
const summaryBody  = $('summaryBody');
const summaryClose = $('summaryClose');

const cfg = JSON.parse(localStorage.getItem('userCfg')||'{}');
const diagMax = cfg.diagMax || 30;



let baseline = {};        // estado al empezar {skillId: idx}

/*  Datos runtime */
let DATA_Q, DATA_B            // JSON preguntas
let queue = [];              // [{branch, skill, q}]
let qPtr  = 0;
let firstTry = true;
let hintIdx  = 0;
let currentItem;


/* ---------------- Panel de progreso (Home) ------------------- */
async function updateHomeStats(){
  const recs = await db.getAll('progress');
  const totalSkills = DATA_B.branches.reduce((a,b)=>a+b.skills.length,0);

  const mastered = recs.filter(r=>r.state==='Mastered').length;
  const due      = recs.filter(isDue).length;

  $('homeMastered').textContent = mastered;
  $('homeDue').textContent      = due;

  const pctM = totalSkills ? mastered/totalSkills*100 : 0;
  const pctD = totalSkills ? due     /totalSkills*100 : 0;
  $('homeMasteredBar').style.width = `${pctM}%`;
  $('homeDueBar').style.width      = `${pctD}%`;
}

/*  Carga inicial */
await loadData();
$('startDiag').onclick = startDiagnostic;
$('startMicro').onclick = startMicro;          /* NUEVO */
$('btnCheck').onclick  = onCheck;
$('btnSkip' ).onclick  = () => handleResult(false,true);
$('btnNext' ).onclick  = nextQuestion;
btnDone      .onclick  = () => {             // NUEVO
  updateProgress(true);                      //  cuenta como correcto
  nextQuestion();
};
await loadData();
await updateHomeStats();        // ← NUEVO

async function loadData () {
  DATA_Q = await (await fetch('./assets/questions.json')).json();
  DATA_B = await (await fetch('./assets/biblio.json'  )).json();
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
/*  Iniciar diagnóstico */
async function startDiagnostic () {
  queue = await buildQueue();
  if (!queue.length) { toast('No hay nada que repasar 👍'); return; }

  baseline = {};
  for (const item of queue){
    const id = `${item.branch.name}|${item.skill.name}`;
    if (!(id in baseline)){
      const rec = await db.get('progress', id);
      baseline[id] = STATES.indexOf(rec?.state || 'Not started');
    }
  }

  qPtr = 0;
  buildDots(queue.length);
  loadQuestion();
  hide(homeArea); show(quizView);
}
/* ---------------------------------------------------------------
   Micro-sesión (3-5 min) centrada en “Laguna de Memoria”
   – 1º laguna                            (≥ 50 % del intervalo)
   – luego críticos / soon para rellenar
   – Tamaño fijo: 6 ítems  (se puede cambiar en cfg.microLen)
-----------------------------------------------------------------*/

/* ---------- iniciar Micro-sesión ---------- */
async function startMicro () {
  queue = await buildMicroQueue();
  if (!queue.length){ toast('No hay material para micro-sesión 👍'); return; }

  /* ─── baseline para resumen ─── */
  baseline = {};
  for (const item of queue){
    const id = `${item.branch.name}|${item.skill.name}`;
    if (!(id in baseline)){
      const rec = await db.get('progress', id);
      baseline[id] = STATES.indexOf(rec?.state || 'Not started');
    }
  }

  qPtr = 0;
  buildDots(queue.length);
  loadQuestion();
  hide(homeArea); show(quizView);
}
/* ---------------------------------------------------------------
   buildQueue()  ·  Límite Adaptativo + “Laguna de Memoria”
   60 % críticos · 15 % laguna · 15 % soon · 10 % nuevo
   (si falta de alguna categoría se rellena por prioridad soon → laguna → nuevo)
-----------------------------------------------------------------*/
async function buildQueue () {
  const cfg   = JSON.parse(localStorage.getItem('userCfg')||'{}');
  const LIMIT = cfg.dailyLimit || cfg.diagMax || 30;
  const now   = Date.now();

  const recs  = await db.getAll('progress');
  const map   = Object.fromEntries(recs.map(r=>[r.skillId,r]));

  const due=[], lagoon=[], soon=[], newbie=[];
  const push = (arr,obj,rec,days)=>{
    const sIdx  = STATES.indexOf(rec.state);
    const over  = rec.interval ? days/rec.interval : 4;
    const diffW = obj.q?.difficulty ?? 3;
    const score = 4*(4-sIdx) + 5*Math.min(over,3) + diffW;
    arr.push({...obj,score});
  };

  DATA_Q.branches.forEach(b=>{
    b.skills.forEach(s=>{
      const rec  = map[`${b.name}|${s.name}`] ??
                  {state:'Not started',interval:1,last:0};
      const days = (now-rec.last)/DAY_MS;

      s.questions.forEach(q=>{
        if (isDue(rec))                                // 1) críticos
          push(due,{branch:b,skill:s,q},rec,days);
        else if ((rec.state==='Mastered'||rec.state==='Proficient')
                 && days/rec.interval>=.5)             // 2) laguna
          push(lagoon,{branch:b,skill:s,q,origin:'lagoon'},rec,days);
        else if (days/rec.interval>=.7)                // 3) soon
          push(soon,{branch:b,skill:s,q},rec,days);
        else if (rec.state==='Not started')            // 4) nuevo
          push(newbie,{branch:b,skill:s,q},rec,days);
      });
    });
  });

  /* ----- si NO hay críticos → devolver lista vacía para que
         startDiagnostic() muestre el toast y NO salte al resumen */
  if (due.length === 0) return [];
  const pick = (arr,n)=>arr.sort((a,b)=>b.score-a.score).slice(0,n);

  const tgtDue    = Math.round(LIMIT*0.60);
  const tgtLagoon = Math.round(LIMIT*0.15);
  const tgtSoon   = Math.round(LIMIT*0.15);
  const tgtNew    = LIMIT - tgtDue - tgtLagoon - tgtSoon;  // ≈10 %

  const listDue    = pick(due   , tgtDue);
  const listLagoon = pick(lagoon, tgtLagoon);
  const listSoon   = pick(soon  , tgtSoon);
  const listNew    = pick(newbie, tgtNew);

  /* ─── rellenar huecos ─── */
  let rem = LIMIT - (listDue.length+listLagoon.length+listSoon.length+listNew.length);
  if (rem>0){
    const extraSoon = pick(soon.filter(x=>!listSoon.includes(x)), rem);
    listSoon.push(...extraSoon); rem-=extraSoon.length;
  }
  if (rem>0){
    const extraLag = pick(lagoon.filter(x=>!listLagoon.includes(x)), rem);
    listLagoon.push(...extraLag); rem-=extraLag.length;
  }
  if (rem>0){
    const extraNew = pick(newbie.filter(x=>!listNew.includes(x)), rem);
    listNew.push(...extraNew);
  }

  const finalList = [...listDue, ...listLagoon, ...listSoon, ...listNew]
                    .sort(()=>Math.random()-0.5)
                    .slice(0,LIMIT);

  buildDots(finalList.length);
  return finalList;
}

/*  ──────────────────────────── pintado de pregunta */
async function loadQuestion() {  // Añadir async aquí
  updateDots(qPtr);
  const item = queue[qPtr];
  currentItem = item; 
  diagTitle.textContent = `${item.branch.name} › ${item.skill.name}`;

  /* ----- Pregunta tradicional ----- */
  if (item.type !== 'read') {
    const { q } = item;
    await renderRich(qText, q.question);
    options.innerHTML = '';
    for (const [i, opt] of q.options.entries()) {
      const id = `opt${i}`;
      options.insertAdjacentHTML('beforeend', `
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="answer" value="${i}" class="text-indigo-600">
          <span id="${id}"></span>
        </label>
      `);
      await renderRich(document.getElementById(id), opt.text);
    }

    show($('btnCheck'),$('btnSkip')); hide(btnDone);
  }
  /* ----- Lectura ----- */
  else {
    qText.textContent = 'Lee el siguiente concepto:';
    await renderRich($('explanationText'), item.skill.content);
    show($('explanationBox')); 

    options.innerHTML = '';
    hide($('btnCheck'),$('btnSkip')); show(btnDone);
  }

  // Resto del código...
  firstTry = true; hintIdx = 0;
  $('hintsList').innerHTML = '';
  hide($('hintsBox'),$('btnNext'));
  if (item.type !== 'read') hide($('explanationBox'));
  hide($('relatedBox'));
}
function getRelated(branchName, skillName) {
  const b = DATA_B.branches.find(x => x.name === branchName);
  const s = b?.skills.find(x => x.name === skillName);
  return s ? { fragment: s.content.slice(0, 220) + '…', full: s } : null;
}
function showRelated(branchName, skillName) {
  const rel = getRelated(branchName, skillName);
  if (!rel) return;
  $('relatedContent').innerHTML = rel.fragment;
  $('relatedLink').href =
      `biblio.html?branch=${encodeURIComponent(branchName)}&skill=${encodeURIComponent(skillName)}`;
  show($('relatedBox'));
  setTimeout(()=>$('relatedBox').scrollIntoView({behavior:'smooth'}),100);
}

/*  ──────────────────────────── corrección */
function onCheck (ev) {
  ev.preventDefault();
  const sel = options.querySelector('input[name="answer"]:checked');
  if (!sel) { toast('Selecciona una opción', false); return; }

  const { q } = queue[qPtr];
  const ok  = q.options[+sel.value].correct;

  updateProgress(ok && firstTry);

  // 🌊 Contar si viene de 'lagoon'
  const currentItem = queue[qPtr];
  if (currentItem.origin === 'lagoon') {
    const n = (+localStorage.getItem('lagoonQuestions') || 0) + 1;
    localStorage.setItem('lagoonQuestions', n);
  }

  if (ok) {
    toast(firstTry ? '✅ ¡Correcto!' : 'Correcto (tarde)', true);
    revealAll(false);
    toNext();
  } else {
    toast('❌ Incorrecto', false);
    firstTry = false;
    revealHintOrExplain();
  }
}


/*  Skip → incorrecto directo */
function handleResult (correct, skip=false) {
  updateProgress(false);
  if (currentItem.origin==='lagoon'){
    const n = (+localStorage.getItem('lagoonQuestions')||0) + 1;
    localStorage.setItem('lagoonQuestions', n);
  }
  revealAll(true);
  toNext();
}

function toNext () {
  hide($('btnCheck'),$('btnSkip'));
  show($('btnNext'));
}

/*  Hints / explicación */
function revealHintOrExplain () {
  const { q } = queue[qPtr];
  if (hintIdx < (q.hints?.length||0)) {
    $('hintsList').insertAdjacentHTML('beforeend',
      `<li>${q.hints[hintIdx++]}</li>`);
    show($('hintsBox'));
  } else {
    revealAll(false);
    toNext();
  }
}
async function revealAll (allHints=true) {
  const { q } = queue[qPtr];
  if (allHints) {
    $('hintsList').innerHTML = (q.hints||[])
      .map(h=>`<li>${h}</li>`).join('');
    show($('hintsBox'));
  }
  await renderRich($('explanationText'), q.explanation || '');
  show($('explanationBox'));
  showRelated(currentItem.branch.name, currentItem.skill.name);
}

/*  ──────────────────────────── avance de cola */
function nextQuestion () {
  if (++qPtr < queue.length) {
    updateDots(qPtr);
    loadQuestion();
  } else {
    buildSummary();                 // NUEVO
  }
}
async function buildSummary () {
  summaryBody.innerHTML = '';
  for (const key of Object.keys(baseline)){
    const rec = await db.get('progress', key);
    const afterIdx = STATES.indexOf(rec?.state || 'Not started');
    const beforeIdx= baseline[key];
    const diff = afterIdx - beforeIdx;
    const before = STATES[beforeIdx];
    const after  = STATES[afterIdx];

    const [branch, skill] = key.split('|');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${branch} › <b>${skill}</b></td>
      <td class="text-center ${diff>0?'summary-up':diff<0?'summary-down':'summary-same'}">
        ${diff>0?'⬆':diff<0?'⬇':'→'}
        <span class="text-xs block">${before} → ${after}</span>
      </td>`;
    summaryBody.appendChild(tr);
  }
  hide(quizView); show(summaryView);
}

summaryClose.onclick = () => { hide(summaryView); show(homeArea); };
/* ---------------------------------------------------------------
   Guarda progreso (diagnóstico) + Sistema “Reaprendizaje”
   – Sube 1 nivel tras 3 aciertos seguidos
   – Baja según severidad al errar/skip
   – Si el estado era «Mastered» y acumula 2 fallos seguidos ⇒
     vuelve a «Familiar» y avisa al usuario
-----------------------------------------------------------------*/
async function updateProgress (firstTryCorrect) {
  const sev  = (JSON.parse(localStorage.getItem('userCfg')||'{}').severity)||2;
  const key  = `${queue[qPtr].branch.name}|${queue[qPtr].skill.name}`;
  let rec    = await db.get('progress', key) ?? {
        skillId:key,state:'Not started',interval:1,efactor:2.5,
        streak:0,last:0,consecutiveFails:0
      };

  const poolN = queue[qPtr].skill.questions.length;
  const { up, down, minInt } = thresholds(poolN);

  /* ─── idx SE DECLARA AL PRINCIPIO ─── */
  let idx = STATES.indexOf(rec.state);

  /* 1. subida / bajada rápida según firstTryCorrect --------------- */
  if (firstTryCorrect) {
    rec.streak++;
    if (rec.streak >= up) {               // usa umbral dinámico
      idx = Math.min(idx + 1, 4);
      rec.streak = 0;
    }
  } else {
    rec.streak = 0;
    idx = Math.max(idx - down, 1);
  }

  /* estadísticas … (sin cambios) ---------------------------------- */
  const keyStats = `${key}|diff${q.difficulty}`;
  const st = JSON.parse(localStorage.getItem('stats')||'{}');
  const o  = st[keyStats] || { seen:0, hits:0 };
  o.seen++; if (firstTryCorrect) o.hits++;
  st[keyStats] = o;
  localStorage.setItem('stats', JSON.stringify(st));

  /* 2. Ajuste de estado general y spaced repetition ---------------- */
  rec.state = STATES[idx];

  const qScore = firstTryCorrect ? 5 : 2;            // renombrado para no chocar
  rec.efactor = Math.max(1.3,
      rec.efactor + (0.1 - (5 - qScore) * (0.08 + (5 - qScore) * 0.02)));

  rec.interval = firstTryCorrect
      ? (idx<=1?1: idx===2?3: idx===3?7: Math.round(rec.interval*rec.efactor))
      : 1;

  rec.repetitions = (rec.repetitions||0) + 1;
  if (rec.repetitions === 1)
    toast('💡 Se habilitan 3 repeticiones rápidas para asentar la habilidad');

  const warmReq = warmUpNeed(rec.state, poolN);
  if (warmReq && rec.repetitions < warmReq) rec.interval = minInt;

  rec.last = Date.now();
  rec.reviewCount = (rec.reviewCount||0) + 1;
  await db.put('progress', rec);
  registerReview({ lagoon: queue[qPtr].origin==='lagoon' });
  await checkAchievements();
}
if (location.hash==='#autoDiag')   { startDiagnostic(); location.hash=''; }
if (location.hash==='#autoMicro')  { startMicro();      location.hash=''; }
window.addEventListener('skill-updated', e => {
  const id = e.detail.skillId;
  updateUI(id); // tu función de refresco parcial
});
