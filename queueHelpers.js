/* -----------------------------------------------------------
   buildMicroQueue()  – compartido por index.js y assistant.js
----------------------------------------------------------- */
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';
import { thresholds, warmUpNeed, dayCount } from './poolHelpers.js';

const WARMUP_REPS = 3;          //  ← AÑADIDO
const WARMUP_INT  = 0.02;       //  ← opcional / coherencia

const STATES = ['Not started','Attempted','Familiar','Proficient','Mastered'];
const DAY_MS = 86_400_000;
const DB_VER = 2;
const db = await openDB('skills-trainer', DB_VER, {
  upgrade (db) {
    if (!db.objectStoreNames.contains('progress')) {
      db.createObjectStore('progress', { keyPath: 'skillId' });
    }
  }
});

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

export async function buildMicroQueue () {
  const db      = await dbP;
  const DATA_Q  = await (await fetch('./assets/questions.json')).json();
  const cfg     = JSON.parse(localStorage.getItem('userCfg')||'{}');
  const LIMIT   = cfg.microLen || 6;
  const now     = Date.now();

  const recs = await db.getAll('progress');
  const map  = Object.fromEntries(recs.map(r=>[r.skillId,r]));

  const lagoon=[], due=[], soon=[];
  const push=(arr,obj,rec,days)=>{
    const over  = rec.interval ? days/rec.interval : 4;
    const score = 5*Math.min(over,3)+(obj.q?.difficulty??3);
    arr.push({...obj,score});
  };

  DATA_Q.branches.forEach(b=>{
    b.skills.forEach(s=>{
      const rec  = map[`${b.name}|${s.name}`] ?? {state:'Not started',interval:1,last:0};
      const days = (now-rec.last)/DAY_MS;

      s.questions.forEach(q=>{
        if ((rec.state==='Mastered'||rec.state==='Proficient') && days/rec.interval>=.5 && !isDue(rec))
          push(lagoon,{branch:b,skill:s,q,origin:'lagoon'},rec,days);
        else if (isDue(rec))
          push(due,{branch:b,skill:s,q},rec,days);
        else if (days/rec.interval>=.7)
          push(soon,{branch:b,skill:s,q},rec,days);
      });
    });
  });

  const pick=(a,n)=>a.sort((x,y)=>y.score-x.score).slice(0,n);
  let list=[...pick(lagoon,LIMIT)];
  if(list.length<LIMIT) list=[...list,...pick(due ,LIMIT-list.length)];
  if(list.length<LIMIT) list=[...list,...pick(soon,LIMIT-list.length)];
  return list.slice(0,LIMIT).sort(()=>Math.random()-.5);
}
