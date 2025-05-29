/******************************************************************
 *  Sistema de Gamificación – lista completa y tool-tips dinámicos
 *****************************************************************/
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';
const DAY      = 86_400_000;
const DB_VER = 2;
const db = await openDB('skills-trainer', DB_VER, {
  upgrade (db) {                           // se llama SOLO si la BD aún no existe
    if (!db.objectStoreNames.contains('progress')) {
      db.createObjectStore('progress', { keyPath: 'skillId' });
    }
  }
});
const JSONPATH = 'assets/gamification.json';
const KEY_OK   = 'unlockedEvents';
let   UNLOCKED = JSON.parse(localStorage.getItem(KEY_OK)||'[]');

/* ---------- cargar definición de logros ---------- */
const EVENTS = (await (await fetch(JSONPATH)).json()).events;

/* ---------- métricas actuales ---------- */
async function metrics(){
  const recs = await db.getAll('progress');
  const stats = {
    streak_days : calcStreak(recs),
    mastered_skills : recs.filter(r=>r.state==='Mastered').length,
    total_reviews   : recs.reduce((s,r)=>s+(r.reviewCount||0),0),
    lagoon_questions: +localStorage.getItem('lagoonQuestions')||0
  };
  return stats;
}
function calcStreak(recs){
  const days = new Set(recs.map(r=>new Date(r.last).toISOString().slice(0,10)));
  let streak=0;
  for(let i=0;;i++){
    const iso=new Date(Date.now()-i*DAY).toISOString().slice(0,10);
    if(days.has(iso)) streak++; else break;
  }
  return streak;
}

/* ---------- tarjeta + tooltip --------------------------------- */
function makeTip(ev,stat){
  const c=ev.criteria;
  if(UNLOCKED.includes(ev.id)) return `${ev.name}\n${ev.description}`;
  if(c.streak_days)      return `Racha ${stat.streak_days}/${c.streak_days} días`;
  if(c.mastered_skills)  return `Skills dominadas ${stat.mastered_skills}/${c.mastered_skills}`;
  if(c.total_reviews)    return `Repasos ${stat.total_reviews}/${c.total_reviews}`;
  if(c.lagoon_questions) return `Laguna ${stat.lagoon_questions}/${c.lagoon_questions}`;
  return ev.description;
}
function renderEvent(ev,stat){
  const box=document.getElementById('eventContainer'); if(!box) return;
  const locked = !UNLOCKED.includes(ev.id);

  const card = document.createElement('div');
  card.className = `p-4 rounded-xl border shadow-sm text-center
                    flex flex-col items-center gap-3
                    ${locked?'bg-slate-100 opacity-60':''}`;
  card.title = makeTip(ev,stat);          // tooltip nativo
  card.innerHTML = `
      <img src="${ev.icon}"
           class="w-16 h-16 ${locked?'grayscale':''}" alt="">
      <h3 class="font-semibold text-sm">${ev.name}</h3>
      <p class="text-xs text-slate-600">${ev.description}</p>`;
  box.appendChild(card);
}

/* ---------- comprobar y desbloquear ---------------------------- */
export async function checkAchievements(){
  const stat = await metrics();
  for(const ev of EVENTS){
    if(UNLOCKED.includes(ev.id)){
      continue;
    }
    const c = ev.criteria;
    const ok =
      (c.streak_days      && stat.streak_days      >= c.streak_days)      ||
      (c.mastered_skills  && stat.mastered_skills  >= c.mastered_skills)  ||
      (c.total_reviews    && stat.total_reviews    >= c.total_reviews)    ||
      (c.lagoon_questions && stat.lagoon_questions >= c.lagoon_questions);
    if(ok){
      UNLOCKED.push(ev.id);
      localStorage.setItem(KEY_OK,JSON.stringify(UNLOCKED));
      Toastify({text:`🏆 ${ev.name} desbloqueado`,duration:2500,gravity:'top',
                className:'bg-amber-500'}).showToast();
    }
  }
  paintAll();                   // refrescar lista completa
}

/* ---------- paintAll: siempre muestra TODO --------------------- */
async function paintAll(){
  const stat=await metrics();
  const box=document.getElementById('eventContainer');if(!box) return;
  box.innerHTML='';                         // limpia
  EVENTS.forEach(ev=>renderEvent(ev,stat));
}

/* ---------- registrar revisión (llamado externamente) ---------- */
export function registerReview({lagoon=false}={}){
  /* lagoon_questions */
  if(lagoon){
    const n=(+localStorage.getItem('lagoonQuestions')||0)+1;
    localStorage.setItem('lagoonQuestions',n);
  }
  /* total_reviews */
  const recsCount = (+localStorage.getItem('totalReviews')||0)+1;
  localStorage.setItem('totalReviews',recsCount);
  checkAchievements();
}

/* ---------- inicializar y primer pintado ---------------------- */
async function initPaint () {
  await paintAll();                           // siempre dibuja todo
  /* escucha futuros desbloqueos */
  document.addEventListener('achievementUnlocked', e=>{
    UNLOCKED.push(e.detail.id);
    paintAll();
  });
}

/* ---------- elegir momento seguro ----------------------------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPaint);
} else {
  initPaint();                                // DOM ya está listo
}

/* ---------- API para mostrar progreso parcial ----------------- */
export async function nextProgress (limit=5){
  const stat = await metrics();
  /* calcula %  de cada reto NO desbloqueado */
  const arr = EVENTS.filter(e=>!UNLOCKED.includes(e.id)).map(ev=>{
    const c = ev.criteria;
    let pct=0;
    if (c.streak_days)
      pct = Math.min(1, stat.streak_days / c.streak_days);
    else if (c.mastered_skills)
      pct = Math.min(1, stat.mastered_skills / c.mastered_skills);
    else if (c.total_reviews)
      pct = Math.min(1, stat.total_reviews / c.total_reviews);
    else if (c.lagoon_questions)
      pct = Math.min(1, stat.lagoon_questions / c.lagoon_questions);
    return {...ev, pct};
  }).sort((a,b)=>b.pct-a.pct)      // más cercanos primero
    .slice(0,limit);
  return arr;
}