/******************************************************************
 *  Progreso en tiempo real
 *****************************************************************/
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';
const db  = await openDB('skills-trainer',1);
const DAY = 86_400_000;

/* ---------- helpers fecha ---------- */
const dayStamp = t => new Date(t).toISOString().slice(0,10);   // YYYY-MM-DD
const todayMid = () => {
  const d=new Date(); d.setHours(0,0,0,0); return d.getTime();
};

/* ---------- 1.  Streak ------------------------------------------------ */
const recs   = await db.getAll('progress');
/* ---------- datos globales ---------- */
const DATA_B = await (await fetch('./assets/biblio.json')).json();
const totalSkills = DATA_B.branches.reduce((a,b)=>a+b.skills.length,0);

const active     = recs.length;                                   // con progreso
const mastered   = recs.filter(r=>r.state==='Mastered').length;
const dueCount   = recs.filter(r=>Date.now()-r.last > r.interval*DAY).length;

/* ---------- pintar tarjeta Resumen --------------------------- */
document.getElementById('progActive'  ).textContent = active;
document.getElementById('progMastered').textContent = mastered;
document.getElementById('progDue'     ).textContent = dueCount;

/*  porcentajes para las barras  */
const pctM = totalSkills ? mastered / totalSkills * 100 : 0;
const pctD = totalSkills ? dueCount / totalSkills * 100 : 0;
document.getElementById('progMasteredBar').style.width = `${pctM}%`;
document.getElementById('progDueBar'     ).style.width = `${pctD}%`;
const days   = new Set(recs.map(r=>dayStamp(r.last)));
let streak   = 0;
for(let off=0;;off++){
  const d = dayStamp(todayMid()-off*DAY);
  if(days.has(d)) streak++; else break;
}
document.getElementById('streakTxt').textContent = `${streak} 🔥`;

/* ---------- 2.  Habilidades en riesgo -------------------------------- */
const STATES = ['Not started','Attempted','Familiar','Proficient','Mastered'];
const riskUL = document.getElementById('riskList');

const isDue = r =>
  !r ||                        // nunca vista
  (STATES.indexOf(r.state)<=1 && (r.repetitions||0)<3) ||     // warm-up
  Date.now() >= r.last + r.interval*DAY;                      // RE clásico

recs.filter(r=>{
  const overdue = isDue(r);
  const weak    = STATES.indexOf(r.state) < STATES.indexOf('Familiar');
  return overdue || weak;
}).forEach(r=>{
  const [branch,skill] = r.skillId.split('|');
  const overdue  = isDue(r);
  const tag = overdue ? 'Vencida' : 'Débil';
  const li  = document.createElement('li');

  li.innerHTML = `
     <a href="skill.html?branch=${encodeURIComponent(branch)}&skill=${encodeURIComponent(skill)}"
        class="flex justify-between items-center p-3 rounded
               hover:bg-slate-50 transition">
        <span>${branch} › <b>${skill}</b></span>
        <span class="text-xs px-2 py-0.5 rounded
              ${overdue?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'}">
          ${tag}
        </span>
     </a>`;
  riskUL.appendChild(li);
});

if(!riskUL.children.length){
  riskUL.innerHTML = '<li>Todas al día 🎉</li>';
}

/* ---------- 3.  Tendencia de mejora (Chart.js) ------------------------ */
const last30 = Array.from({length:30},(_,i)=>dayStamp(todayMid()-i*DAY)).reverse();
const dataMap= Object.fromEntries(last30.map(d=>[d,0]));
recs.forEach(r=>{
  const d = dayStamp(r.last);
  if(d in dataMap) dataMap[d]++;
});
const ctx = document.getElementById('trendChart');
new Chart(ctx,{
  type:'line',
  data:{
    labels:last30.map(d=>d.slice(5)),          // MM-DD
    datasets:[{label:'Items revisados',
               data:last30.map(d=>dataMap[d]),
               tension:.3, borderColor:'#4f46e5', fill:true,
               backgroundColor:'rgba(79,70,229,.15)'}]
  },
  options:{responsive:true,plugins:{legend:{display:false}}}
});
window.addEventListener('skill-updated', e => {
  const id = e.detail.skillId;
  updateUI(id); // tu función de refresco parcial
});
window.addEventListener('skill-updated',()=>location.reload());
