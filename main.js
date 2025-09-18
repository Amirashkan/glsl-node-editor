import { initWebGPU, updateShader, drawFrame } from './src/gpu/gpuRenderer.js';
import { buildWGSL } from './src/codegen/glslBuilder.js';
import { Editor } from './src/core/Editor.js';
import { Graph } from './src/data/Graph.js';
import { makeNode, NodeDefs } from './src/data/NodeDefs.js';
import { SeedGraphBuilder } from './src/utils/SeedGraphBuilder.js';
import { FloatingGPUPreview } from './src/ui/FloatingGPUPreview.js';

if (window.__mainLoaded) throw new Error('main.js loaded twice');
window.__mainLoaded = true;

let graph = new Graph();
let editor = null;
let __deviceReady = false;
let floatingPreview = null;

async function initialize() {
  try {
    const canvas = document.getElementById('gpu-canvas') || document.querySelector('canvas');
    if (canvas) {
      const device = await initWebGPU(canvas);
      __deviceReady = !!device;
    }
    
    SeedGraphBuilder.createSeedGraph(graph);
    editor = new Editor(graph, updateShaderFromGraph);
    
    const gpuCanvas = document.getElementById('gpu-canvas');
    if (gpuCanvas) {
      floatingPreview = new FloatingGPUPreview(gpuCanvas);
      addPreviewButtons();
      floatingPreview.show();
    }
    
    window.graph = graph;
    window.editor = editor;
    window.rebuild = updateShaderFromGraph;
    window.floatingPreview = floatingPreview;
    
    await updateShaderFromGraph();
    renderLoop();
    console.log('GLSL Node Editor initialized successfully');
    
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

function addPreviewButtons() {
  const hud = document.getElementById('hud');
  if (!hud || !floatingPreview) return;
  
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Toggle Preview';
  toggleBtn.addEventListener('click', () => floatingPreview.toggle());
  
  const dockBtn = document.createElement('button');
  dockBtn.textContent = 'Dock Preview';
  dockBtn.addEventListener('click', () => {
    floatingPreview.toggleDocked();
    dockBtn.textContent = floatingPreview.isDocked ? 'Float Preview' : 'Dock Preview';
  });
  
  const lockBtn = document.createElement('button');
  lockBtn.textContent = 'Lock Preview';
  lockBtn.addEventListener('click', () => floatingPreview.toggleLock());
  
  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.textContent = 'Fullscreen';
  fullscreenBtn.addEventListener('click', () => floatingPreview.toggleFullscreen());
  
  hud.insertBefore(dockBtn, hud.firstChild);
  hud.insertBefore(toggleBtn, hud.firstChild);
  hud.insertBefore(lockBtn, hud.firstChild);
  hud.insertBefore(fullscreenBtn, hud.firstChild);
}

async function updateShaderFromGraph() {
  if (!__deviceReady) return;
  try {
    const wgsl = buildWGSL(graph);
    await updateShader(wgsl);
    const codeEl = document.getElementById('code');
    if (codeEl) codeEl.textContent = wgsl;
  } catch (e) {
    console.warn('Shader update failed:', e);
  }
}

function renderLoop() {
  if (__deviceReady) drawFrame();
  if (editor) editor.draw();
  
  // Update FPS counter
  if (floatingPreview && floatingPreview.fpsCounter) {
    floatingPreview.fpsCounter.frame();
  }
  
  requestAnimationFrame(renderLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
