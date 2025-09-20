// main.js - Deep refactor with extracted managers
import { updateShader, drawFrame } from './src/gpu/gpuRenderer.js';
import { buildWGSL } from './src/codegen/glslBuilder.js';
import { Editor } from './src/core/Editor.js';
import { SaveLoadManager } from './src/core/SaveLoadManager.js';
import { BackupDialog } from './src/ui/BackupDialog.js';
import { Graph } from './src/data/Graph.js';
import { makeNode, NodeDefs } from './src/data/NodeDefs.js';
import { SeedGraphBuilder } from './src/utils/SeedGraphBuilder.js';
import { FloatingGPUPreview } from './src/ui/FloatingGPUPreview.js';
import { 
  DragPrevention, 
  StatusManager, 
  RhizomiumDisabler,
  ProjectManager 
} from './src/utils/AppUtilities.js';
import { KeyboardManager } from './src/utils/KeyboardManager.js';
import { UIHandlerManager } from './src/ui/UIHandlerManager.js';
import { WebGPUManager } from './src/core/WebGPUManager.js';

window.makeNode = makeNode;
window.NodeDefs = NodeDefs;

// DISABLE RhizomiumLoader completely
window.__disableRhizomiumLoader = true;

if (window.__mainLoaded) throw new Error('main.js loaded twice');
window.__mainLoaded = true;

// Core application state
let graph = new Graph();
let editor = null;
let saveLoadManager = null;
let backupDialog = null;
let floatingPreview = null;

// Managers
let webGPUManager = null;
let keyboardManager = null;
let uiHandlerManager = null;

async function initialize() {
  try {
    // Setup global behaviors
    DragPrevention.setup();
    RhizomiumDisabler.disable();

    // Initialize WebGPU
    webGPUManager = new WebGPUManager();
    const canvas = document.getElementById('gpu-canvas') || document.querySelector('canvas');
    if (canvas) {
      await webGPUManager.initialize(canvas);
    }

    // Create seed graph
    SeedGraphBuilder.createSeedGraph(graph);
    
    // Initialize core systems
    editor = new Editor(graph, updateShaderFromGraph);
    saveLoadManager = new SaveLoadManager(editor, graph, updateShaderFromGraph);
    backupDialog = new BackupDialog(saveLoadManager);
    
    // Initialize floating preview
    const gpuCanvas = document.getElementById('gpu-canvas');
    if (gpuCanvas) {
      floatingPreview = new FloatingGPUPreview(gpuCanvas);
      setupPreviewButtons();
      floatingPreview.show();
    }
    
    // Initialize managers
    initializeManagers();
    
    // Expose globals
    setupGlobalExports();
    
    // Check for autosave recovery
    await checkAutosaveRecovery();
    
    // Initial shader update and render
    await updateShaderFromGraph();
    
    renderLoop();
    
    // Setup periodic cleanup
    RhizomiumDisabler.setupPeriodicCleanup();
    
    console.log('GLSL Node Editor initialized successfully');
    
  } catch (error) {
    console.error('Initialization failed:', error);
    StatusManager.update('Initialization failed: ' + error.message, 'error');
  }
}

function initializeManagers() {
  // Setup keyboard shortcuts
  keyboardManager = new KeyboardManager(
    saveLoadManager, 
    backupDialog, 
    updateShaderFromGraph, 
    createNewProject
  );
  keyboardManager.setup();
  
  // Setup UI handlers
  uiHandlerManager = new UIHandlerManager({
    saveLoadManager,
    backupDialog,
    updateShaderFromGraph,
    graph,
    editor,
    reinitializeWebGPUAfterLoad: () => webGPUManager.reinitializeAfterLoad()
  });
  uiHandlerManager.setupAllHandlers();
}

function setupGlobalExports() {
  window.graph = graph;
  window.editor = editor;
  window.saveLoadManager = saveLoadManager;
  window.backupDialog = backupDialog;
  window.rebuild = updateShaderFromGraph;
  window.buildWGSL = buildWGSL;
  window.floatingPreview = floatingPreview;
  window.showBackupDialog = showBackupDialog;
  window.createNewProject = createNewProject;
  window.updateStatus = StatusManager.update;
}

async function checkAutosaveRecovery() {
  if (!saveLoadManager.hasAutosave()) return;
  
  const age = saveLoadManager.getAutosaveAge();
  const ageText = saveLoadManager.formatAge(age);
  
  // Show recovery dialog if autosave is recent (less than 1 hour old)
  if (age < 3600000) { // 1 hour in milliseconds
    const shouldRecover = confirm(
      `Found an autosave from ${ageText} ago. Would you like to recover it?`
    );
    
    if (shouldRecover) {
      await saveLoadManager.loadFromLocal();
      return;
    }
  }
  
  // If not recovering, create a backup of current state
  saveLoadManager.createBackup('startup');
}

function createNewProject() {
  // Use extracted utility
  ProjectManager.create(graph, editor, saveLoadManager, updateShaderFromGraph);
}

function setupPreviewButtons() {
  if (!floatingPreview) return;
  
  // Connect to HTML buttons instead of creating new ones
  const toggleBtn = document.getElementById('btn-toggle-preview');
  const dockBtn = document.getElementById('btn-dock-preview');
  const lockBtn = document.getElementById('btn-lock-preview');
  const fullscreenBtn = document.getElementById('btn-fullscreen-preview');
  
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => floatingPreview.toggle());
  }
  
  if (dockBtn) {
    dockBtn.addEventListener('click', () => {
      floatingPreview.toggleDocked();
      dockBtn.textContent = floatingPreview.isDocked ? 'Float Preview' : 'Dock Preview';
    });
  }
  
  if (lockBtn) {
    lockBtn.addEventListener('click', () => floatingPreview.toggleLock());
  }
  
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => floatingPreview.toggleFullscreen());
  }
}

async function updateShaderFromGraph() {
  if (!webGPUManager || !webGPUManager.isDeviceReady()) {
    StatusManager.update('WebGPU not ready', 'warning');
    return;
  }
  
  try {
    StatusManager.update('Building shader...');
    const wgsl = buildWGSL(graph);
    
    StatusManager.update('Updating GPU shader...');
    await updateShader(wgsl);
    
    // Update code display
    const codeEl = document.getElementById('code');
    if (codeEl) {
      codeEl.textContent = wgsl;
    }
    
    StatusManager.update('Shader updated successfully');
    
    // Trigger preview updates if needed
    if (editor && editor.previewIntegration && typeof editor.previewIntegration.onShaderUpdate === 'function') {
      editor.previewIntegration.onShaderUpdate();
    }
    
    // Update floating preview
    if (window.floatingPreview) {
      setTimeout(() => {
        const mainCanvas = document.getElementById('gpu-canvas');
        const previewCanvas = window.floatingPreview.canvas || window.floatingPreview.previewCanvas;
        
        if (mainCanvas && previewCanvas) {
          const ctx = previewCanvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.drawImage(mainCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
          }
        }
      }, 100); // Small delay to ensure GPU render is complete
    }
    
  } catch (error) {
    console.error('Shader update failed:', error);
    StatusManager.update(`Shader error: ${error.message}`, 'error');
    
    // Show error overlay using utility
    StatusManager.showShaderError(error.message);
  }
}

function renderLoop() {
  // Render GPU frame
  if (webGPUManager && webGPUManager.isDeviceReady()) {
    try {
      drawFrame();
    } catch (error) {
      console.error('GPU render failed:', error);
    }
  }
  
  // Render editor UI
  if (editor) {
    try {
      editor.draw();
    } catch (error) {
      console.error('Editor render failed:', error);
    }
  }
  
  // Update FPS counter
  if (floatingPreview && floatingPreview.fpsCounter) {
    floatingPreview.fpsCounter.frame();
  }
  
  requestAnimationFrame(renderLoop);
}

// Enhanced backup management
function showBackupDialog() {
  if (backupDialog) {
    backupDialog.show();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}