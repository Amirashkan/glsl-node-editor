// src/core/EventHandler.js
export class EventHandler {
  constructor(options) {
    this.canvas = options.canvas;
    this.viewport = options.viewport;
    this.selection = options.selection;
    this.connections = options.connections;
    this.menu = options.menu;
    this.paramPanel = options.paramPanel;
    this.onChange = options.onChange;
    this.onDraw = options.onDraw;
    
    this._setupEvents();
  }

  _setupEvents() {
    // Pan handling (Alt + Left Mouse)
    this._setupPanEvents();
    
    // Zoom handling (Mouse Wheel)
    this._setupZoomEvents();
    
    // Main interaction events
    this._setupMouseEvents();
    
    // Keyboard events
    this._setupKeyboardEvents();
    
    // Global click handling for menu closing
    this._setupGlobalEvents();
  }

  _setupPanEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && e.altKey) {
        this.viewport.startPan(e.clientX, e.clientY);
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    window.addEventListener('mouseup', () => {
      this.viewport.stopPan();
    }, true);

    window.addEventListener('mousemove', (e) => {
      if (this.viewport.updatePan(e.clientX, e.clientY)) {
        this.onDraw();
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  _setupZoomEvents() {
    this.canvas.addEventListener('wheel', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      if (this.viewport.zoom(mx, my, e.deltaY)) {
        this.onDraw();
        e.preventDefault();
      }
    }, { passive: false });
  }

  _setupMouseEvents() {
    // Mouse down - start interactions
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.viewport.isPanning()) {
        e.preventDefault();
        return;
      }
      
      if (e.button === 2) return; // Let context menu handle right-click
      
      this.menu.hide();
      const pos = this._getCanvasPosition(e);

      // Check for output pin drag (wire creation)
      const hitOut = this.connections.hitOutputPin(pos.x, pos.y, this.selection.graph.nodes);
      if (hitOut) {
        this.connections.startWireDrag(hitOut.nodeId, hitOut.pin, pos);
        return;
      }

      // Check for input pin click (connection removal)
      const hitIn = this.connections.hitInputPin(pos.x, pos.y, this.selection.graph.nodes);
      if (hitIn) {
        this.connections.removeConnection(hitIn.nodeId, hitIn.pin);
        this.onDraw();
        return;
      }

      // Check for node click
      const clicked = this._hitNode(pos.x, pos.y);
      if (!clicked) {
        // Start box selection
        this.selection.startBoxSelect(pos.x, pos.y);
        this.onDraw();
        return;
      }

      // Handle double-click for parameter panel
      if (e.detail === 2) {
        this.paramPanel.show(clicked, e.clientX, e.clientY);
        return;
      }

      // Start node drag
      this.selection.startDrag(clicked.id, pos.x, pos.y);
      this.onDraw();
    });

    // Context menu
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const pos = this._getCanvasPosition(e);
      const nodeHit = this._hitNode(pos.x, pos.y);
      
      if (nodeHit) {
        this.menu.showNodeMenu(nodeHit, e.clientX, e.clientY);
      } else {
    this.menu.showRadialMenu(pos.x, pos.y, e.clientX, e.clientY);
      }
    });

    // Mouse move - handle dragging
    window.addEventListener('mousemove', (e) => {
      const pos = this._getCanvasPosition(e);

      // Handle wire dragging
      if (this.connections.getDragWire()) {
        this.connections.updateWireDrag(pos);
        this.onDraw();
        return;
      }

      // Handle box selection
      if (this.selection.getBoxSelect()) {
        this.selection.updateBoxSelect(pos.x, pos.y);
        this.onDraw();
        return;
      }

      // Handle node dragging
      if (this.selection.getDragging()) {
        this.selection.updateDrag(pos.x, pos.y);
        this.onDraw();
      }
    });

    // Mouse up - end interactions
    window.addEventListener('mouseup', (e) => {
      const pos = this._getCanvasPosition(e);

      // End wire drag
      if (this.connections.getDragWire()) {
        const target = this.connections.hitInputPin(pos.x, pos.y, this.selection.graph.nodes);
        this.connections.endWireDrag(pos, target);
        this.onDraw();
      }

      // End box selection
      if (this.selection.getBoxSelect()) {
        this.selection.endBoxSelect();
        this.onDraw();
      }

      // End node dragging
      this.selection.endDrag();
    });
  }

  _setupKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.menu.hide();
        this.paramPanel.hide();
      }
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && 
          document.activeElement === document.body) {
        this.selection.deleteSelected();
        this.onDraw();
      }
    });
  }

  _setupGlobalEvents() {
    document.addEventListener('click', (e) => {
      if (!this.menu.contains(e.target)) {
        this.menu.hide();
      }
      if (!this.paramPanel.contains(e.target)) {
        this.paramPanel.hide();
      }
    });
  }

  // Helper methods
  _getCanvasPosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.target === this.canvas && typeof e.offsetX === 'number') 
      ? e.offsetX 
      : (e.clientX - rect.left);
    const py = (e.target === this.canvas && typeof e.offsetY === 'number') 
      ? e.offsetY 
      : (e.clientY - rect.top);
    
    return this.viewport.screenToCanvas(px, py);
  }

  _hitNode(x, y) {
    for (let i = this.selection.graph.nodes.length - 1; i >= 0; i--) {
      const n = this.selection.graph.nodes[i];
      if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) {
        return n;
      }
    }
    return null;
  }
}