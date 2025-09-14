// src/core/Editor.js
import { EventHandler } from './EventHandler.js';
import { Renderer } from './Renderer.js';
import { MenuManager } from '../ui/MenuManager.js';
import { ParameterPanel } from '../ui/ParameterPanel.js';
import { SelectionManager } from './SelectionManager.js';
import { ConnectionManager } from './ConnectionManager.js';
import { ViewportManager } from './ViewportManager.js';

export class Editor {
  constructor(graph, onChange) {
    this.graph = graph;
    this.onChange = typeof onChange === 'function' ? onChange : () => {};
    
    // Get canvas and context
    this.canvas = document.getElementById('ui-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Initialize managers
    this.viewport = new ViewportManager();
    this.selection = new SelectionManager(this.graph, this.onChange);
    this.connections = new ConnectionManager(this.graph, this.onChange);
    this.renderer = new Renderer(this.ctx, this.viewport);
    this.menu = new MenuManager(this.graph, this.onChange);
    this.paramPanel = new ParameterPanel(this.graph, this.onChange);
    
    // Initialize event handling
    this.eventHandler = new EventHandler({
      canvas: this.canvas,
      viewport: this.viewport,
      selection: this.selection,
      connections: this.connections,
      menu: this.menu,
      paramPanel: this.paramPanel,
      onChange: this.onChange,
      onDraw: () => this.draw()
    });
    
    // Setup and initial render
    this.resize();
    window.addEventListener('resize', () => {
      this.resize();
      this.draw();
    });
  }

  // ---- Public API ----
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  draw() {
    this.renderer.render(this.graph, {
      selection: this.selection.getSelected(),
      dragWire: this.connections.getDragWire(),
      boxSelect: this.selection.getBoxSelect()
    });
  }

  // ---- Selection API ----
  selectAll() {
    this.selection.selectAll();
  }

  moveSelection(dx, dy) {
    this.selection.moveSelected(dx, dy);
  }

  duplicateSelected() {
    this.selection.duplicateSelected();
  }

  // ---- Legacy compatibility methods ----
  undo() {}
  redo() {}
  copySelected() {}
  pasteAtCursor() {}
}