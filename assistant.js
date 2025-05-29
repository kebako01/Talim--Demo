/******************************************************************
 *  Asistente flotante – recomienda la siguiente mejor acción
 *****************************************************************/
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';
import { buildMicroQueue } from './queueHelpers.js';
const db   = await openDB('skills-trainer',1);
const DAY  = 86_400_000;
const STATES=['Not started','Attempted','Familiar','Proficient','Mastered'];
/* ---------- asegurar símbolo robot ---------- */
if (!document.getElementById('heroicons-outline-robot')){
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.style.display='none';
  svg.innerHTML = `
    <symbol id="heroicons-outline-robot" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round"
            d="M9 2h6m-3 3v2m-6 4h12a2 2 0 012 2v7a2 2 0 01-2 2H6
               a2 2 0 01-2-2v-7a2 2 0 012-2zm10 0v-2a4 4 0 10-8 0v2"/>
      <circle cx="9"  cy="13" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
    </symbol>`;
  document.body.prepend(svg);
}
/* ---------- UI ------------------------------------------------- */
const btn = document.createElement('button');
btn.id='assistBtn';
btn.className=`fixed bottom-5 right-5 w-14 h-14 rounded-full
               bg-indigo-600 text-white shadow-lg flex items-center
               justify-center hover:scale-110 active:scale-95 transition`;
btn.innerHTML='<svg class="w-8 h-8"><use href="#heroicons-outline-robot"/></svg>';
document.body.appendChild(btn);

const bubble=document.createElement('div');
bubble.id='assistBubble';
bubble.className=`fixed bottom-24 right-5 max-w-xs p-4 rounded-xl shadow-lg
                  bg-white border border-slate-200 text-sm hidden`;
bubble.innerHTML='<p id="assistMsg" class="mb-3"></p><button id="assistAct" class="text-indigo-600 font-medium"></button>';
document.body.appendChild(bubble);

btn.onclick=async()=>{ await refreshSuggestion(); bubble.classList.toggle('hidden'); };

/* ---------- motores de decisión -------------------------------- */
async function refreshSuggestion(){
  const msgEl=$('assistMsg'), actEl=$('assistAct');
  const { action, msg, label } = await decide();
  msgEl.textContent = msg;
  if (action){
    actEl.textContent = label;
    actEl.onclick = ()=>{ bubble.classList.add('hidden'); action(); };
    actEl.classList.remove('hidden');
  } else actEl.classList.add('hidden');
}
async function nextStarred () {
  const DATA = await (await fetch('./assets/biblio.json')).json();
  const recs = await db.getAll('progress');
  const map  = Object.fromEntries(recs.map(r=>[r.skillId,r]));

  for (const b of DATA.branches){
    for (const s of b.skills){
      const rec = map[`${b.name}|${s.name}`];
      const due = isDue(rec);
      const low = !rec || STATES.indexOf(rec.state)<STATES.indexOf('Familiar');
      if (due || (!rec && low))                 // mismas reglas que estrella
        return { branch:b, skill:s };
    }
  }
  return null;
}
function isDue (rec){                          // misma lógica global
  if (!rec) return true;
  if (STATES.indexOf(rec.state)<=1 && (rec.repetitions||0)<3) return true;
  return Date.now() >= rec.last + rec.interval*DAY;
}
/* ---------- lógica principal ----------------------------------- */
async function decide(){
  /* 1. ¿hay repasos vencidos? → diagnostico */
  const recs = await db.getAll('progress');
  const due  = recs.filter(r=>Date.now()-r.last > r.interval*DAY).length;
  if (due){
    return { msg:`Tienes ${due} repasos pendientes. ¡Hora del diagnóstico!`,
             label:'Iniciar diagnóstico',
             action:()=>location.href='index.html#autoDiag' };
  }

  /* 2. ¿Laguna micro-sesión disponible? */
 const micro = await buildMicroQueue();
  if (micro.length){
    return { msg:'Sesión express lista para mantener tu memoria fresca.',
             label:'Lanzar micro-sesión',
             action:()=>location.href='index.html#autoMicro' };
  }

  /* 3. Recomendación de lectura/práctica */
  const DATA = await (await fetch('./assets/biblio.json')).json();
  for (const b of DATA.branches){
    for (const s of b.skills){
      const rec = recs.find(r=>r.skillId===`${b.name}|${s.name}`);
      const idx = STATES.indexOf(rec?.state||'Not started');
      const overdue = !rec || Date.now()-rec.last > rec.interval*DAY;
      if (idx<2 || overdue){
        return { msg:`¿Qué tal aprender “${s.name}” (${b.name}) ahora?`,
                 label:'Ir a biblioteca',
                 action:()=>location.href=`biblio.html?branch=${encodeURIComponent(b.name)}&skill=${encodeURIComponent(s.name)}` };
      }
    }
  }
  /* 2.5  ¿Alguna habilidad destacada disponible? --------------- */
   const star = await nextStarred();
    if (star){
    return {
        msg  : `Practica “${star.skill.name}” de ${star.branch.name}.`,
        label: 'Ir a la habilidad',
        action:()=>location.href=
        `skill.html?branch=${encodeURIComponent(star.branch.name)}&skill=${encodeURIComponent(star.skill.name)}`
    };
   }
  /* 4. Nada urgente */
  return { msg:'¡Todo en orden! Sigue así 💪', label:null };
}

/* ---------- helper DOM ---------- */
function $(id){return document.getElementById(id);}
window.addEventListener('skill-updated', e => {
  const id = e.detail.skillId;
  updateUI(id); // tu función de refresco parcial
});
