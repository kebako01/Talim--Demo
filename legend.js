/* legend.js  – muestra la explicación de los 5 estados */
const STATES = [
  ['Not started' , 'Sin iniciar'  ],
  ['Attempted'   , 'Intentado'    ],
  ['Familiar'    , 'Familiar'     ],
  ['Proficient'  , 'Competente'   ],
  ['Mastered'    , 'Dominada'     ]
];

export function injectLegend(where='#legendStates'){
  const box = document.querySelector(where);
  if (!box) return;
  box.innerHTML = STATES.map(([s,label])=>`
      <div class="flex items-center gap-2">
         <img src="./assets/${ICON[s]}.png" class="w-6 h-6 select-none" alt="${s}">
         <span>${label}</span>
      </div>`).join('');
}
document.addEventListener('DOMContentLoaded',()=>injectLegend());
