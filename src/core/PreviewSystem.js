// PreviewSystem.js - Refactored Architecture

import { NodeThumbnailRenderer } from './renderers/NodeThumbnailRenderer.js';
import { TextureRenderer } from './renderers/TextureRenderer.js';
import { CanvasManager } from './utils/CanvasManager.js';
import { PreviewComputerAdapter } from './utils/PreviewComputerAdapter.js';

export class PreviewSystem {
  constructor(editor) {
    this.editor = editor;
    this.size = 48;
    
    // Use existing systems instead of duplicating logic
    this.previewComputer = new PreviewComputerAdapter();
    this.canvasManager = new CanvasManager(this.size);
    this.textureRenderer = new TextureRenderer(editor.textureManager);
    this.thumbnailRenderer = new NodeThumbnailRenderer();
  }
  // Main public method - simplified and delegated
  generateNodePreview(node) {
    if (!this.editor.isPreviewEnabled) {
      node.__thumb = null;
      return;
    }

    try {
      // Use PreviewComputer for value calculation (no duplication)
      const computedValue = this.previewComputer.computeNodeValue(node, this.editor.graph);
      
      // Get or create canvas
      const canvas = this.canvasManager.getCanvas(node.id);
      const ctx = canvas.getContext('2d');
      
      // Route to appropriate renderer
      if (this.isTextureNode(node)) {
        this.textureRenderer.render(ctx, node, this.size);
      } else {
        this.thumbnailRenderer.render(ctx, node, computedValue, this.size);
      }
      
      node.__thumb = canvas;
      
    } catch (error) {
      console.warn('Preview failed:', node.kind, error);
      node.__thumb = this.createErrorThumbnail(node);
    }
  }

  // Update all previews - delegates to existing PreviewComputer
  updateAllPreviews() {
    if (!this.editor.graph?.nodes) return;
    
    // Generate thumbnails for each node
    this.editor.graph.nodes.forEach(node => {
      this.generateNodePreview(node);
    });
    
    this.editor.draw();
  }

  // Helper methods
  isTextureNode(node) {
    return ['texture2d', 'texturecube'].includes(node.kind.toLowerCase());
  }

  createErrorThumbnail(node) {
    const canvas = this.canvasManager.getCanvas(`${node.id}_error`);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#2d1b1b';
    ctx.fillRect(0, 0, this.size, this.size);
    
    ctx.fillStyle = '#ff4444';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ERR', this.size/2, this.size/2);
    
    return canvas;
  }

  clearCache() {
    this.canvasManager.clear();
  }
}

// Integration class - unchanged public API
export class PreviewIntegration {
  constructor(editor) {
    this.editor = editor;
    this.previewSystem = new PreviewSystem(editor);
    
    setTimeout(() => {
      if (this.editor.isPreviewEnabled) {
        this.updateAllPreviews();
      }
    }, 100);
    
    setInterval(() => {
      if (this.editor.isPreviewEnabled) {
        this.updateTimeNodes();
      }
    }, 100);
  }
  
  updateAllPreviews() {
    this.previewSystem.updateAllPreviews();
  }
  
  generateNodePreview(node) {
    this.previewSystem.generateNodePreview(node);
  }
  
  updateTimeNodes() {
    if (!this.editor.graph?.nodes) return;
    
    const timeNodes = this.editor.graph.nodes.filter(n => 
      n.kind.toLowerCase() === 'time'
    );
    
    if (timeNodes.length > 0) {
      timeNodes.forEach(node => this.previewSystem.generateNodePreview(node));
      this.editor.draw();
    }
  }
  
  onParameterChange(node) {
    this.generateNodePreview(node);
    this.updateDependentNodes(node);
  }
  
  updateDependentNodes(changedNode) {
    if (!this.editor.graph?.connections) return;
    
    const dependents = this.editor.graph.connections
      .filter(conn => conn.from.nodeId === changedNode.id)
      .map(conn => conn.to.nodeId);
    
    dependents.forEach(nodeId => {
      const node = this.editor.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        this.generateNodePreview(node);
      }
    });
    
    this.editor.draw();
  }
}