// Clean main.js - GLSL Node Editor
// Eliminates duplicate functions and provides clear structure

import { initWebGPU, updateShader, drawFrame, clearOnce, smokeTest } from './gpu/gpuRenderer.js';
import { buildWGSL } from './codegen/glslBuilder.js';
import { Graph, Editor, makeNode, NodeDefs } from './core/Editor.js';

// Prevent double loading
if (window.__mainLoaded) throw new Error('main.js loaded twice');
window.__mainLoaded = true;

// === GLOBAL STATE ===
let graph = new Graph();
let editor = null;
let __deviceReady = false;

// === WEBGPU INITIALIZATION ===
async function ensureInit() {
  if (__deviceReady) return true;
  
  const canvas = document.getElementById('gpu-canvas') || document.querySelector('canvas');
  if (!canvas) {
    console.warn('No WebGPU canvas found');
    return false;
  }
  
  try {
    const device = await initWebGPU(canvas);
    __deviceReady = !!device;
    return __deviceReady;
  } catch (e) {
    console.warn('WebGPU init failed:', e);
    return false;
  }
}

// === SHADER MANAGEMENT ===
async function updateShaderFromGraph() {
  if (!__deviceReady) return;
  
  try {
    const wgsl = buildWGSL(graph);
    await updateShader(wgsl);
    
    // Update code display
    const codeEl = document.getElementById('code');
    if (codeEl) codeEl.textContent = wgsl;
    
    // Update previews
    computePreviews(graph);
  } catch (e) {
    console.warn('Shader update failed:', e);
  }
}

// === REBUILD FUNCTION ===
window.rebuild = updateShaderFromGraph;

// === GRAPH UTILITIES ===
window.getGraph = function() {
  return graph;
};

// === NODE PREVIEW COMPUTATION ===
function computePreviews(graph) {
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const ordered = topologicalSort(graph.nodes, byId);
  const values = new Map();
  const now = performance.now() / 1000;
  const UV_CENTER = [0.5, 0.5];

  // Helper functions
  const toVec3 = (v) => {
    if (Array.isArray(v) && v.length === 3) return v;
    if (Array.isArray(v) && v.length === 2) return [v[0], v[1], 0];
    if (typeof v === 'number') return [v, v, v];
    return [0, 0, 0];
  };

  const toF32 = (v) => {
    if (typeof v === 'number') return v;
    if (Array.isArray(v)) return v.reduce((a, b) => a + b, 0) / v.length;
    return 0;
  };

  const addVec = (a, b) => {
    a = toVec3(a); b = toVec3(b);
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  };

  const mulVec = (a, b) => {
    a = toVec3(a); b = toVec3(b);
    return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
  };

  const clamp01 = (v) => {
    const x = toVec3(v);
    return [
      Math.min(1, Math.max(0, x[0])),
      Math.min(1, Math.max(0, x[1])),
      Math.min(1, Math.max(0, x[2]))
    ];
  };

  const distance = (a, b) => {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.hypot(dx, dy);
  };

  const smoothstep = (edge0, edge1, x) => {
    const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-4, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  // Evaluate each node
  for (const node of ordered) {
    let result = null;

    switch (node.kind) {
      case 'UV':
        result = UV_CENTER;
        break;

      case 'Time':
        result = now;
        break;

      case 'ConstFloat':
        result = typeof node.value === 'number' ? node.value : 0;
        break;

      case 'Expr': {
        const a = node.inputs?.[0] ? toF32(values.get(node.inputs[0])) : 0;
        const b = node.inputs?.[1] ? toF32(values.get(node.inputs[1])) : 0;
        const expr = (node.expr || 'a').toString();
        
        try {
          const scope = { a, b, u_time: now, sin: Math.sin, cos: Math.cos, PI: Math.PI };
          const func = new Function(...Object.keys(scope), `return (${expr});`);
          result = Number(func(...Object.values(scope)));
          if (!Number.isFinite(result)) result = 0;
        } catch {
          result = 0;
        }
        break;
      }

      case 'CircleField': {
        const radius = node.inputs?.[0] ? toF32(values.get(node.inputs[0])) : 
                      (node.props?.radius ?? 0.25);
        const epsilon = Math.max(1e-4, node.inputs?.[1] ? toF32(values.get(node.inputs[1])) : 
                                (node.props?.epsilon ?? 0.02));
        const dist = distance(UV_CENTER, [0.5, 0.5]);
        result = 1 - smoothstep(radius - epsilon, radius + epsilon, dist);
        break;
      }

      case 'Multiply': {
        const a = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
        const b = node.inputs?.[1] ? values.get(node.inputs[1]) : [0, 0, 0];
        result = mulVec(a, b);
        break;
      }

      case 'Add': {
        const a = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
        const b = node.inputs?.[1] ? values.get(node.inputs[1]) : [0, 0, 0];
        result = addVec(a, b);
        break;
      }

      case 'Saturate': {
        const v = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
        result = clamp01(v);
        break;
      }

      case 'OutputFinal': {
        const c = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
        result = toVec3(c);
        break;
      }

      default:
        result = 0;
    }

    values.set(node.id, result);
    node.__preview = result;
  }

  // Generate thumbnails
  generateThumbnails(graph.nodes);
}

// === TOPOLOGICAL SORT ===
function topologicalSort(nodes, byId) {
  const visited = new Set();
  const result = [];

  function visit(nodeId) {
    if (!nodeId || visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = byId.get(nodeId);
    if (!node) return;
    
    // Visit dependencies first
    for (const input of (node.inputs || [])) {
      if (input) visit(input);
    }
    
    result.push(node);
  }

  for (const node of nodes) {
    visit(node.id);
  }

  return result;
}

// === THUMBNAIL GENERATION ===
function generateThumbnails(nodes) {
  const canvas = document.getElementById('ui-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  for (const node of nodes) {
    const value = node.__preview;
    const isVector = Array.isArray(value) && value.length === 3;
    const size = 16;
    
    const imageData = ctx.createImageData(size, size);
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let r, g, b;
        
        if (isVector) {
          [r, g, b] = value.map(c => Math.max(0, Math.min(1, c)) * 255 | 0);
        } else {
          const gray = Math.max(0, Math.min(1, typeof value === 'number' ? value : 0)) * 255 | 0;
          r = g = b = gray;
        }
        
        const idx = (y * size + x) * 4;
        imageData.data[idx + 0] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      }
    }
    
    node.__thumb = imageData;
  }
}

// === PARAMETER PANEL ===
function renderParamPanel() {
  const panel = document.getElementById('param-panel');
  if (!panel) return;

  // Find selected node
  let selected = null;
  for (const node of graph.nodes) {
    if (editor.graph.selection.has(node.id)) {
      selected = node;
      break;
    }
  }

  if (!selected) {
    panel.innerHTML = '<div class="pp-title">No selection</div>';
    panel.classList.add('hidden');
    return;
  }

  // Show panel
  panel.classList.remove('hidden');
  panel.innerHTML = '';

  const def = NodeDefs[selected.kind] || { params: [] };
  
  // Title
  const title = document.createElement('div');
  title.className = 'pp-title';
  title.textContent = def.label || selected.kind;
  panel.appendChild(title);

  // Value parameter (ConstFloat)
  if (def.params?.includes('value')) {
    const row = createParamRow('Value', 'number', selected.value ?? 0, (value) => {
      selected.value = parseFloat(value) || 0;
      updateShaderFromGraph();
    });
    panel.appendChild(row);
  }

  // Expression parameter (Expr)
  if (def.params?.includes('expr')) {
    const row = createParamRow('Expression', 'text', selected.expr ?? 'a', (value) => {
      selected.expr = value;
      updateShaderFromGraph();
    });
    panel.appendChild(row);
    
    const hint = document.createElement('div');
    hint.className = 'pp-hint';
    hint.textContent = 'Use: a, b, u_time, sin, cos, PI';
    panel.appendChild(hint);
  }

  // CircleField parameters
  if (selected.kind === 'CircleField') {
    if (!selected.props) selected.props = {};
    
    const radiusRow = createParamRow('Radius', 'number', selected.props.radius ?? 0.25, (value) => {
      selected.props.radius = parseFloat(value) || 0;
      updateShaderFromGraph();
    }, { min: 0, max: 1, step: 0.001 });
    panel.appendChild(radiusRow);
    
    const epsilonRow = createParamRow('Epsilon', 'number', selected.props.epsilon ?? 0.02, (value) => {
      selected.props.epsilon = parseFloat(value) || 0;
      updateShaderFromGraph();
    }, { min: 0, max: 0.5, step: 0.001 });
    panel.appendChild(epsilonRow);
  }
}

// === PARAMETER ROW HELPER ===
function createParamRow(label, type, value, onChange, attrs = {}) {
  const row = document.createElement('div');
  row.className = 'pp-row';
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  row.appendChild(labelEl);
  
  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  
  // Apply attributes
  Object.assign(input, attrs);
  
  input.addEventListener('input', () => onChange(input.value));
  row.appendChild(input);
  
  return row;
}

// === SEED GRAPH ===
function createSeedGraph() {
  graph.nodes.length = 0;
  graph.connections.length = 0;

  // Create nodes
  const uv = makeNode('UV', 50, 50);
  const time = makeNode('Time', 60, 150);
  const radius = makeNode('ConstFloat', 260, 30); 
  radius.value = 0.30;
  const epsilon = makeNode('ConstFloat', 260, 90); 
  epsilon.value = 0.04;
  const expr = makeNode('Expr', 260, 150); 
  expr.expr = 'a + sin(u_time*0.8)*0.05';

  const circle = makeNode('CircleField', 480, 60);
  const multiply = makeNode('Multiply', 700, 60);
  const add = makeNode('Add', 920, 60);
  const saturate = makeNode('Saturate', 1140, 60);
  const output = makeNode('OutputFinal', 1360, 60);

  // Set up connections via inputs array
  circle.inputs[0] = radius.id;
  circle.inputs[1] = epsilon.id;
  multiply.inputs[0] = uv.id;
  multiply.inputs[1] = circle.id;
  expr.inputs[0] = circle.id;
  expr.inputs[1] = time.id;
  add.inputs[0] = multiply.id;
  add.inputs[1] = expr.id;
  saturate.inputs[0] = add.id;
  output.inputs[0] = saturate.id;

  // Add nodes to graph
  const allNodes = [uv, time, radius, epsilon, expr, circle, multiply, add, saturate, output];
  allNodes.forEach(node => graph.add(node));

  // Create connections array from inputs
  for (const node of graph.nodes) {
    const inputs = NodeDefs[node.kind]?.pinsIn || [];
    for (let i = 0; i < inputs.length; i++) {
      const sourceId = node.inputs[i];
      if (sourceId) {
        graph.connections.push({
          from: { nodeId: sourceId, pin: 0 },
          to: { nodeId: node.id, pin: i }
        });
      }
    }
  }
}

// === RENDER LOOP ===
function renderLoop() {
  if (__deviceReady) {
    drawFrame();
  }
  if (editor) {
    editor.draw();
  }
  requestAnimationFrame(renderLoop);
}

// === INITIALIZATION ===
async function initialize() {
  try {
    // Initialize WebGPU
    await ensureInit();
    
    // Create seed graph
    createSeedGraph();
    
    // Create editor
    editor = new Editor(graph, () => {
      renderParamPanel();
      updateShaderFromGraph();
    });
    
    // Expose globals
    window.graph = graph;
    window.editor = editor;
    window.computePreviews = computePreviews;
    
    // Initial shader compilation
    await updateShaderFromGraph();
    
    // Start render loop
    renderLoop();
    
    console.log('GLSL Node Editor initialized successfully');
    
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

// === ERROR HANDLING ===
window.addEventListener('error', (e) => {
  console.error('[Error]', e.message, e.error?.stack || '');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Promise]', e.reason?.message || e.reason, e.reason?.stack || '');
});

// === START APPLICATION ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}