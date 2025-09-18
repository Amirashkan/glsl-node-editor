async function reinitializeWebGPUAfterLoad() {
  console.log("🔧 Reinitializing WebGPU after file load...");
  
  // Clean up any duplicate canvases
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
  
  // Get the remaining canvas
  const canvas = document.getElementById('gpu-canvas');
  if (!canvas) {
    console.error("❌ No GPU canvas found after cleanup");
    return false;
  }
  
  // Force WebGPU reinitialization
  try {
    console.log("🔄 Reinitializing WebGPU...");
    
    // Reinitialize WebGPU with the canvas - adjust the path to match your file structure
    const device = await initWebGPU(canvas); // This should call your existing initWebGPU function
    
    if (device) {
      console.log("✅ WebGPU reinitialized successfully");
      
      // Force a shader update to test
      console.log("🔄 Testing shader update...");
      updateShaderFromGraph();
      
      return true;
    } else {
      console.error("❌ Failed to reinitialize WebGPU");
      return false;
    }
  } catch (error) {
    console.error("❌ Error reinitializing WebGPU:", error);
    return false;
  }
}


export class SaveLoadManager {
  constructor(editor, graph, updateCallback) {
    this.editor = editor;
    this.graph = graph;
    this.updateCallback = updateCallback || (() => {});
    this.autosaveKey = 'rhizomium.autosave.v2';
    this.backupsKey = 'rhizomium.backups.v2';
    this.projectsKey = 'rhizomium.projects.v2';
    
    // Auto-save settings
    this.autosaveInterval = 30000; // 30 seconds
    this.maxBackups = 10;
    this.hasUnsavedChanges = false;
    
    this.setupAutoSave();
    this.setupUnloadHandler();
  }

  // =============================================================================
  // CORE SAVE/LOAD FUNCTIONALITY
  // =============================================================================

  /**
   * Export current graph to a standardized project format
   */
  exportProject(options = {}) {
    const {
      includeMetadata = true,
      includePreviews = false,
      includeViewport = true
    } = options;

    try {
      const projectData = {
        app: 'Rhizomium-Web',
        version: 2, // Updated version
        format: 'rhizomium-project',
        savedAt: new Date().toISOString(),
        
        // Core graph data
        nodes: this.exportNodes(),
        connections: this.exportConnections(),
        
        // Editor state
        ...(includeViewport && { 
          viewport: this.exportViewport() 
        }),
        
        // Metadata
        ...(includeMetadata && { 
          metadata: this.exportMetadata() 
        }),
        
        // Preview data (optional, can be large)
        ...(includePreviews && { 
          previews: this.exportPreviews() 
        })
      };

      return projectData;
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error(`Failed to export project: ${error.message}`);
    }
  }

  /**
   * Import project data and apply to current editor
   */
// Replace your importProject method in SaveLoadManager.js with this:

  /**
   * Import project data and apply to current editor
   *
   */
  
  
  


  
  
  
  async importProject(projectData, options = {}) {
    const {
      clearExisting = true,
      validateData = true,
      restoreViewport = true,
      restorePreviews = false
    } = options;

    try {
      // Validate project data
      if (validateData) {
        this.validateProjectData(projectData);
      }

      // Clear existing graph if requested
      if (clearExisting) {
        this.clearGraph();
      }

      // Import core data
      this.importNodes(projectData.nodes || []);
      this.importConnections(projectData.connections || []);

      // Restore viewport
      if (restoreViewport && projectData.viewport) {
        this.importViewport(projectData.viewport);
      }

      // Restore previews if requested
      if (restorePreviews && projectData.previews) {
        this.importPreviews(projectData.previews);
      }

      // CRITICAL: Force shader rebuild after loading
      console.log('Forcing shader update after project load...');
      
      // Method 1: Try the callback
      if (this.updateCallback) {
        await this.updateCallback();
      }
      
      // Method 2: Force update via global function (more reliable)
      if (typeof window.updateShaderFromGraph === 'function') {
        await window.updateShaderFromGraph();
      } else if (typeof window.rebuild === 'function') {
        await window.rebuild();
      }
      
      // Method 3: Manual shader build if needed
      if (typeof window.buildWGSL === 'function' && typeof window.updateShader === 'function') {
        try {
          const wgsl = window.buildWGSL(this.graph);
          await window.updateShader(wgsl);
          console.log('Manual shader update successful');
        } catch (error) {
          console.warn('Manual shader update failed:', error);
        }
      }

      // Force editor redraw
      if (this.editor && this.editor.draw) {
        this.editor.draw();
      }

      // Force preview updates if available
      if (this.editor && this.editor.previewIntegration) {
        if (typeof this.editor.previewIntegration.onShaderUpdate === 'function') {
          this.editor.previewIntegration.onShaderUpdate();
        }
      }

      // Update any floating previews
      if (window.floatingPreview && window.floatingPreview.refresh) {
        window.floatingPreview.refresh();
      }

      this.hasUnsavedChanges = false;
      this.updateStatus('Project loaded successfully');
      
      console.log('Project import completed with shader update');
      return true;
      
    } catch (error) {
      console.error('Import failed:', error);
      this.updateStatus(`Import failed: ${error.message}`, 'error');
      throw new Error(`Failed to import project: ${error.message}`);
    }
  }
















  
  // =============================================================================
  // FILE OPERATIONS
  // =============================================================================

  /**
   * Save project to file download
   */
  saveToFile(filename = null, format = 'json') {
    try {
      const projectData = this.exportProject();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      
      let content, mimeType, extension;
      
      switch (format) {
        case 'json':
          content = JSON.stringify(projectData, null, 2);
          mimeType = 'application/json';
          extension = 'json';
          break;
          
        case 'rhizomium':
          content = JSON.stringify(projectData, null, 2);
          mimeType = 'application/json';
          extension = 'rz';
          break;
          
        case 'wgsl':
          content = this.exportWGSL();
          mimeType = 'text/plain';
          extension = 'wgsl';
          break;
          
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      const finalFilename = filename || `rhizomium-project-${timestamp}.${extension}`;
      this.downloadFile(content, finalFilename, mimeType);
      
      this.hasUnsavedChanges = false;
      this.updateStatus(`Project saved as ${finalFilename}`);
      
    } catch (error) {
      console.error('Save to file failed:', error);
      this.updateStatus(`Save failed: ${error.message}`, 'error');
    }
  }

  /**
   * Load project from file
   */
  async loadFromFile(file) {
    try {
      this.updateStatus('Loading project...');
      
      const content = await this.readFile(file);
      const extension = file.name.split('.').pop().toLowerCase();
      
      let projectData;
      
      switch (extension) {
        case 'json':
        case 'rz':
          projectData = JSON.parse(content);
          break;
          
        case 'wgsl':
        case 'glsl':
          // Import as shader code - create a basic project structure
          projectData = this.createProjectFromShader(content, extension);
          break;
          
        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }

      await this.importProject(projectData);
      this.updateStatus(`Loaded ${file.name}`);
      
    } catch (error) {
      console.error('Load from file failed:', error);
      this.updateStatus(`Load failed: ${error.message}`, 'error');
    }
  }

  // =============================================================================
  // LOCAL STORAGE OPERATIONS
  // =============================================================================

  /**
   * Save project to localStorage
   */
  saveToLocal(key = null) {
    try {
      const projectData = this.exportProject();
      const storageKey = key || this.autosaveKey;
      
      localStorage.setItem(storageKey, JSON.stringify({
        data: projectData,
        timestamp: Date.now(),
        version: 2
      }));
      
      this.hasUnsavedChanges = false;
      this.updateStatus('Project saved locally');
      
    } catch (error) {
      console.error('Local save failed:', error);
      this.updateStatus(`Local save failed: ${error.message}`, 'error');
    }
  }

  /**
   * Load project from localStorage
   */
  async loadFromLocal(key = null) {
    try {
      const storageKey = key || this.autosaveKey;
      const stored = localStorage.getItem(storageKey);
      
      if (!stored) {
        this.updateStatus('No local save found', 'warning');
        return false;
      }

      const { data, timestamp } = JSON.parse(stored);
      const age = Date.now() - timestamp;
      const ageText = this.formatAge(age);
      
      await this.importProject(data);
      this.updateStatus(`Loaded local save (${ageText} ago)`);
      
      return true;
    } catch (error) {
      console.error('Local load failed:', error);
      this.updateStatus(`Local load failed: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Create backup of current project
   */
  createBackup(reason = 'manual') {
    try {
      const backups = this.getBackups();
      const projectData = this.exportProject();
      
      const backup = {
        id: this.generateId(),
        data: projectData,
        timestamp: Date.now(),
        reason: reason,
        nodeCount: projectData.nodes.length,
        connectionCount: projectData.connections.length
      };
      
      backups.unshift(backup);
      
      // Keep only recent backups
      if (backups.length > this.maxBackups) {
        backups.splice(this.maxBackups);
      }
      
      localStorage.setItem(this.backupsKey, JSON.stringify(backups));
      
    } catch (error) {
      console.warn('Backup creation failed:', error);
    }
  }

  /**
   * Get list of available backups
   */
  getBackups() {
    try {
      const stored = localStorage.getItem(this.backupsKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load backups:', error);
      return [];
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId) {
    try {
      const backups = this.getBackups();
      const backup = backups.find(b => b.id === backupId);
      
      if (!backup) {
        throw new Error('Backup not found');
      }
      
      await this.importProject(backup.data);
      this.updateStatus(`Restored backup from ${new Date(backup.timestamp).toLocaleString()}`);
      
    } catch (error) {
      console.error('Backup restore failed:', error);
      this.updateStatus(`Restore failed: ${error.message}`, 'error');
    }
  }

  // =============================================================================
  // AUTO-SAVE SYSTEM
  // =============================================================================

  setupAutoSave() {
    // Auto-save interval
    setInterval(() => {
      if (this.hasUnsavedChanges) {
        this.saveToLocal();
        this.createBackup('autosave');
      }
    }, this.autosaveInterval);
    
    // Mark changes when graph is modified
    const originalOnChange = this.updateCallback;
    this.updateCallback = (...args) => {
      this.hasUnsavedChanges = true;
      return originalOnChange(...args);
    };
  }

  setupUnloadHandler() {
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges) {
        this.saveToLocal();
        // Don't show dialog - just save silently
      }
    });
  }

  /**
   * Check if autosave is available
   */
  hasAutosave() {
    return !!localStorage.getItem(this.autosaveKey);
  }

  /**
   * Get autosave age in milliseconds
   */
  getAutosaveAge() {
    try {
      const stored = localStorage.getItem(this.autosaveKey);
      if (!stored) return null;
      
      const { timestamp } = JSON.parse(stored);
      return Date.now() - timestamp;
    } catch (error) {
      return null;
    }
  }

  // =============================================================================
  // DATA EXPORT/IMPORT HELPERS
  // =============================================================================

  exportNodes() {
    return (this.graph.nodes || []).map(node => ({
      id: node.id,
      kind: node.kind,
      position: { x: node.x || 0, y: node.y || 0 },
      size: { width: node.w || 180, height: node.h || 60 },
      
      // Node-specific properties
      ...(node.value !== undefined && { value: node.value }),
      ...(node.xv !== undefined && { xv: node.xv }),
      ...(node.yv !== undefined && { yv: node.yv }),
      ...(node.expr && { expr: node.expr }),
      ...(node.props && { props: { ...node.props } }),
      
      // Input connections
      inputs: (node.inputs || []).map((input, index) => ({
        index,
        connected: !!input,
        ...(input && {
          from: { nodeId: input.from, pin: input.pin }
        })
      }))
    }));
  }

  exportConnections() {
    return (this.graph.connections || []).map(conn => ({
      from: {
        nodeId: conn.from.nodeId,
        pin: conn.from.pin || 0
      },
      to: {
        nodeId: conn.to.nodeId,
        pin: conn.to.pin || 0
      }
    }));
  }

  exportViewport() {
    if (!this.editor || !this.editor.viewport) return null;
    
    const vp = this.editor.viewport;
    return {
      pan: { x: vp.panX || 0, y: vp.panY || 0 },
      zoom: vp.zoom || 1
    };
  }

  exportMetadata() {
    return {
      created: new Date().toISOString(),
      nodeCount: (this.graph.nodes || []).length,
      connectionCount: (this.graph.connections || []).length,
      editorVersion: '3.0',
      platform: navigator.platform,
      userAgent: navigator.userAgent.slice(0, 100) // Truncated for privacy
    };
  }

  exportPreviews() {
    if (!this.editor || !this.editor.nodePreviews) return {};
    
    const previews = {};
    for (const [nodeId, preview] of this.editor.nodePreviews) {
      if (preview.enabled) {
        previews[nodeId] = {
          size: preview.size,
          showVisualInfo: preview.showVisualInfo
        };
      }
    }
    return previews;
  }

  exportWGSL() {
    // Use your existing WGSL builder
    if (typeof window.buildWGSL === 'function') {
      return window.buildWGSL(this.graph);
    }
    
    // Fallback - get from code element
    const codeEl = document.getElementById('code');
    return codeEl ? codeEl.textContent : '// No WGSL available';
  }

  // =============================================================================
  // DATA IMPORT HELPERS
  // =============================================================================

async importNodes(nodeData) {
  this.graph.nodes = (nodeData || []).map(data => {
    // Create node with proper type/kind properties
    const node = {
      id: data.id,
      type: data.kind || 'Unknown',  // Set BOTH type and kind
      kind: data.kind || 'Unknown',
      x: data.position?.x || data.x || 0,
      y: data.position?.y || data.y || 0,
      w: data.size?.width || data.w || 180,
      h: data.size?.height || data.h || 60,
      inputs: [],
      outputs: []
    };

    // Restore node-specific properties
    if (data.value !== undefined) node.value = data.value;
    if (data.xv !== undefined) node.xv = data.xv;
    if (data.yv !== undefined) node.yv = data.yv;
    if (data.expr) node.expr = data.expr;
    if (data.props) node.props = { ...data.props };

    // Set up inputs array - make sure it's the right length
    const inputCount = data.inputs?.length || 0;
    node.inputs = new Array(inputCount).fill(null).map(() => ({
      connection: null,
      value: undefined
    }));

    return node;
  });
  
  console.log('Nodes imported with types:', this.graph.nodes.map(n => ({ id: n.id, type: n.type, kind: n.kind })));
}
importConnections(connectionData) {
  this.graph.connections = [...(connectionData || [])];
  
  // Create a map of nodeId -> node for fast lookup
  const nodeMap = new Map(this.graph.nodes.map(n => [n.id, n]));
  
  // Set up the simple input format that matches the original working version
  for (const conn of this.graph.connections) {
    const toNode = nodeMap.get(conn.to.nodeId);
    if (toNode && toNode.inputs) {
      const toPin = conn.to.pin || 0;
      const fromNodeId = String(conn.from.nodeId); // Convert to string to match original format
      
      // Make sure inputs array is long enough
      while (toNode.inputs.length <= toPin) {
        toNode.inputs.push(null);
      }
      
      // Use the simple format: just store the source node ID as a string
      toNode.inputs[toPin] = fromNodeId;
      
      console.log(`Connected: node ${fromNodeId} → node ${toNode.id} input ${toPin}`);
    }
  }
  
  console.log('Connections imported using simple ID format');
}

  importViewport(viewportData) {
    if (!this.editor?.viewport) return;
    
    const vp = this.editor.viewport;
    if (viewportData.pan) {
      vp.panX = viewportData.pan.x || 0;
      vp.panY = viewportData.pan.y || 0;
    }
    if (viewportData.zoom) {
      vp.zoom = viewportData.zoom;
    }
  }

  importPreviews(previewData) {
    if (!this.editor?.nodePreviews) return;
    
    for (const [nodeId, previewSettings] of Object.entries(previewData)) {
      this.editor.nodePreviews.set(nodeId, {
        enabled: true,
        size: previewSettings.size || 'small',
        showVisualInfo: previewSettings.showVisualInfo !== false
      });
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  validateProjectData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid project data');
    }
    
    if (!Array.isArray(data.nodes)) {
      throw new Error('Project must contain nodes array');
    }
    
    if (!Array.isArray(data.connections)) {
      throw new Error('Project must contain connections array');
    }
    
    // Version compatibility check
    if (data.version && data.version > 2) {
      console.warn('Loading project from newer version - some features may not work correctly');
    }
  }

  clearGraph() {
    this.graph.nodes = [];
    this.graph.connections = [];
    this.graph.selection = new Set();
    
    if (this.editor) {
      if (this.editor.selection?.clear) {
        this.editor.selection.clear();
      }
      if (this.editor.nodePreviews) {
        this.editor.nodePreviews.clear();
      }
    }
  }

  createProjectFromShader(shaderCode, type) {
    // Create a basic project with a text/output node containing the shader
    return {
      app: 'Rhizomium-Web',
      version: 2,
      format: 'imported-shader',
      savedAt: new Date().toISOString(),
      nodes: [{
        id: this.generateId(),
        kind: 'TextOutput',
        position: { x: 100, y: 100 },
        size: { width: 300, height: 200 },
        expr: shaderCode
      }],
      connections: [],
      metadata: {
        imported: true,
        originalType: type,
        created: new Date().toISOString()
      }
    };
  }

  async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  updateStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = type;
      
      // Clear status after 3 seconds
      setTimeout(() => {
        if (statusEl.textContent === message) {
          statusEl.textContent = 'Idle';
          statusEl.className = '';
        }
      }, 3000);
    }
    
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  formatAge(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  generateId() {
    return Math.random().toString(36).slice(2, 15);
  }
}