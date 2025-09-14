// src/ui/MenuManager.js
import { NodeDefs, makeNode } from '../data/NodeDefs.js';
import { RadialMenu } from './RadialMenu.js';

let _nextId = 1000;

export class MenuManager {
  constructor(graph, onChange) {
    this.graph = graph;
    this.onChange = onChange;
    this.menuEl = null;
    this.menuFilter = '';
    this.menuPos = { x: 0, y: 0 };
    this.radialMenu = null;
  }

  hide() {
    if (this.menuEl) {
      this.menuEl.remove();
      this.menuEl = null;
    }
    if (this.radialMenu) {
      this.radialMenu.hide();
    }
  }

contains(element) {
  return (this.menuEl && this.menuEl.contains(element)) ||
         (this.radialMenu && this.radialMenu.element && this.radialMenu.element.contains(element));
}

  showCreateMenu(canvasX, canvasY, clientX, clientY) {
    this.menuPos = { x: canvasX, y: canvasY };
    const el = this._createMenuRoot(clientX, clientY);
    el.innerHTML = '';

    // Search input
    const input = document.createElement('input');
    input.className = 'ctx-search';
    input.placeholder = 'Search nodes…';
    input.value = this.menuFilter;
    input.addEventListener('input', () => {
      this.menuFilter = input.value;
      this._renderCreateList(el);
    });
    
    el.appendChild(input);
    this._renderCreateList(el);
    
    // Handle keyboard navigation
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        // TODO: Navigate to first menu item
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        // TODO: Navigate to last menu item
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        // TODO: Select highlighted item
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    });
    
    input.focus();
  }

  showRadialMenu(canvasX, canvasY, clientX, clientY) {
    // Group categories
    const categories = this._groupNodesByCategory();
    
    if (!this.radialMenu) {
      this.radialMenu = new RadialMenu(this.graph, this.onChange);
    }
    
    this.radialMenu.show(canvasX, canvasY, clientX, clientY, categories);
  }

  _groupNodesByCategory() {
    const categories = new Map();
    for (const [kind, def] of Object.entries(NodeDefs)) {
      const cat = def.cat || 'Misc';
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      categories.get(cat).push({ kind, label: def.label || kind });
    }

    // Convert to array format expected by RadialMenu
    const orderedCategories = [
      'Input', 'Math', 'Field', 'Utility', 'Output',
      ...Array.from(categories.keys()).filter(c => 
        !['Input', 'Math', 'Field', 'Utility', 'Output'].includes(c)
      )
    ];

    return orderedCategories.map(categoryName => ({
      name: categoryName,
      items: categories.get(categoryName) || []
    })).filter(cat => cat.items.length > 0);
  }

  showNodeMenu(node, clientX, clientY) {
    const el = this._createMenuRoot(clientX, clientY);
    el.innerHTML = '';
    
    // Ensure node is selected
    if (!this.graph.selection.has(node.id)) {
      this.graph.selection = new Set([node.id]);
    }
    
    el.appendChild(this._createMenuHeader('Node'));
    el.appendChild(this._createMenuItem('Duplicate', () => {
      this._duplicateSelected();
      this.hide();
    }));
    el.appendChild(this._createMenuItem('Delete', () => {
      this.graph.selection = new Set([node.id]);
      this._deleteSelected();
      this.hide();
    }));
  }

  _createMenuRoot(clientX, clientY) {
    this.hide();
    const el = document.createElement('div');
    el.className = 'ctx-menu';
    
    // Add to body to measure dimensions
    document.body.appendChild(el);
    
    // Position off-screen initially to measure
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '-9999px';
    el.style.visibility = 'hidden';
    
    // Force layout
    el.offsetHeight;
    
    // Calculate position with boundary checking
    const menuWidth = 200;
    const menuHeight = 300;
    
    let x = clientX;
    let y = clientY;
    
    // Check boundaries
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    
    // Ensure minimum margins
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    // Apply final position
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.visibility = 'visible';
    
    this.menuEl = el;
    return el;
  }

  _createMenuHeader(text) {
    const h = document.createElement('div');
    h.className = 'ctx-header';
    h.textContent = text;
    return h;
  }

  _createMenuItem(text, onClick) {
    const item = document.createElement('div');
    item.className = 'ctx-item';
    item.textContent = text;
    item.addEventListener('click', onClick);
    return item;
  }

  _renderCreateList(el) {
    // Remove existing items (keep search input)
    const items = el.querySelectorAll('.ctx-header, .ctx-item');
    items.forEach(item => item.remove());
    
    // Group nodes by category
    const categories = new Map();
    for (const [kind, def] of Object.entries(NodeDefs)) {
      const cat = def.cat || 'Misc';
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      categories.get(cat).push({ kind, label: def.label || kind });
    }
    
    // Sort items within each category
    for (const items of categories.values()) {
      items.sort((a, b) => a.label.localeCompare(b.label));
    }
    
    // Filter items based on search
    const filter = (this.menuFilter || '').trim().toLowerCase();
    const matches = (item) => {
      if (!filter) return true;
      return item.label.toLowerCase().includes(filter) || 
             item.kind.toLowerCase().includes(filter);
    };
    
    // Render categories in preferred order
    const orderedCategories = [
      'Input', 'Math', 'Field', 'Utility', 'Output',
      ...Array.from(categories.keys()).filter(c => 
        !['Input', 'Math', 'Field', 'Utility', 'Output'].includes(c)
      )
    ];
    
    for (const categoryName of orderedCategories) {
      const items = categories.get(categoryName);
      if (!items) continue;
      
      const visibleItems = items.filter(matches);
      if (visibleItems.length === 0) continue;
      
      // Add category header
      el.appendChild(this._createMenuHeader(categoryName));
      
      // Add category items
      for (const item of visibleItems) {
        el.appendChild(this._createMenuItem(item.label, () => {
          this._createNode(item.kind);
          this.hide();
        }));
      }
    }
  }

  _createNode(kind) {
    const node = makeNode(kind, this.menuPos.x, this.menuPos.y);
    this.graph.nodes.push(node);
    this.graph.selection = new Set([node.id]);
    
    if (this.onChange) this.onChange();
  }

  _duplicateSelected() {
    const ids = Array.from(this.graph.selection || []);
    if (!ids.length) return;
    
    const idSet = new Set(ids);
    const mapOldToNew = new Map();
    const clones = [];
    
    // Clone nodes
    for (const n of this.graph.nodes) {
      if (!idSet.has(n.id)) continue;
      
      const c = JSON.parse(JSON.stringify(n));
      c.id = String(++_nextId);
      c.x = (n.x || 0) + 20;
      c.y = (n.y || 0) + 20;
      clones.push(c);
      mapOldToNew.set(n.id, c.id);
    }
    
    // Add clones to graph
    this.graph.nodes.push(...clones);
    
    // Clone connections between selected nodes
    const newConns = [];
    for (const c of this.graph.connections) {
      const fromNew = mapOldToNew.get(c.from.nodeId);
      const toNew = mapOldToNew.get(c.to.nodeId);
      if (fromNew && toNew) {
        newConns.push({
          from: { nodeId: fromNew, pin: c.from.pin },
          to: { nodeId: toNew, pin: c.to.pin }
        });
      }
    }
    
    this.graph.connections.push(...newConns);
    this.graph.selection = new Set(clones.map(n => n.id));
    
    if (this.onChange) this.onChange();
  }

  _deleteSelected() {
    const ids = new Set(this.graph.selection);
    if (ids.size === 0) return;
    
    // Remove connections involving selected nodes
    this.graph.connections = this.graph.connections.filter(c => 
      !(ids.has(c.from.nodeId) || ids.has(c.to.nodeId))
    );
    
    // Remove nodes
    this.graph.nodes = this.graph.nodes.filter(n => !ids.has(n.id));
    this.graph.selection.clear();
    
    if (this.onChange) this.onChange();
  }
}