// src/ui/UIHandlerManager.js
import { EventHandlerHelper } from '../utils/AppUtilities.js';

export class UIHandlerManager {
  constructor(dependencies) {
    this.saveLoadManager = dependencies.saveLoadManager;
    this.backupDialog = dependencies.backupDialog;
    this.updateShaderFromGraph = dependencies.updateShaderFromGraph;
    this.graph = dependencies.graph;
    this.editor = dependencies.editor;
    this.reinitializeWebGPUAfterLoad = dependencies.reinitializeWebGPUAfterLoad;
  }

  setupAllHandlers() {
    console.log('Setting up UI event handlers...');
    
    if (!this.saveLoadManager) {
      console.error('SaveLoadManager not available!');
      return;
    }

    this.setupSaveLoadHandlers();
    this.setupExportHandlers();
    this.setupOtherHandlers();

    console.log('=== ALL HANDLERS SETUP COMPLETE ===');
  }

  setupSaveLoadHandlers() {
    // Save Project button
    const saveBtn = EventHandlerHelper.removeExistingHandlers('btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('=== SAVE BUTTON CLICKED ===');
        this.saveLoadManager.saveToFile();
      });
      console.log('Save button handler attached (clean)');
    }

    // Load Project button  
    const loadBtn = EventHandlerHelper.removeExistingHandlers('btn-load');
    if (loadBtn) {
      loadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('=== LOAD BUTTON CLICKED ===');
        EventHandlerHelper.triggerFileLoad();
      });
      console.log('Load button handler attached (clean)');
    }

    // File input change handler
    this.setupFileInputHandler();

    // Import button
    const importBtn = EventHandlerHelper.removeExistingHandlers('btn-import');
    if (importBtn) {
      importBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Import button clicked');
        EventHandlerHelper.triggerFileLoad();
      });
      console.log('Import button handler attached (clean)');
    }
  }

  setupFileInputHandler() {
    const fileInput = EventHandlerHelper.removeExistingHandlers('file-import');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          await this.handleFileLoad(file);
          e.target.value = '';
        }
      });
      console.log('File input handler attached (clean)');
    }
  }

  async handleFileLoad(file) {
    console.log('=== FILE SELECTED ===', file.name);
    
    try {
      await this.saveLoadManager.loadFromFile(file);
      
      // CRITICAL: Reinitialize WebGPU after loading
      console.log('=== REINITIALIZING WEBGPU ===');
      const webgpuSuccess = await this.reinitializeWebGPUAfterLoad();
      
      if (webgpuSuccess) {
        console.log('✅ WebGPU reinitialized successfully after load');
      } else {
        console.error('❌ Failed to reinitialize WebGPU after load');
      }
      
      await this.forceNodeRecalculation();
      console.log('=== LOAD COMPLETE ===');
      
    } catch (error) {
      console.error('Load failed:', error);
    }
  }

  async forceNodeRecalculation() {
    console.log('=== FORCING NODE RECALCULATION ===');
    if (!this.graph || !this.graph.nodes) return;

    // Clear cached values
    this.graph.nodes.forEach(node => {
      delete node.cachedValue;
      delete node.cached;
      node.needsUpdate = true;
    });
    
    await this.triggerPreviewRefresh();
    await this.refreshNodePreviews();
    await this.autoRefreshWithConnectionSimulation();
    
    // Final update
    setTimeout(() => {
      if (window.updateShaderFromGraph) {
        this.updateShaderFromGraph();
      }
    }, 50);
  }

  async triggerPreviewRefresh() {
    console.log('=== TRIGGERING PREVIEW REFRESH ===');
    // Find any node with a connection and briefly disconnect it to unlock previews
    const nodeWithConnection = this.graph.nodes.find(node => 
      node.inputs && node.inputs.some(input => input !== null)
    );

    if (nodeWithConnection) {
      const inputIndex = nodeWithConnection.inputs.findIndex(input => input !== null);
      const originalInput = nodeWithConnection.inputs[inputIndex];
      
      // Disconnect briefly to trigger global preview unlock
      nodeWithConnection.inputs[inputIndex] = null;
      
      setTimeout(() => {
        // Reconnect
        nodeWithConnection.inputs[inputIndex] = originalInput;
        if (this.editor.draw) {
          this.editor.draw();
        }
      }, 10);
    }
  }

  async refreshNodePreviews() {
    console.log('=== REFRESHING NODE PREVIEWS ===');
    if (!this.editor || !this.editor.nodePreviews) return;

    // Force refresh all node previews
    this.graph.nodes.forEach(node => {
      if (this.editor.nodePreviews.has(node.id)) {
        // Get existing preview settings
        const preview = this.editor.nodePreviews.get(node.id);
        // Force refresh by removing and re-adding
        this.editor.nodePreviews.delete(node.id);
        this.editor.nodePreviews.set(node.id, {
          enabled: preview.enabled,
          size: preview.size || 'small',
          showVisualInfo: preview.showVisualInfo !== false,
          needsUpdate: true
        });
      } else {
        // Create preview for nodes that don't have one
        this.editor.nodePreviews.set(node.id, {
          enabled: true,
          size: 'small',
          showVisualInfo: true,
          needsUpdate: true
        });
      }
    });
    
    // Force editor redraw to update previews
    setTimeout(() => {
      if (this.editor.draw) {
        this.editor.draw();
      }
    }, 100);
  }

  async autoRefreshWithConnectionSimulation() {
    console.log('=== AUTO-REFRESHING NODE PREVIEWS ===');
    this.graph.nodes.forEach(node => {
      if (node.inputs) {
        node.inputs.forEach((input, index) => {
          if (input) {
            const originalInput = input;
            // Disconnect
            node.inputs[index] = null;
            // Reconnect immediately
            setTimeout(() => {
              node.inputs[index] = originalInput;
              if (this.editor.draw) {
                this.editor.draw();
              }
            }, 5);
          }
        });
      }
    });
  }

  setupExportHandlers() {
    // Export JSON button
    const exportJsonBtn = EventHandlerHelper.removeExistingHandlers('btn-export-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Export JSON clicked');
        this.saveLoadManager.saveToFile(null, 'json');
      });
      console.log('Export JSON handler attached (clean)');
    }

    // Export WGSL button
    const exportWgslBtn = EventHandlerHelper.removeExistingHandlers('btn-export-wgsl');
    if (exportWgslBtn) {
      exportWgslBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Export WGSL clicked');
        this.saveLoadManager.saveToFile(null, 'wgsl');
      });
      console.log('Export WGSL handler attached (clean)');
    }
  }

  setupOtherHandlers() {
    // Backups button
    const backupsBtn = EventHandlerHelper.removeExistingHandlers('btn-backups');
    if (backupsBtn && this.backupDialog) {
      backupsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Backups button clicked');
        this.backupDialog.show();
      });
      console.log('Backups button handler attached (clean)');
    }

    // Rebuild button
    const rebuildBtn = EventHandlerHelper.removeExistingHandlers('btn-rebuild');
    if (rebuildBtn) {
      rebuildBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Rebuild button clicked');
        this.updateShaderFromGraph();
      });
      console.log('Rebuild button handler attached (clean)');
    }
  }
}