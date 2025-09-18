// main.js - Updated with Save/Load Integration
import { initWebGPU, updateShader, drawFrame } from './src/gpu/gpuRenderer.js';
import { buildWGSL } from './src/codegen/glslBuilder.js';
import { Editor } from './src/core/Editor.js';
import { SaveLoadManager } from './src/core/SaveLoadManager.js';
import { BackupDialog } from './src/ui/BackupDialog.js';
import { Graph } from './src/data/Graph.js';
import { makeNode, NodeDefs } from './src/data/NodeDefs.js';
import { SeedGraphBuilder } from './src/utils/SeedGraphBuilder.js';
import { FloatingGPUPreview } from './src/ui/FloatingGPUPreview.js';

if (window.__mainLoaded) throw new Error('main.js loaded twice');
window.__mainLoaded = true;

// DISABLE RhizomiumLoader completely
window.__disableRhizomiumLoader = true;

let graph = new Graph();
let editor = null;
let saveLoadManager = null;
let backupDialog = null;
let __deviceReady = false;
let floatingPreview = null;

async function initialize() {
  try {
    // COMPLETELY DISABLE RhizomiumLoader
    // Override its functions before they can create duplicates
    if (typeof window.mountPill === 'undefined') {
      window.mountPill = () => { console.log('RhizomiumLoader mountPill disabled'); };
    }
    
    // Remove any existing RhizomiumLoader elements
    const existingPill = document.getElementById('rz-fallback-pill');
    if (existingPill) {
      existingPill.remove();
      console.log('Removed existing RhizomiumLoader pill');
    }
    
    // Initialize WebGPU
    const canvas = document.getElementById('gpu-canvas') || document.querySelector('canvas');
    if (canvas) {
      const device = await initWebGPU(canvas);
      __deviceReady = !!device;
    }
    
    // Create seed graph
    SeedGraphBuilder.createSeedGraph(graph);
    
    // Initialize editor
    editor = new Editor(graph, updateShaderFromGraph);
    
    // Initialize save/load system
    console.log('Creating SaveLoadManager...');
    saveLoadManager = new SaveLoadManager(editor, graph, updateShaderFromGraph);
    console.log('SaveLoadManager created:', saveLoadManager);
    
    // Initialize backup dialog
    console.log('Creating BackupDialog...');
    backupDialog = new BackupDialog(saveLoadManager);
    console.log('BackupDialog created:', backupDialog);
    
    // Setup UI event handlers ONCE - AFTER SaveLoadManager is created
    console.log('Setting up UI event handlers...');
    setTimeout(() => {
      try {
        console.log('Delayed UI setup starting...');
        
        // First, let's see what buttons actually exist
        const allButtons = document.querySelectorAll('button');
        console.log('Total buttons found:', allButtons.length);
        allButtons.forEach((btn, i) => {
          console.log(`Button ${i}: id="${btn.id}" text="${btn.textContent.trim()}"`);
        });
        
        // Check for snap elements
        const snapElements = document.querySelectorAll('input[type="checkbox"]');
        console.log('Snap checkboxes found:', snapElements.length);
        snapElements.forEach((snap, i) => {
          console.log(`Snap ${i}: id="${snap.id}" parent="${snap.parentElement.textContent.trim()}"`);
        });
        
        console.log('About to call setupUIEventHandlers...');
        console.log('setupUIEventHandlers call completed');
        
      } catch (error) {
        console.error('Error in setTimeout:', error);
      }
    }, 100);
    
    // Initialize floating preview and connect to HTML buttons
    const gpuCanvas = document.getElementById('gpu-canvas');
    if (gpuCanvas) {
      floatingPreview = new FloatingGPUPreview(gpuCanvas);
      setupPreviewButtons(); // Connect to HTML buttons instead of creating new ones
      floatingPreview.show();
    }
    
    // Setup UI event handlers
    setupUIEventHandlers();
    
    // Debug: Check if SaveLoadManager is working
    console.log('SaveLoadManager initialized:', !!saveLoadManager);
    console.log('BackupDialog initialized:', !!backupDialog);
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Expose globals BEFORE setting up UI handlers
    window.graph = graph;
    window.editor = editor;
    window.saveLoadManager = saveLoadManager;
    window.backupDialog = backupDialog;
    window.rebuild = updateShaderFromGraph;
    window.buildWGSL = buildWGSL; // For SaveLoadManager WGSL export
    window.floatingPreview = floatingPreview;
    
    // Check for autosave recovery
    await checkAutosaveRecovery();
    
    // Initial shader update and render
    await updateShaderFromGraph();
    
    // REMOVE the duplicate setupUIEventHandlers call
    // setupUIEventHandlers(); // REMOVED - already called above
    
    renderLoop();
    
    // Periodic cleanup of RhizomiumLoader interference
    setInterval(() => {
      const pill = document.getElementById('rz-fallback-pill');
      if (pill && pill.style.display !== 'none') {
        pill.remove();
        console.log('Removed late RhizomiumLoader interference');
      }
    }, 2000);
    
    console.log('GLSL Node Editor initialized successfully');
    
  } catch (error) {
    console.error('Initialization failed:', error);
    updateStatus('Initialization failed: ' + error.message, 'error');
  }
}

// Replace your setupUIEventHandlers function in main.js with this:

// Replace your setupUIEventHandlers function in main.js with this:

function setupUIEventHandlers() {
  console.log('Setting up UI event handlers...');
  
  if (!saveLoadManager) {
    console.error('SaveLoadManager not available!');
    return;
  }

  // Save Project button
  const saveBtn = document.getElementById('btn-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Save button clicked');
      saveLoadManager.saveToFile();
    });
    console.log('Save button handler attached');
  }

  // Load Project button  
  const loadBtn = document.getElementById('btn-load');
  if (loadBtn) {
    loadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Load button clicked');
      triggerFileLoad();
    });
    console.log('Load button handler attached');
  }

  // File input change handler
  const fileInput = document.getElementById('file-import');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('Loading file:', file.name);
        await saveLoadManager.loadFromFile(file);
        // Clear the input after processing
        e.target.value = '';
      }
    });
    console.log('File input handler attached');
  }

  // Helper function to reliably trigger file selection
  function triggerFileLoad() {
    const fileInput = document.getElementById('file-import');
    if (fileInput) {
      // Force clear the value and refresh the input
      fileInput.value = '';
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Small delay to ensure the clear takes effect
      setTimeout(() => {
        fileInput.click();
      }, 10);
    }
  }

  // Export JSON button
  const exportJsonBtn = document.getElementById('btn-export-json');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Export JSON clicked');
      saveLoadManager.saveToFile(null, 'json');
    });
    console.log('Export JSON handler attached');
  }

  // Export WGSL button
  const exportWgslBtn = document.getElementById('btn-export-wgsl');
  if (exportWgslBtn) {
    exportWgslBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Export WGSL clicked');
      saveLoadManager.saveToFile(null, 'wgsl');
    });
    console.log('Export WGSL handler attached');
  }

  // Import button (same as load)
  const importBtn = document.getElementById('btn-import');
  if (importBtn) {
    importBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Import button clicked');
      triggerFileLoad();
    });
    console.log('Import button handler attached');
  }

  // Backups button (if you have BackupDialog)
  const backupsBtn = document.getElementById('btn-backups');
  if (backupsBtn && backupDialog) {
    backupsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Backups button clicked');
      backupDialog.show();
    });
    console.log('Backups button handler attached');
  }

  // Rebuild button
  const rebuildBtn = document.getElementById('btn-rebuild');
  if (rebuildBtn) {
    rebuildBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Rebuild button clicked');
      updateShaderFromGraph();
    });
    console.log('Rebuild button handler attached');
  }

  // Snap toggle
  const snapToggle = document.getElementById('snap-toggle');
  if (snapToggle && editor) {
    snapToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      console.log('Snap toggled:', isEnabled);
      // Connect to your editor's snap functionality
      if (editor.setSnapEnabled) {
        editor.setSnapEnabled(isEnabled);
      }
    });
    console.log('Snap toggle handler attached');
  }

  console.log('All UI event handlers setup complete');
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;

    if (!cmdKey) return;

    switch (e.key.toLowerCase()) {
      case 's':
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+S: Save to local storage
          saveLoadManager.saveToLocal();
        } else {
          // Ctrl+S: Save to file
          saveLoadManager.saveToFile();
        }
        break;

      case 'o':
        e.preventDefault();
        // Ctrl+O: Open file
        const fileInput = document.getElementById('file-import');
        if (fileInput) {
          fileInput.value = '';
          fileInput.click();
        }
        break;

      case 'l':
        e.preventDefault();
        // Ctrl+L: Load from local storage
        saveLoadManager.loadFromLocal();
        break;

      case 'e':
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+E: Export WGSL
          saveLoadManager.saveToFile(null, 'wgsl');
        } else {
          // Ctrl+E: Export JSON
          saveLoadManager.saveToFile(null, 'json');
        }
        break;

      case 'n':
        e.preventDefault();
        // Ctrl+N: New project
        if (confirm('Create new project? Unsaved changes will be lost.')) {
          createNewProject();
        }
        break;

      case 'z':
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+Z: Redo (future feature)
          console.log('Redo - not implemented yet');
        } else {
          // Ctrl+Z: Undo (future feature)
          console.log('Undo - not implemented yet');
        }
        break;

      case 'a':
        e.preventDefault();
        // Ctrl+A: Select all
        if (editor && editor.selectAll) {
          editor.selectAll();
        }
        break;

      case 'd':
        e.preventDefault();
        // Ctrl+D: Duplicate selected
        if (editor && editor.duplicateSelected) {
          editor.duplicateSelected();
        }
        break;

      case 'b':
        e.preventDefault();
        // Ctrl+B: Show backup dialog
        if (backupDialog) {
          backupDialog.show();
        }
        break;

      case 'r':
        // Don't preventDefault for Ctrl+R - let browser refresh
        if (!e.shiftKey) {
          // Ctrl+R: Let browser handle page refresh
          return;
        } else {
          // Ctrl+Shift+R: Rebuild shader
          e.preventDefault();
          updateShaderFromGraph();
        }
        break;
    }
  });
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
  // Clear current graph
  graph.nodes = [];
  graph.connections = [];
  graph.selection = new Set();
  
  // Reset editor state
  if (editor) {
    if (editor.selection && editor.selection.clear) {
      editor.selection.clear();
    }
    if (editor.nodePreviews) {
      editor.nodePreviews.clear();
    }
    // Reset viewport
    if (editor.viewport) {
      editor.viewport.panX = 0;
      editor.viewport.panY = 0;
      editor.viewport.zoom = 1;
    }
  }
  
  // Create new seed graph
  SeedGraphBuilder.createSeedGraph(graph);
  
  // Update shader and UI
  updateShaderFromGraph();
  if (editor && editor.draw) {
    editor.draw();
  }
  
  // Mark as clean project
  if (saveLoadManager) {
    saveLoadManager.hasUnsavedChanges = false;
    saveLoadManager.updateStatus('New project created');
  }
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
  if (!__deviceReady) {
    updateStatus('WebGPU not ready', 'warning');
    return;
  }
  
  try {
    updateStatus('Building shader...');
    const wgsl = buildWGSL(graph);
    
    updateStatus('Updating GPU shader...');
    await updateShader(wgsl);
    
    // Update code display
    const codeEl = document.getElementById('code');
    if (codeEl) {
      codeEl.textContent = wgsl;
    }
    
    updateStatus('Shader updated successfully');
    
    // Trigger preview updates if needed
    if (editor && editor.previewIntegration && typeof editor.previewIntegration.onShaderUpdate === 'function') {
      editor.previewIntegration.onShaderUpdate();
    }
    
  } catch (error) {
    console.error('Shader update failed:', error);
    updateStatus(`Shader error: ${error.message}`, 'error');
    
    // Show error overlay
    showShaderError(error.message);
  }
}

function showShaderError(errorMessage) {
  const errorOverlay = document.getElementById('err-overlay');
  const errorLog = document.getElementById('err-log');
  
  if (errorOverlay && errorLog) {
    errorLog.textContent = errorMessage;
    errorOverlay.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorOverlay.classList.add('hidden');
    }, 5000);
    
    // Click to dismiss
    errorOverlay.onclick = () => {
      errorOverlay.classList.add('hidden');
    };
  }
}

function updateStatus(message, type = 'info') {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = type;
    
    // Clear status after 3 seconds for non-error messages
    if (type !== 'error') {
      setTimeout(() => {
        if (statusEl.textContent === message) {
          statusEl.textContent = 'Idle';
          statusEl.className = '';
        }
      }, 3000);
    }
  }
  
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function renderLoop() {
  // Render GPU frame
  if (__deviceReady) {
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

// Export backup dialog function to global scope for debugging/manual use
window.showBackupDialog = showBackupDialog;
window.createNewProject = createNewProject;
window.updateStatus = updateStatus;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}