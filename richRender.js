/* ---------- esperar a que MathJax cargue -------------------- */
async function waitForMJ () {
  if (window.MathJax?.typesetPromise) return;
  await new Promise(res=>{
    const id=setInterval(()=>{
      if (window.MathJax?.typesetPromise){clearInterval(id); res();}
    },40);
  });
}

/* ---------- función de protección LaTeX -------------------- */
function protectMath (src){
  const stash = [];
  const out = src.replace(
    /(\\\(.+?\\\)|\\\[[\s\S]+?\\\]|\\begin\{[\s\S]+?\\end\{[a-z*]+\}|[$]{1,2}[\s\S]+?[$]{1,2})/g,
    m => `@@MATH${stash.push(m)-1}@@`
  );
  return { text: out, stash };
}

/* ---------- render principal -------------------------------- */
export async function renderRich (el, raw){
  /* 1. Proteger LaTeX → tokens */
  const { text, stash } = protectMath(raw);

  /* 2. Markdown → HTML */
  let html = marked.parse(text);

  /* 3. Volver a insertar LaTeX */
  html = html.replace(/@@MATH(\d+)@@/g, (_,i)=>stash[+i]);

  /* 4. Nota personalizada <note> */
  html = html.replace(/<note>([\s\S]+?)<\/note>/gi,
                      '<span class="note">$1</span>');

  /* 5. Insertar en el nodo */
  el.innerHTML = html;

  /* 6. Resaltado de código (bloques + inline) */
  el.querySelectorAll('code').forEach(code=>{
    if (code.parentElement.tagName.toLowerCase()==='pre')
         hljs.highlightElement(code);                // bloque
    else code.innerHTML = hljs.highlightAuto(code.textContent).value; // inline
  });

  /* 7. MathJax */
  await waitForMJ();
  await MathJax.typesetPromise([el]);
}
