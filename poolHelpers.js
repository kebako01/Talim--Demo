// poolHelpers.js   (importa donde lo necesites)
export function thresholds (n) {
  /* n = nº de preguntas del pool */
  if (n <= 6)   return { up: 2, down: 1, minInt: 0.25 }; // 2 aciertos seg.
  if (n <= 12)  return { up: 3, down: 1, minInt: 0.50 }; // 12 h
  if (n <= 20)  return { up: 3, down: 2, minInt: 1   };
  return          { up: 4, down: 2, minInt: 1   };      // grandes
}
export function warmUpNeed (state, poolN){
  if (state === 'Not started' || state === 'Attempted'){
    return thresholds(poolN).up;      // 2-4 reps según tamaño
  }
  return 0;                           // nada para Familiar+
}
export const DAY_MS = 86_400_000;
export const dayCount = ts => Math.floor(ts / DAY_MS);  // zona-neutro