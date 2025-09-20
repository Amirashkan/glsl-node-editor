// src/core/utils/CanvasManager.js

export class CanvasManager {
  constructor(defaultSize = 48) {
    this.canvasCache = new Map();
    this.defaultSize = defaultSize;
  }

  getCanvas(id, size = this.defaultSize) {
    const key = `${id}_${size}`;
    
    if (!this.canvasCache.has(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      this.canvasCache.set(key, canvas);
    }
    
    return this.canvasCache.get(key);
  }

  hasCanvas(id, size = this.defaultSize) {
    const key = `${id}_${size}`;
    return this.canvasCache.has(key);
  }

  removeCanvas(id, size = this.defaultSize) {
    const key = `${id}_${size}`;
    this.canvasCache.delete(key);
  }

  clear() {
    this.canvasCache.clear();
  }

  getSize() {
    return this.canvasCache.size;
  }

  // Clean up canvases for nodes that no longer exist
  cleanup(existingNodeIds) {
    const keysToDelete = [];
    
    for (const key of this.canvasCache.keys()) {
      const nodeId = key.split('_')[0];
      if (!existingNodeIds.includes(nodeId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.canvasCache.delete(key));
    
    return keysToDelete.length;
  }
}