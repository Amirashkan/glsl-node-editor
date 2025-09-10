


// === Bootstrap: ensure global getGraph() and rebuild() exist ===



import { initWebGPU, updateShader, drawFrame, clearOnce, smokeTest } from './gpu/gpuRenderer.js';
import { buildWGSL } from './codegen/glslBuilder.js';
import { Graph, Editor, makeNode, NodeDefs } from './core/Editor.js';
if (window.__mainLoaded) throw new Error('main.js loaded twice');
window.__mainLoaded = true;

// src/main.js (fixed)
// Safe WebGPU bootstrap + shader apply helpers to avoid race conditions.
// Assumes gpuRenderer exports: initWebGPU(canvas), setShaderSource(wgsl), render()


// ------- DOM helpers -------
function findCanvas() {
  // Prefer an explicit id if your HTML uses one; otherwise fallback to first <canvas>
  return (
    document.getElementById("webgpu-canvas") ||
    document.getElementById("canvas") ||
    document.querySelector("canvas")
  );
}

// ------- Init (once) -------
let __initPromise = null;
let __deviceReady = false;

export async function ensureInit() {
  if (__deviceReady) return;
  if (!__initPromise) {
    const canvas = findCanvas();
    if (!canvas) {
      throw new Error("No <canvas> element found. Give your canvas id='webgpu-canvas' or 'canvas'.");
    }
    __initPromise = initWebGPU(canvas).then((dev) => {
      __deviceReady = !!dev;
      if (!__deviceReady) throw new Error("WebGPU init failed (navigator.gpu unavailable?)");
    });
  }
  return __initPromise;
}

// ------- Shader apply helper -------
export async function trySetShader(wgsl) {
  // Make sure device/context are ready
  await ensureInit();
  try {
    const ok = await setShaderSource(String(wgsl || ""));
    if (!ok) {
      // setShaderSource returns false if it fell back; we still keep rendering
      console.warn("Shader had errors; fallback pipeline is active until source changes.");
    }
  } catch (err) {
    console.warn("setShaderSource threw; keeping previous/fallback pipeline.", err);
  }
}

// ------- Rebuild flow (debounced externally) -------
let __lastSource = "";
let __rebuildStamp = 0;

export async function doRebuild(source) {
  __rebuildStamp++;
  const stamp = __rebuildStamp;
  await ensureInit();
  if (typeof source !== "string") source = String(source || "");
  __lastSource = source;
  await trySetShader(source);
  // Ignore late completions from older calls
  if (stamp !== __rebuildStamp) return;
  // Trigger a render once; continuous render loop handles the rest.
  render();
}

// ------- Live sync (optional) -------
let __syncRequested = false;
let __sourceProvider = null; // function that returns current WGSL string (e.g., from editor)

export function setSourceProvider(fn) {
  __sourceProvider = typeof fn === "function" ? fn : null;
}

function __syncShaderNow() {
  if (!__sourceProvider) return;
  const src = __sourceProvider();
  if (src !== __lastSource) {
    doRebuild(src).catch((e) => console.error("syncShader error", e));
  }
}

function __syncShaderTick() {
  __syncShaderNow();
  requestAnimationFrame(__syncShaderTick);
}

// ------- Start app -------
export async function start() {
  await ensureInit();

  // Kick a lightweight RAF render loop. render() is cheap for a single fullscreen tri.
  function frame() {
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // If someone wired setSourceProvider, keep it in sync each frame.
  if (!__syncRequested) {
    __syncRequested = true;
    requestAnimationFrame(__syncShaderTick);
  }

  // Initial rebuild from any prefilled source (if a provider exists)
  if (__sourceProvider) {
    await doRebuild(__sourceProvider());
  }
}

// ------- Auto-start when DOM is ready if this script is included in a page -------
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      start().catch((e) => console.error(e));
    });
  } else {
    start().catch((e) => console.error(e));
  }
}

// Expose minimal API for older code paths that might call these names.
window.ensureInit = ensureInit;
window.trySetShader = trySetShader;
window.doRebuild = doRebuild;
window.start = start;
window.setSourceProvider = setSourceProvider;

(function(){
  if (typeof window.getGraph !== 'function') {
    window.getGraph = function(){
      try {
        if (typeof graph !== 'undefined' && graph && graph.nodes && graph.connections) return graph;
      } catch(_){}
      try {
        const ed = window.editor;
        if (ed && Array.isArray(ed.nodes) && Array.isArray(ed.connections)) {
          return { nodes: ed.nodes, connections: ed.connections };
        }
      } catch(_){}
      return { nodes: [], connections: [] };
    };
  }
  if (typeof window.rebuild !== 'function') {
    window.rebuild = function(){
      try {
        const g = window.getGraph();
        if (typeof buildWGSL === 'function' && typeof updateShader === 'function') {
          const wgsl = buildWGSL(g);
          window.__last_wgsl = wgsl;
          trySetShader(wgsl);
        }
        if (typeof computePreviews === 'function') {
          try { computePreviews(g); } catch(_){}
        }
        if (window.editor && typeof window.editor.draw === 'function') {
          try { window.editor.draw(); } catch(_){}
        }


// --- WebGPU init guard + shader setter --------------------------------------
let __inited = false;
async function ensureInit() {
  if (__inited) return;
  const canvas = document.getElementById('gfx') || document.querySelector('canvas');
  if (!canvas) { console.warn('No canvas with id="gfx" found.'); return; }
  const dev = await initWebGPU(canvas);
  __inited = !!dev;
}

async function trySetShader(wgsl) {
  try {
    await ensureInit();
    if (typeof setShaderSource === 'function') {
      await setShaderSource(wgsl);
    } else if (typeof updateShader === 'function') {
      // legacy path
      await trySetShader(wgsl);
    }
  } catch (e) {
    console.warn('setShaderSource/updateShader failed:', e);
  }
}
// -----------------------------------------------------------------------------
      } catch(e) {
        console.warn('rebuild() failed', e);
      }
    };
  }
})();
// === /Bootstrap ===

let graph = new Graph();
let editor;

function seed(){
  graph.nodes.length = 0;
  graph.connections.length = 0;

  const uv    = makeNode('UV', 50, 50);
  const time  = makeNode('Time', 60, 150);
  const r     = makeNode('ConstFloat', 260, 30); r.value = 0.30;
  const e     = makeNode('ConstFloat', 260, 90); e.value = 0.04;
  const expr  = makeNode('Expr', 260, 150);      expr.expr = 'a + sin(u_time*0.8)*0.05';

  const circle= makeNode('CircleField', 480, 60);
  const mul   = makeNode('Multiply', 700, 60);
  const add   = makeNode('Add', 920, 60);
  const sat   = makeNode('Saturate', 1140, 60);
  const out   = makeNode('OutputFinal', 1360, 60);

  circle.inputs[0] = r.id;
  circle.inputs[1] = e.id;

  mul.inputs[0] = uv.id;
  mul.inputs[1] = circle.id;

  expr.inputs[0] = circle.id;   // a
  expr.inputs[1] = time.id;     // b (optional)

  add.inputs[0] = mul.id;
  add.inputs[1] = expr.id;

  sat.inputs[0] = add.id;
  out.inputs[0] = sat.id;

  for(const n of [uv,time,r,e,expr,circle,mul,add,sat,out]) graph.add(n);

  // Mirror inputs[] into connections
  for(const n of graph.nodes){
    const ins = NodeDefs[n.kind]?.pinsIn || [];
    for(let i=0;i<ins.length;i++){
      const src = n.inputs[i];
      if(src){
        graph.connections.push({ from:{ nodeId: src, pin:0 }, to:{ nodeId: n.id, pin:i } });
      }
    }
  }
}

async function doRebuild(){
  const code = buildWGSL(graph);
  try { const el = document.getElementById('code'); if(el) el.textContent = code || ''; } catch(_) {}
  await trySetShader(code);
  computePreviews(graph);
}
window.rebuild = doRebuild;


function renderParamPanel(){
  const panel = document.getElementById('param-panel');
  if(panel){ panel.classList.remove('hidden'); panel.classList.add('panel'); panel.style.right='0px'; panel.style.top='0px'; panel.style.bottom='0px'; panel.style.width='280px'; }

  const side = document.getElementById('param-panel');
  if(!side) return;
  side.innerHTML = '';
  let selected = null;
  for(const n of graph.nodes) if(editor.graph.selection.has(n.id)) { selected = n; break; }
  if(!selected){ side.textContent = 'No selection'; return; }
  const def = NodeDefs[selected.kind] || { params:[] };
  const h2 = document.createElement('div');
  h2.className = 'pp-title';
  h2.textContent = def.label || selected.kind;
  side.appendChild(h2);

  // Value param
  if(def.params?.includes('value')){
    const row = document.createElement('div');
    row.className = 'pp-row';
    const lab = document.createElement('label'); lab.textContent = 'value';
    const inp = document.createElement('input'); inp.type='number'; inp.step='0.001'; inp.value = selected.value ?? 0.0;
    inp.addEventListener('input', ()=>{ selected.value = parseFloat(inp.value||'0')||0; rebuild(); });
    row.appendChild(lab); row.appendChild(inp); side.appendChild(row);
  }
  // Expr param
  if(def.params?.includes('expr')){
    const row = document.createElement('div');
    row.className = 'pp-row';
    const lab = document.createElement('label'); lab.textContent = 'expr';
    const inp = document.createElement('input'); inp.type='text'; inp.value = selected.expr ?? 'a';
    inp.addEventListener('change', ()=>{ selected.expr = inp.value; rebuild(); });
    row.appendChild(lab); row.appendChild(inp); side.appendChild(row);
    const hint = document.createElement('div'); hint.className='pp-hint'; hint.textContent='Use a,b, uv, u_time';
    side.appendChild(hint);
  }

  // CircleField params
  if (selected.kind === 'CircleField') {
    if (!selected.props) selected.props = {};
    const r = (typeof selected.props.radius  === 'number') ? selected.props.radius  : 0.25;
    const e = (typeof selected.props.epsilon === 'number') ? selected.props.epsilon : 0.01;

    const rowR = document.createElement('div');
    rowR.className = 'pp-row';
    const labR = document.createElement('label'); labR.textContent = 'radius';
    const inR = document.createElement('input'); inR.type='number'; inR.step='0.001'; inR.min='0'; inR.max='1'; inR.value = r;
    rowR.appendChild(labR); rowR.appendChild(inR); side.appendChild(rowR);

    const rowE = document.createElement('div');
    rowE.className = 'pp-row';
    const labE = document.createElement('label'); labE.textContent = 'epsilon';
    const inE = document.createElement('input'); inE.type='number'; inE.step='0.001'; inE.min='0'; inE.max='0.5'; inE.value = e;
    rowE.appendChild(labE); rowE.appendChild(inE); side.appendChild(rowE);

    // scrub + change handlers
    if (typeof window.__attachScrub === 'function') {
      window.__attachScrub(inR, 0, 1, 0.001, (v)=>{ selected.props.radius = v; if (typeof rebuild==='function') rebuild(); });
      window.__attachScrub(inE, 0, 0.5, 0.001, (v)=>{ selected.props.epsilon = v; if (typeof rebuild==='function') rebuild(); });
    } else {
      inR.addEventListener('input', ()=>{ selected.props.radius = parseFloat(inR.value)||0; if (typeof rebuild==='function') rebuild(); });
      inE.addEventListener('input', ()=>{ selected.props.epsilon = parseFloat(inE.value)||0; if (typeof rebuild==='function') rebuild(); });
    }
  }
}

seed();
/* __init_rebuild */ try{ if (typeof rebuild==='function') rebuild(); }catch(e){}

editor = new Editor(graph, ()=>{ try{ renderParamPanel(); if (typeof rebuild==='function') rebuild(); 
window.graph = graph;
window.editor = editor;
}catch(e){} });

function loop(){
  drawFrame();
  editor.draw();
  requestAnimationFrame(loop);
}

(async function start(){
  await ensureInit();
  try{ await initWebGPU(document.getElementById('gpu-canvas')); }catch(e){ console.warn(e); }
  smokeTest({ r: 1, g: 1, b: 1, a: 1 });
  rebuild();
  loop();
})();

window.addEventListener('error', e => {
  console.error('[window.error]', e.message, e.error?.stack || '');
});
window.addEventListener('unhandledrejection', e => {
  console.error('[unhandledrejection]', e.reason?.message || e.reason, e.reason?.stack || '');
});

// Save/Load (optional minimal)
window.addEventListener('keydown', (e)=>{
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if(mod && (k==='s' || k==='o')) e.preventDefault();
});
// ---- Preview evaluation ----
function computePreviews(graph){
  const byId = new Map(graph.nodes.map(n=>[n.id,n]));
  const ordered = (function topo(){
    const visited = new Set(), out = [];
    function visit(id){
      if(!id || visited.has(id)) return;
      visited.add(id);
      const n = byId.get(id); if(!n) return;
      for(const i of (n.inputs||[])) if(i) visit(i);
      out.push(n);
    }
    for(const n of graph.nodes) visit(n.id);
    return out;
  })();

  const val = new Map(); // nodeId -> value f32 | [x,y] | [x,y,z]

  const now = (performance.now()/1000);
  const UV0 = [0.5,0.5]; // sampling center for scalar previews

  function wantVec3(v){
    if(Array.isArray(v) && v.length===3) return v;
    if(Array.isArray(v) && v.length===2) return [v[0], v[1], 0];
    if(typeof v === 'number') return [v, v, v];
    return [0,0,0];
  }
  function wantF32(v){
    if(typeof v === 'number') return v;
    if(Array.isArray(v)) return v.reduce((a,b)=>a+b,0)/v.length;
    return 0;
  }
  function addVec(a,b){ a=wantVec3(a); b=wantVec3(b); return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
  function mulVec(a,b){ a=wantVec3(a); b=wantVec3(b); return [a[0]*b[0], a[1]*b[1], a[2]*b[2]]; }
  function clamp01(v){ const x=wantVec3(v); return [Math.min(1,Math.max(0,x[0])),Math.min(1,Math.max(0,x[1])),Math.min(1,Math.max(0,x[2]))]; }
  function dist(a,b){ const dx=a[0]-b[0], dy=a[1]-b[1]; return Math.hypot(dx,dy); }
  function smoothstep(e0,e1,x){ const t = Math.min(1, Math.max(0, (x-e0)/Math.max(1e-4, e1-e0) )); return t*t*(3-2*t); }

  for(const n of ordered){
    let out = null;
    switch(n.kind){
      case 'UV': out = UV0; break;
      case 'Time': out = now; break;
      case 'ConstFloat': out = typeof n.value==='number' ? n.value : 0; break;
      case 'Expr': {
        const a = n.inputs?.[0] ? wantF32(val.get(n.inputs[0])) : 0;
        const b = n.inputs?.[1] ? wantF32(val.get(n.inputs[1])) : 0;
        const scope = { a, b, u_time: now, sin: Math.sin, cos: Math.cos, tan: Math.tan, PI: Math.PI };
        let expr = (n.expr||'a').toString();
        try{
          // super minimal eval
          const f = new Function(...Object.keys(scope), `return (${expr});`);
          out = Number(f(...Object.values(scope)));
          if(!Number.isFinite(out)) out = 0;
        }catch{ out = 0; }
        break;
      }
      case 'CircleField': {
  const R = (n.inputs?.[0] ? wantF32(val.get(n.inputs[0])) : (n.props && typeof n.props.radius==='number' ? n.props.radius : 0.25));
  const E = Math.max(1e-4, (n.inputs?.[1] ? wantF32(val.get(n.inputs[1])) : (n.props && typeof n.props.epsilon==='number' ? n.props.epsilon : 0.02)));
  const d = dist(UV0, [0.5,0.5]);
  out = 1 - smoothstep(R-E, R+E, d);
  break;
}

      case 'Multiply': {
        const A = n.inputs?.[0] ? val.get(n.inputs[0]) : [0,0,0];
        const B = n.inputs?.[1] ? val.get(n.inputs[1]) : [0,0,0];
        out = mulVec(A,B); break;
      }
      case 'Add': {
        const A = n.inputs?.[0] ? val.get(n.inputs[0]) : [0,0,0];
        const B = n.inputs?.[1] ? val.get(n.inputs[1]) : [0,0,0];
        out = addVec(A,B); break;
      }
      case 'Saturate': {
        const V = n.inputs?.[0] ? val.get(n.inputs[0]) : [0,0,0];
        out = clamp01(V); break;
      }
      case 'OutputFinal': {
        const C = n.inputs?.[0] ? val.get(n.inputs[0]) : [0,0,0];
        out = wantVec3(C); break;
      }
      default: out = 0;
    }
    val.set(n.id, out);
    n.__preview = out;
  }

  // thumbnails: draw small 16x16 grayscale/color preview for certain nodes
  const ctx = document.getElementById('ui-canvas').getContext('2d');
  for(const n of graph.nodes){
    // Only for vec3-like values, draw a small color square; for f32 draw grayscale
    const v = n.__preview;
    const isVec = Array.isArray(v) && v.length===3;
    const size = 16;
    const img = ctx.createImageData(size, size);
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        let r,g,b;
        if(isVec){
          [r,g,b] = v.map(c=>Math.max(0,Math.min(1,c))*255|0);
        }else{
          const f = Math.max(0,Math.min(1, typeof v==='number' ? v : 0));
          r=g=b = f*255|0;
        }
        const idx = (y*size+x)*4;
        img.data[idx+0]=r; img.data[idx+1]=g; img.data[idx+2]=b; img.data[idx+3]=255;
      }
    }
    n.__thumb = img;
  }
}
window.computePreviews = computePreviews;




// ---- Parameter Schemas ----
const paramSchemas = {
  CircleField: [
    { key:'radius', label:'Radius', type:'number', min:0, max:1, step:0.001, def:0.25 },
    { key:'epsilon', label:'Edge (epsilon)', type:'number', min:0, max:0.5, step:0.001, def:0.02 },
  ],
  ConstFloat: [
    { key:'value', label:'Value', type:'number', min:-10, max:10, step:0.001, def:0.0 },
  ],
  Expr: [
    { key:'expr', label:'Expression', type:'text', def:'a' },
  ],
};

function ensureParamDefaults(graph){
  for(const n of graph.nodes){
    const schema = paramSchemas[n.kind];
    if(!schema) continue;
    if(!n.props) n.props = {};
    for(const f of schema){
      if(f.key==='value' && n.kind==='ConstFloat'){
        if(typeof n.value !== 'number') n.value = f.def;
        continue;
      }
      if(f.key==='expr' && n.kind==='Expr'){
        if(typeof n.expr !== 'string') n.expr = f.def;
        continue;
      }
      if(n.props[f.key] === undefined) n.props[f.key] = f.def;
    }
  }
}

// ---- Parameters Panel ----
function makeScrubNumber(label, value, {min=-Infinity, max=Infinity, step=0.001}={}, onChange){
  const wrap = document.createElement('div');
  wrap.className = 'param-row';

  const l = document.createElement('div');
  l.className = 'param-label';
  l.textContent = label;
  wrap.appendChild(l);

  const row = document.createElement('div');
  row.className = 'param-num';
  wrap.appendChild(row);

  const field = document.createElement('div');
  field.className = 'scrub';
  const fmt = (v)=>{
    if(!Number.isFinite(v)) return '0.000';
    return (Math.round(v/step)*step).toFixed(Math.max(0, (String(step).split('.')[1]||'').length));
  };
  let v = Number(value) || 0;
  field.textContent = fmt(v);
  row.appendChild(field);

  const unit = document.createElement('div');
  unit.className = 'unit';
  unit.textContent = '';
  row.appendChild(unit);

  let dragging = false;
  let startX = 0, startV = v;
  let moved = false;

  const commit = (nv)=>{
    nv = Math.min(max, Math.max(min, nv));
    v = nv;
    field.textContent = fmt(v);
    if(typeof onChange === 'function') onChange(v);
  };

  field.addEventListener('mousedown', (e)=>{
    dragging = true; moved = false;
    startX = e.clientX; startV = v;
    field.classList.remove('editing');
    field.style.cursor = 'ew-resize';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e)=>{
    if(!dragging) return;
    const dx = e.clientX - startX;
    const mult = e.altKey ? 10 : (e.shiftKey ? 0.1 : 1);
    const nv = startV + dx * step * 5 * mult;
    moved = moved || Math.abs(dx) > 2;
    commit(nv);
  });
  window.addEventListener('mouseup', ()=>{
    dragging = false;
    field.style.cursor = 'ew-resize';
  });

  // Double click to edit text
  field.addEventListener('dblclick', ()=>{
    field.classList.add('editing');
    const input = document.createElement('input');
    input.type = 'number';
    input.step = String(step);
    input.value = v;
    input.className = 'param-input';
    field.replaceChildren(input);
    input.focus();
    input.select();
    function finish(apply){
      const nv = parseFloat(input.value);
      field.classList.remove('editing');
      field.replaceChildren(document.createTextNode(fmt(v)));
      if(apply && Number.isFinite(nv)) commit(nv);
    }
    input.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){ finish(true); }
      if(e.key==='Escape'){ finish(false); }
    });
    input.addEventListener('blur', ()=> finish(true));
  });

  return wrap;
}



// ===== Numeric Scrub Controls (safe, no arrows) =====
function initNumberScrub(){
  var panel = document.getElementById('param-panel');
  if(!panel) return;
  var inputs = panel.querySelectorAll('input[type="number"]');
  for (var i=0; i<inputs.length; i++){
    var el = inputs[i];
    if (el.__scrubAttached) continue;
    el.__scrubAttached = true;
    attachNumberScrub(el);
  }
}
function attachNumberScrub(el){
  function num(v){ var n = parseFloat(v); return (isFinite(n) ? n : 0); }
  var dragging = false, startX = 0, startVal = 0;
  // Read attributes
  var step = (el.step && !isNaN(parseFloat(el.step))) ? parseFloat(el.step) : 0.001;
  var min = (el.min !== '' && !isNaN(parseFloat(el.min))) ? parseFloat(el.min) : null;
  var max = (el.max !== '' && !isNaN(parseFloat(el.max))) ? parseFloat(el.max) : null;
  var decimals = 0;
  var stepStr = String(step);
  var dot = stepStr.indexOf('.');
  if (dot >= 0) decimals = Math.min(6, stepStr.length - dot - 1);
  if (decimals === 0) decimals = 3; // fallback for display

  function onMove(e){
    if(!dragging) return;
    var mult = e.altKey ? 10 : (e.shiftKey ? 0.1 : 1);
    var dx = (e.clientX - startX);
    var val = startVal + dx * step * 5 * mult; // sensitivity: 5px per step
    if(min !== null) val = Math.max(min, val);
    if(max !== null) val = Math.min(max, val);
    // snap to step
    var snapped = Math.round(val / step) * step;
    el.value = snapped.toFixed(decimals);
    // fire input so existing listeners rebuild
    el.dispatchEvent(new Event('input', { bubbles: true }));
    e.preventDefault();
  }
  function onUp(e){
    if(!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    e.preventDefault();
  }
  el.addEventListener('mousedown', function(e){
    // Only left button, avoid when focusing text selection? We scrub regardless.
    if(e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startVal = num(el.value);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  });
  el.addEventListener('dblclick', function(){
    // Allow typing; select all text for convenience
    try { el.select(); } catch(_){}
  });
}

// Observe changes in the parameters panel and (re)attach scrubbing
(function(){
  try {
    var panel = document.getElementById('param-panel');
    if(!panel) return;
    var obs = new MutationObserver(function(){ initNumberScrub(); });
    obs.observe(panel, { childList: true, subtree: true });
    // initial
    initNumberScrub();
  } catch(e) {}
})();


// Hook up Load button to file input
const btnLoad = document.getElementById('btn-load');
if (btnLoad) {
  btnLoad.addEventListener('click', () => {
    const fileInput = document.getElementById('file-import-json');
    if (fileInput) fileInput.click();
  });
}

// Ensure after-import recompile/redraw
window.__afterImportHook = function(){
  try { if (typeof rebuild==='function') rebuild(); } catch(e){}
  try { if (editor && typeof editor.draw==='function') editor.draw(); } catch(e){}
};


// --- begin: auto-sync shader with graph (throttled) ---
window.__last_wgsl = window.__last_wgsl || "";
let __lastSync = 0;
function __syncShaderNow(){
  try{
    const g = getGraph();
    const wgsl = buildWGSL(g);
    if (wgsl && wgsl !== window.__last_wgsl){
      window.__last_wgsl = wgsl;
      trySetShader(wgsl);
    }
  }catch(e){ console.warn('syncShader error', e); }
}
function __syncShaderTick(ts){
  const now = performance.now();
  if (now - __lastSync > 300){
    __lastSync = now;
    __syncShaderNow();
  }
  requestAnimationFrame(__syncShaderTick);
}
requestAnimationFrame(__syncShaderTick);

if (!window.__hookedEditorChanges && window.editor){
  window.__hookedEditorChanges = true;
  const ed = window.editor;
  // Hook common mutations to force sync
  ['connectPins','disconnectPins','deleteSelected','createNode'].forEach(fn=>{
    if (typeof ed[fn] === 'function'){
      const orig = ed[fn].bind(ed);
      ed[fn] = function(...args){
        const r = orig(...args);
        try{ __syncShaderNow(); }catch(_){}
        return r;
      }
    }
  });
}
// --- end: auto-sync shader with graph ---
