import { initWebGPU, updateShader, drawFrame } from './src/gpu/gpuRenderer.js';
import { buildWGSL } from './src/codegen/glslBuilder.js';
import { Editor } from './src/core/Editor.js';
import { Graph } from './src/data/Graph.js';
import { makeNode, NodeDefs } from './src/data/NodeDefs.js';
import { PreviewComputer } from './src/core/PreviewComputer.js';
import { SeedGraphBuilder } from './src/utils/SeedGraphBuilder.js';

if (window.__mainLoaded) throw new Error('main.js loaded twice');
window.__mainLoaded = true;

let graph = new Graph();
let editor = null;
let __deviceReady = false;
let previewComputer = new PreviewComputer();

async function initialize() {
  try {
    const canvas = document.getElementById('gpu-canvas') || document.querySelector('canvas');
    if (canvas) {
      const device = await initWebGPU(canvas);
      __deviceReady = !!device;
    }
    
    SeedGraphBuilder.createSeedGraph(graph);
    editor = new Editor(graph, updateShaderFromGraph);
    
    window.graph = graph;
    window.editor = editor;
    window.rebuild = updateShaderFromGraph;
    
    await updateShaderFromGraph();
    renderLoop();
    console.log('GLSL Node Editor initialized successfully');
    
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

async function updateShaderFromGraph() {
  if (!__deviceReady) return;
  try {
    const wgsl = buildWGSL(graph);
    await updateShader(wgsl);
    const codeEl = document.getElementById('code');
    if (codeEl) codeEl.textContent = wgsl;
    previewComputer.computePreviews(graph);
  } catch (e) {
    console.warn('Shader update failed:', e);
  }
}

function renderLoop() {
  if (__deviceReady) drawFrame();
  if (editor) editor.draw();
  requestAnimationFrame(renderLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
