// src/utils/AppUtilities.js
// Extracted utility functions from main.js - no behavior changes

export class DragPrevention {
  static setup() {
    // Prevent default browser drag behavior globally
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, this.preventDefaults, false);
    });
    
    // Only allow drops on designated drop zones
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Check if drop target is a valid drop zone
      const dropZone = e.target.closest('.file-drop-zone');
      if (!dropZone) {
        console.log('Drop ignored - not on a valid drop zone');
        return false;
      }
    });
    
    console.log('Global drag prevention setup complete');
  }
  
  static preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
}

export class CanvasCleanup {
  static cleanupDuplicateCanvases() {
    const allCanvases = document.querySelectorAll('#gpu-canvas');
    console.log(`Found ${allCanvases.length} canvas elements with gpu-canvas id`);
    
    if (allCanvases.length > 1) {
      console.log("⚠️ Multiple canvases detected, cleaning up...");
      // Remove all but the first one
      for (let i = 1; i < allCanvases.length; i++) {
        allCanvases[i].remove();
        console.log(`Removed duplicate canvas ${i}`);
      }
    }
    
    // Return the remaining canvas
    const canvas = document.getElementById('gpu-canvas');
    if (!canvas) {
      console.error("❌ No GPU canvas found after cleanup");
      return null;
    }
    
    return canvas;
  }
}

export class EventHandlerHelper {
  // Helper to prevent double handlers by cloning elements
  static removeExistingHandlers(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      // Clone and replace to remove all listeners
      const newEl = el.cloneNode(true);
      el.parentNode.replaceChild(newEl, el);
      return newEl;
    }
    return null;
  }
  
  // Helper to trigger file selection reliably
  static triggerFileLoad() {
    const fileInput = document.getElementById('file-import');
    if (fileInput) {
      fileInput.value = '';
      setTimeout(() => {
        fileInput.click();
      }, 10);
    }
  }
}

export class StatusManager {
  static update(message, type = 'info') {
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
  
  static showShaderError(errorMessage) {
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
}

export class RhizomiumDisabler {
  static disable() {
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
  }
  
  static setupPeriodicCleanup() {
    // Periodic cleanup of RhizomiumLoader interference
    setInterval(() => {
      const pill = document.getElementById('rz-fallback-pill');
      if (pill && pill.style.display !== 'none') {
        pill.remove();
        console.log('Removed late RhizomiumLoader interference');
      }
    }, 2000);
  }
}

export class ProjectManager {
  static create(graph, editor, saveLoadManager, updateShaderFromGraph) {
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
    const { SeedGraphBuilder } = require('../utils/SeedGraphBuilder.js');
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
}