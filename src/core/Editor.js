export const NodeDefs = {
  OutputFinal: { label: 'Output',   cat: 'Output',  inputs: 1, pinsIn: ['color'], pinsOut: [] },
  ConstFloat:  { label: 'Float',    cat: 'Input',   inputs: 0, pinsIn: [],        pinsOut: [{ label: 'v', type: 'f32' }], params: ['value'] },
  ConstVec2:   { label: 'Vec2',     cat: 'Input',   inputs: 0, pinsIn: [],        pinsOut: [{ label: 'v', type: 'vec2' }], params: ['x','y'] },
  UV:          { label: 'UV',       cat: 'Input',   inputs: 0, pinsIn: [],        pinsOut: [{ label: 'uv', type: 'vec2' }] },
  Time:        { label: 'Time',     cat: 'Input',   inputs: 0, pinsIn: [],        pinsOut: [{ label: 't', type: 'f32' }] },
  CircleField: { label: 'Circle',   cat: 'Field',   inputs: 2, pinsIn: ['R','E'], pinsOut: [{ label: 'f', type: 'f32' }] },
  Multiply:    { label: 'Multiply', cat: 'Math',    inputs: 2, pinsIn: ['A','B'], pinsOut: [{ label: 'v', type: 'vec3' }] },
  Add:         { label: 'Add',      cat: 'Math',    inputs: 2, pinsIn: ['A','B'], pinsOut: [{ label: 'v', type: 'vec3' }] },
  Expr:        { label: 'Expr',     cat: 'Utility', inputs: 2, pinsIn: ['a','b'], pinsOut: [{ label: 'f', type: 'f32' }], params: ['expr'] },
  Saturate:    { label: 'Saturate', cat: 'Math',    inputs: 1, pinsIn: ['In'],    pinsOut: [{ label: 'v', type: 'vec3' }] }
};

let _nextId = 1;
export function makeNode(kind, x = 0, y = 0) {
  const def = NodeDefs[kind];
  if (!def) throw new Error(`Unknown node kind: ${kind}`);
  const node = {
    id: String(_nextId++),
    kind,
    x, y, w: 180, h: Math.max(60, 40 + (def.inputs||0)*18),
    inputs: new Array(def.inputs).fill(null),
    params: {},
    expr: def.params?.includes('expr') ? 'a' : undefined,
    value: def.params?.includes('value') ? 0.0 : undefined
  };
  // defaults for CircleField
  if (node.kind === 'CircleField') {
    node.props = node.props || {};
    if (typeof node.props.radius !== 'number')  node.props.radius = 0.25;
    if (typeof node.props.epsilon !== 'number') node.props.epsilon = 0.01;
  }

  return node;
}

export class Graph {
  constructor() {
    this.nodes = [];
    this.connections = []; // {from:{nodeId,pin}, to:{nodeId,pin}}
    this.selection = new Set();
  }
  add(n) { this.nodes.push(n); }
  toJSON() {
    return {
      version: 1,
      nodes: this.nodes,
      connections: this.connections
    };
  }
  static fromJSON(obj) {
    const g = new Graph();
    g.nodes = Array.isArray(obj.nodes) ? obj.nodes : [];
    g.connections = Array.isArray(obj.connections) ? obj.connections : [];
    
    // ensure defaults for CircleField nodes loaded from JSON
    for (const n of g.nodes) {
      if (n && n.kind === 'CircleField') {
        n.props = n.props || {};
        if (typeof n.props.radius !== 'number')  n.props.radius = 0.25;
        if (typeof n.props.epsilon !== 'number') n.props.epsilon = 0.01;
      }
    }
return g;
  }
}

export class Editor {
  constructor(graph, onChange) {
    this._menuFilter=''; this._menuIndex=0; this.graph = graph;
    this.onChange = typeof onChange === 'function' ? onChange : () => {};
    this.canvas = document.getElementById('ui-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this._isPanning = false;

    // Interaction state
    this.dragging = null;         // { id, ox, oy }
    this.dragWire = null;         // { from:{nodeId,pin}, pos:{x,y} }
    this.boxSelect = null;        // { x0,y0,x1,y1 }
    this.menuEl = null;           // context menu DOM
    this.menuFilter = '';
    this.menuPos = { x: 0, y: 0 };

    this._setupEvents();
    this.resize();
    window.addEventListener('resize', () => { this.resize(); this.draw(); });
  }

  // ---- Utilities ----
  _eventPos(e){
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.target === this.canvas && typeof e.offsetX === 'number')
      ? e.offsetX : (e.clientX - rect.left);
    const py = (e.target === this.canvas && typeof e.offsetY === 'number')
      ? e.offsetY : (e.clientY - rect.top);
    return { px, py };
  }
  _toCanvas(px, py) {
    return { x: (px - this.offsetX) / this.scale, y: (py - this.offsetY) / this.scale };
  }

  _pinPositions(n){
    const ins = [];
    for(let i=0;i<(NodeDefs[n.kind]?.inputs||0);i++){
      ins.push({ x: n.x + 8, y: n.y + 32 + i*18 });
    }
    const outs = [];
    const outCount = (NodeDefs[n.kind]?.pinsOut||[]).length || 1;
    for(let i=0;i<outCount;i++){
      outs.push({ x: n.x + n.w - 8, y: n.y + 32 + i*18 });
    }
    return { ins, outs };
  }
  _hitNode(x,y){
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const n = this.graph.nodes[i];
      if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) return n;
    }
    return null;
  }
  _hitInputPin(x,y){
    for(const n of this.graph.nodes){
      const {ins} = this._pinPositions(n);
      for(let i=0;i<ins.length;i++){
        const p = ins[i];
        if((x-p.x)**2 + (y-p.y)**2 < 6*6) return { nodeId: n.id, pin: i };
      }
    }
    return null;
  }
  _hitOutputPin(x,y){
    for(const n of this.graph.nodes){
      const {outs} = this._pinPositions(n);
      for(let i=0;i<outs.length;i++){
        const p = outs[i];
        if((x-p.x)**2 + (y-p.y)**2 < 6*6) return { nodeId: n.id, pin: i };
      }
    }
    return null;
  }

  _updateBoxSelection(){
    if(!this.boxSelect) return;
    const x0 = Math.min(this.boxSelect.x0, this.boxSelect.x1);
    const y0 = Math.min(this.boxSelect.y0, this.boxSelect.y1);
    const x1 = Math.max(this.boxSelect.x0, this.boxSelect.x1);
    const y1 = Math.max(this.boxSelect.y0, this.boxSelect.y1);
    this.graph.selection.clear();
    for(const n of this.graph.nodes){
      const overlap = (n.x + n.w >= x0) && (n.x <= x1) && (n.y + n.h >= y0) && (n.y <= y1);
      if(overlap) this.graph.selection.add(n.id);
    }
    if(this.onChange) this.onChange();
  }

  // ---- Events ----
  _setupEvents() {

    // Alt+LMB Pan
    this.canvas.addEventListener('mousedown', (e)=>{
      if (e.button===0 && e.altKey){
        this._isPanning = true;
        this._panStart = {x:e.clientX, y:e.clientY, ox:this.offsetX, oy:this.offsetY};
        e.preventDefault(); e.stopPropagation(); return;
      }
    }, true);
    window.addEventListener('mouseup', ()=>{ this._isPanning=false; }, true);
    window.addEventListener('mousemove', (e)=>{
      if(!this._isPanning) return;
      const dx=e.clientX-this._panStart.x, dy=e.clientY-this._panStart.y;
      this.offsetX = this._panStart.ox + dx;
      this.offsetY = this._panStart.oy + dy;
      this.draw();
      e.preventDefault(); e.stopPropagation();
    }, true);
    // Wheel zoom
    this.canvas.addEventListener('wheel', (e)=>{
      const rect=this.canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      const prev=this.scale, step=1+(-Math.sign(e.deltaY)*0.1);
      const next=Math.min(2.5, Math.max(0.25, prev*step));
      if(next===prev) return;
      const k=next/prev;
      this.offsetX = mx - (mx - this.offsetX)*k;
      this.offsetY = my - (my - this.offsetY)*k;
      this.scale = next;
      this.draw();
      e.preventDefault();
    }, {passive:false});

    // Alt+LeftMouse = Pan
    this.canvas.addEventListener('mousedown', (e) => {
      if(this._isPanning){ e.preventDefault(); return; }
      if (this._isPanning) { e.preventDefault(); return; }
      if (e.button === 0 && e.altKey) {
        this._isPanning = true;
        this._panStart = { x: e.clientX, y: e.clientY, ox: this.offsetX, oy: this.offsetY };
        e.preventDefault(); e.stopPropagation();
        return;
      }
    }, true);
    window.addEventListener('mouseup', (e)=>{ this._isPanning = false; }, true);
    window.addEventListener('mousemove', (e)=>{
      if (!this._isPanning) return;
      const dx = e.clientX - this._panStart.x;
      const dy = e.clientY - this._panStart.y;
      this.offsetX = this._panStart.ox + dx;
      this.offsetY = this._panStart.oy + dy;
      this.draw();
      e.preventDefault(); e.stopPropagation();
    }, true);
    // Wheel = Zoom around cursor
    this.canvas.addEventListener('wheel', (e)=>{
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const prev = this.scale;
      const step = 1 + (-Math.sign(e.deltaY) * 0.1);
      const next = Math.min(2.5, Math.max(0.25, prev * step));
      if (next === prev) return;
      const k = next / prev;
      this.offsetX = mx - (mx - this.offsetX) * k;
      this.offsetY = my - (my - this.offsetY) * k;
      this.scale = next;
      this.draw();
      e.preventDefault();
    }, {passive:false});
    // Pointer down
    this.canvas.addEventListener('mousedown', (e) => {
      if(this._isPanning){ e.preventDefault(); return; }
      if (this._isPanning) { e.preventDefault(); return; }
      if (e.button === 2) return; // context menu handles right-click
      this._hideMenu();

      const pos = (()=>{ const p=this._eventPos(e); return this._toCanvas(p.px, p.py); })();

      // Start wire drag?
      const hitOut = this._hitOutputPin(pos.x, pos.y);
      if(hitOut){ this.dragWire = { from: hitOut, pos }; return; }

      // Clicked input pin -> remove connection
      const hitIn = this._hitInputPin(pos.x, pos.y);
      if(hitIn){
        this.graph.connections = this.graph.connections.filter(c => !(c.to.nodeId===hitIn.nodeId && c.to.pin===hitIn.pin));
        if(this.onChange) this.onChange();
        this.draw();
        return;
      }

      // Clicked node?
      const clicked = this._hitNode(pos.x, pos.y);
      if(!clicked){
        // start box select
        this.graph.selection.clear();
        this.boxSelect = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
        this.draw();
        return;
      }

      // Drag node(s)
      let dragIds = new Set(this.graph.selection.has(clicked.id) ? this.graph.selection : [clicked.id]);
      // If clicked a non-selected node, select only it
      if(!this.graph.selection.has(clicked.id)){
        dragIds = new Set([clicked.id]);
        this.graph.selection = new Set([clicked.id]);
        if(this.onChange) this.onChange();
      }
      const orig = {};
      for(const id of dragIds){
        const n = this.graph.nodes.find(m=>m.id===id);
        if(n) orig[id] = {x:n.x, y:n.y};
      }
      this.dragging = { ids: dragIds, start:{x:pos.x, y:pos.y}, orig };
      this.draw();
    });

// Context menu
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const pos = (()=>{ const p=this._eventPos(e); return this._toCanvas(p.px, p.py); })();
      this.menuPos = { x: pos.x, y: pos.y };
      const nodeHit = this._hitNode(pos.x, pos.y);
      if (nodeHit){ this._showNodeMenu(nodeHit, e.clientX, e.clientY); }
      else { this._showCreateMenu(e.clientX, e.clientY); }
    });

    // Pointer move
    window.addEventListener('mousemove', (e) => {
      const pos = (()=>{ const p=this._eventPos(e); return this._toCanvas(p.px, p.py); })();

      if(this.dragWire){
        this.dragWire.pos = pos;
        this.draw();
        return;
      }

      if(this.boxSelect){
        this.boxSelect.x1 = pos.x; this.boxSelect.y1 = pos.y;
        this._updateBoxSelection();
        this.draw();
        return;
      }

      if (!this.dragging) return;
      const dx = pos.x - this.dragging.start.x;
      const dy = pos.y - this.dragging.start.y;
      for(const id of this.dragging.ids){
        const n = this.graph.nodes.find(m=>m.id===id);
        if(!n) continue;
        const o = this.dragging.orig[id];
        n.x = o.x + dx;
        n.y = o.y + dy;
      }
      if(this.onChange) this.onChange();
      this.draw();
    });

    // Pointer up
    window.addEventListener('mouseup', (e) => {
      const pos = (()=>{ const p=this._eventPos(e); return this._toCanvas(p.px, p.py); })();

      if(this.dragWire){
        const target = this._hitInputPin(pos.x, pos.y);
        if(target){
          // Replace any existing connection into that input
          this.graph.connections = this.graph.connections.filter(c => !(c.to.nodeId===target.nodeId && c.to.pin===target.pin));
          this.graph.connections.push({ from: this.dragWire.from, to: target });
          const toNode = this.graph.nodes.find(n => n.id===target.nodeId);
          if(toNode) toNode.inputs[target.pin] = this.dragWire.from.nodeId;
          if(this.onChange) this.onChange();
        }
        this.dragWire = null;
        this.draw();
        // don't return; allow boxSelect cleanup below in edge cases
      }

      if(this.boxSelect){
        this._updateBoxSelection();
        if(this.onChange) this.onChange();
        this.draw();
        this.boxSelect = null;
        this.dragging = null;
        return;
      }

      this.dragging = null;
    });

    window.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape') this._hideMenu();
      if((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body){
        this._deleteSelection();
      }
    });

    document.addEventListener('click', (e)=>{
      if(this.menuEl && !this.menuEl.contains(e.target)) this._hideMenu();
    });
  }

  _deleteSelection(){
    const ids = new Set(this.graph.selection);
    if(ids.size===0) return;
    this.graph.connections = this.graph.connections.filter(c => !(ids.has(c.from.nodeId) || ids.has(c.to.nodeId)));
    this.graph.nodes = this.graph.nodes.filter(n => !ids.has(n.id));
    this.graph.selection.clear();
    if(this.onChange) this.onChange();
    this.draw();
  }

  // ---- Rendering ----
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  _bezier(ctx, x1, y1, x2, y2){
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1+dx, y1, x2-dx, y2, x2, y2);
    ctx.stroke();
  }
  _dot(ctx, x, y, r){
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Wires
    ctx.lineWidth = 2;
    for(const c of this.graph.connections){
      const a = this.graph.nodes.find(n => n.id===c.from.nodeId);
      const b = this.graph.nodes.find(n => n.id===c.to.nodeId);
      if(!a || !b) continue;
      const ao = this._pinPositions(a).outs[c.from.pin];
      const bi = this._pinPositions(b).ins[c.to.pin];
      if(!ao || !bi) continue;
      const srcType = (NodeDefs[a.kind]?.pinsOut?.[c.from.pin]?.type) || 'default';
      const color = (srcType==='f32') ? '#ffd166' : (srcType==='vec2') ? '#40c9b4' : (srcType==='vec3') ? '#d06bff' : '#888';
      ctx.strokeStyle = color;
      this._bezier(ctx, ao.x, ao.y, bi.x, bi.y);
    }
    if(this.dragWire){
      const a = this.graph.nodes.find(n => n.id===this.dragWire.from.nodeId);
      if(a){
        const ao = this._pinPositions(a).outs[this.dragWire.from.pin];
        const bi = this.dragWire.pos;
        const srcType = (NodeDefs[a.kind]?.pinsOut?.[this.dragWire.from.pin]?.type) || 'default';
        const color = (srcType==='f32') ? '#ffd166' : (srcType==='vec2') ? '#40c9b4' : (srcType==='vec3') ? '#d06bff' : '#888';
        ctx.strokeStyle = color;
        this._bezier(ctx, ao.x, ao.y, bi.x, bi.y);
      }
    }

    // Nodes
    for (const n of this.graph.nodes) {
      ctx.fillStyle = '#1b1b1b';
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(n.x, n.y, n.w, n.h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ddd';
      ctx.font = `${12 / this.scale}px sans-serif`;
      const label = NodeDefs[n.kind]?.label || n.kind;
      ctx.fillText(label, n.x + 8, n.y + 18);

      const {ins, outs} = this._pinPositions(n);

      // thumbnail (if any)
      if (n.__thumb) {
        if (!n.__thumbCanvas || n.__thumbCanvas.__ver !== n.__thumb) {
          const cn = document.createElement('canvas');
          cn.width = n.__thumb.width || 16;
          cn.height = n.__thumb.height || 16;
          const cctx = cn.getContext('2d');
          try { cctx.putImageData(n.__thumb, 0, 0); } catch(_) {}
          cn.__ver = n.__thumb;
          n.__thumbCanvas = cn;
        }
        const tw = 16, th = 16;
        ctx.drawImage(n.__thumbCanvas, Math.floor(n.x+n.w-4-tw), Math.floor(n.y+4), tw, th);
      }
// Output pins (blue)
      ctx.fillStyle = '#4aa3ff';
      for(const [i,p] of outs.entries()){
        this._dot(ctx, p.x, p.y, 4);
        const t = (NodeDefs[n.kind]?.pinsOut?.[i]?.type)||'•';
        // tiny badge near output
        ctx.save();
        ctx.font = `${10 / this.scale}px ui-monospace,Consolas,monospace`;
        const txt = (n.kind==='ConstFloat' && typeof n.value==='number') ? `${t}:${n.value.toFixed(3)}` :
                    (n.kind==='Expr' && n.expr) ? `${t}:${n.expr}` : t;
        const w = ctx.measureText(String(txt)).width + 6;
        ctx.fillStyle = '#0f0f0f'; ctx.strokeStyle = '#2a2a2a';
        ctx.beginPath(); ctx.roundRect(p.x+6, p.y-8, w, 12, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9aa0a6'; ctx.fillText(String(txt), p.x+9, p.y+3);
        ctx.restore();
      }

      // Input pins (red)
      ctx.fillStyle = '#ff7a7a';
      for(const p of ins){ this._dot(ctx, p.x, p.y, 4); }

      // Selection outline (robust)
      if(this.graph.selection.has(n.id)){
        ctx.save();
        ctx.setLineDash([]);
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#66aaff';
        ctx.beginPath();
        ctx.roundRect(n.x-2, n.y-2, n.w+4, n.h+4, 10);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Selection rectangle (overlay)
    if(this.boxSelect){
      const x0 = Math.min(this.boxSelect.x0, this.boxSelect.x1);
      const y0 = Math.min(this.boxSelect.y0, this.boxSelect.y1);
      const x1 = Math.max(this.boxSelect.x0, this.boxSelect.x1);
      const y1 = Math.max(this.boxSelect.y0, this.boxSelect.y1);
      ctx.save();
      ctx.setLineDash([6,4]);
      ctx.strokeStyle = '#66aaff';
      ctx.fillStyle = 'rgba(102,170,255,0.12)';
      ctx.fillRect(x0, y0, x1-x0, y1-y0);
      ctx.strokeRect(x0, y0, x1-x0, y1-y0);
      ctx.restore();
    }

    ctx.restore();
  }

  // ===== Context Menu =====
  _hideMenu(){
    if(this.menuEl){ this.menuEl.remove(); this.menuEl = null; }
  }
_ensureMenuRoot(clientX, clientY){
  this._hideMenu();
  const el = document.createElement('div');
  el.className = 'ctx-menu';
  
  // Add to body first to measure dimensions
  document.body.appendChild(el);
  
  // Temporarily position off-screen to measure
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '-9999px';
  el.style.visibility = 'hidden';
  
  // Force layout and measure
  el.offsetHeight; // trigger layout
  const menuWidth = 200; // approximate width
  const menuHeight = 300; // approximate height
  
  // Calculate position with boundary checking
  let x = clientX;
  let y = clientY;
  
  // Check right boundary
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  
  // Check bottom boundary  
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
  _menuHeader(text){
    const h = document.createElement('div');
    h.className = 'ctx-header';
    h.textContent = text;
    return h;
  }
  _menuItem(text, onClick){
    const item = document.createElement('div');
    item.className = 'ctx-item';
    item.textContent = text;
    item.addEventListener('click', onClick);
    return item;
  }
  _renderCreateList(el){
    const cats = new Map();
    for(const [k, def] of Object.entries(NodeDefs)){
      const cat = def.cat || 'Misc';
      if(!cats.has(cat)) cats.set(cat, []);
      cats.get(cat).push({ kind: k, label: def.label || k });
    }
    for(const v of cats.values()) v.sort((a,b)=>a.label.localeCompare(b.label));

    const filter = (this.menuFilter||'').trim().toLowerCase();
    const matches = (item) => !filter || item.label.toLowerCase().includes(filter) || item.kind.toLowerCase().includes(filter);

    const orderedCats = ['Input','Math','Field','Utility','Output', ...Array.from(cats.keys()).filter(c=>!['Input','Math','Field','Utility','Output'].includes(c))];
    for(const cat of orderedCats){
      const arr = cats.get(cat);
      if(!arr) continue;
      const visible = arr.filter(matches);
      if(visible.length===0) continue;
      el.appendChild(this._menuHeader(cat));
      for(const it of visible){
        el.appendChild(this._menuItem(it.label, () => {
          const node = makeNode(it.kind, this.menuPos.x, this.menuPos.y);
          this.graph.add(node);
          this.graph.selection = new Set([node.id]);
          if(this.onChange) this.onChange();
          this.draw();
          this._hideMenu();
        }));
      }
    }
  }

_showCreateMenu(clientX, clientY){
    const el = this._ensureMenuRoot(clientX, clientY);
    el.innerHTML = '';
    const input = document.createElement('input');
    input.className = 'ctx-search';
    input.placeholder = 'Search nodes…';
    input.value = this.menuFilter;
    input.addEventListener('input', ()=>{ this.menuFilter = input.value; this._renderCreateList(el); });
    el.appendChild(input);
    this._renderCreateList(el);
    input.addEventListener('keydown', (e)=>{
      if(e.key==='ArrowDown'){ e.preventDefault(); /* handle navigation */ }
      if(e.key==='ArrowUp'){ e.preventDefault(); /* handle navigation */ }
      if(e.key==='Enter'){ e.preventDefault(); /* select item */ }
      if(e.key==='Escape'){ e.preventDefault(); this._hideMenu(); }
    });
    input.focus();
}
_showNodeMenu(node, clientX, clientY){
    const el = this._ensureMenuRoot(clientX, clientY);
    el.innerHTML = '';
        if(!this.graph.selection.has(node.id)) this.graph.selection = new Set([node.id]);
el.appendChild(this._menuHeader('Node'));
    el.appendChild(this._menuItem('Duplicate', () => { this.duplicateSelected(); this._hideMenu(); }));
    el.appendChild(this._menuItem('Delete', () => { this.graph.selection = new Set([node.id]); this._deleteSelection(); this._hideMenu(); }));
  }

  undo() {}
  selectAll(){ this.graph.selection = new Set(this.graph.nodes.map(n=>n.id)); if(this.onChange) this.onChange(); this.draw(); }
  redo() {}
  moveSelection(dx,dy){ const ids=this.graph.selection||new Set(); if(!ids.size) return; for(const n of this.graph.nodes){ if(ids.has(n.id)){ n.x=(n.x||0)+dx; n.y=(n.y||0)+dy; } } if(this.onChange) this.onChange(); this.draw(); }
  duplicateSelected(){
    const ids = Array.from(this.graph.selection||[]);
    if(!ids.length) return;
    const idSet = new Set(ids);
    const mapOldToNew = new Map();
    const clones = [];
    for(const n of this.graph.nodes){
      if(!idSet.has(n.id)) continue;
      const c = JSON.parse(JSON.stringify(n));
      c.id = String((_nextId++));
      c.x = (n.x||0) + 20;
      c.y = (n.y||0) + 20;
      clones.push(c);
      mapOldToNew.set(n.id, c.id);
    }
    // insert clones after originals
    this.graph.nodes.push(...clones);
    // clone connections between selected nodes
    const newConns = [];
    for(const c of this.graph.connections){
      const fromNew = mapOldToNew.get(c.from.nodeId);
      const toNew = mapOldToNew.get(c.to.nodeId);
      if(fromNew && toNew){
        newConns.push({ from:{ nodeId: fromNew, pin: c.from.pin }, to:{ nodeId: toNew, pin: c.to.pin } });
      }
    }
    this.graph.connections.pushRange ? this.graph.connections.pushRange(newConns) : this.graph.connections.push(...newConns);
    this.graph.selection = new Set(clones.map(n=>n.id));
    if(this.onChange) this.onChange();
    this.draw();
  }
  copySelected() {}
  pasteAtCursor() {}
}