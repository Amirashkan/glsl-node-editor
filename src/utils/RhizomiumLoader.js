(function(){
  var pendingGraph = null;
  function getEditor(){ return window.editor; }
  function getGraph(){ return (window.graph) || (window.editor && window.editor.graph) || null; }
  function ensureEditorHook(){
    try{
      var has = Object.prototype.hasOwnProperty.call(window,'editor');
      var current = has ? window.editor : undefined;
      Object.defineProperty(window, 'editor', {
        configurable: true,
        get: function(){ return current; },
        set: function(v){
          current = v;
          tryApplyPending();
        }
      });
      if (typeof current !== 'undefined') tryApplyPending();
    }catch(e){
      var iv = setInterval(function(){ if (getEditor()){ tryApplyPending(); clearInterval(iv); } }, 120);
    }
  }
  function tryApplyPending(){
    if (!pendingGraph) return;
    var e = getEditor(); var g = getGraph();
    if (!e) return;
    importJSON(pendingGraph);
    pendingGraph = null;
  }

  function readPos(n){ if(n && n.position && typeof n.position.x==='number') return {x:n.position.x,y:n.position.y}; if(typeof n.x==='number'&&typeof n.y==='number') return {x:n.x,y:n.y}; return {x:0,y:0}; }
  function readPins(n,key){
    var src = (n && n[key]) || (n && (key==='inputPins' ? n.inputs : n.outputs)) || [];
    return (src||[]).filter(function(x){return !!x;}).map(function(p){ p = p || {}; return { id: p.id || p.pinId || (p.name ? (key+'-'+p.name) : (key+'-'+Math.random().toString(36).slice(2))),
               name: p.name || p.label || key,
               connectedTo: p.connectedTo || p.to || p.from || null,
               value: (p.value!==undefined)?p.value:undefined,
               type: p.type };
    });
  }
  function exportJSON(extra){ var g = getGraph(); var e = getEditor() || {}; var nodes = g && Array.isArray(g.nodes) ? g.nodes.map(function(n){
      return {
        id: n.id || n.uuid || n.nodeId || Math.random().toString(36).slice(2),
        type: n.type || n.kind || 'unknown',
        position: readPos(n),
        params: n.params || n.parameters || {},
        expressions: n.expressions || n.custom_expressions || n.customExpressions || {},
        inputPins: readPins(n,'inputPins'),
        outputPins: readPins(n,'outputPins'),
        meta: {}
      };
    }) : [];
    var conns = g && Array.isArray(g.connections) ? g.connections.map(function(c){
      function part(obj, side){
        if(obj && obj.nodeId) return { nodeId: obj.nodeId, pinId: obj.pinId || obj.id || obj.name || side };
        if(c[side] && c[side].nodeId) return { nodeId: c[side].nodeId, pinId: c[side].pinId || c[side].id || c[side].name || side };
        return { nodeId: 'unknown', pinId: side };
      }
      return { from: part(c.from||c,'from'), to: part(c.to||c,'to') };
    }) : [];
    var view = { pan: { x: e && typeof e.panX==='number' ? e.panX : 0, y: e && typeof e.panY==='number' ? e.panY : 0 }, zoom: e && typeof e.zoom==='number' ? e.zoom : 1 };
    return { app: 'Rhizomium-Web', version: 1, savedAt: new Date().toISOString(), nodes: nodes, connections: conns, view: view, selection: [], meta: extra||{} };
  }
  function downloadJSON(data, filename){
    var blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename||'rhizomium-project.json';
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
  }
  async function importFromFile(file){
    var text = await file.text();
    var json = JSON.parse(text);
    return importJSON(json);
  }
  
function importJSON(json){
    var e = getEditor();
    var g = getGraph();
    if(!e && !g){
      console.warn('Fallback loader: no editor yet. Deferring apply.');
      pendingGraph = json;
      ensureEditorHook();
      return false;
    }
    var nodes = [];
    var byId = {};
    var NodeDefs = window.NodeDefs || {};
    (json.nodes||[]).forEach(function(n){
      var kind = n.kind || n.type || n.nodeType || (n.meta && (n.meta.kind||n.meta.type)) || 'Unknown';
      var def = NodeDefs[kind] || null;
      var inCount = def && typeof def.inputs === 'number' ? def.inputs : ((n.inputPins && n.inputPins.length)|| (n.inputs && n.inputs.length) || 0);
      var outCount = def && Array.isArray(def.pinsOut) ? def.pinsOut.length : ((n.outputPins && n.outputPins.length) || 1);
      var x = (n.position && typeof n.position.x==='number') ? n.position.x : (typeof n.x==='number'? n.x : 0);
      var y = (n.position && typeof n.position.y==='number') ? n.position.y : (typeof n.y==='number'? n.y : 0);
      var h = Math.max(60, 40 + inCount*18);
      var node = {
        id: String(n.id || n.uuid || Math.random().toString(36).slice(2)),
        kind: kind,
        x: x, y: y, w: 180, h: h,
        inputs: new Array(inCount).fill(null)
      };
      var params = n.params || n.parameters || {};
      if (node.kind === 'ConstFloat' && typeof params.Value === 'number') node.value = params.Value;
      if (node.kind === 'ConstVec2') { if (typeof params.x==='number') node.xv = params.x; if (typeof params.y==='number') node.yv = params.y; }
      if (node.kind === 'Expr') {
        if (typeof (n.expr||params.expr)==='string') node.expr = n.expr||params.expr;
        else if (n.expressions && typeof n.expressions.expr === 'string') node.expr = n.expressions.expr;
      }
      if (node.kind === 'CircleField') {
        node.props = node.props || {};
        if (typeof (params.R)!=='undefined') node.props.radius = Number(params.R);
        if (typeof (params.E)!=='undefined') node.props.epsilon = Number(params.E);
        if (typeof node.props.radius !== 'number')  node.props.radius = 0.25;
        if (typeof node.props.epsilon !== 'number') node.props.epsilon = 0.01;
      }
      nodes.push(node);
      byId[node.id] = node;
    });
    function pinIndex(node, pinId, isInput){
      if (pinId === undefined || pinId === null) return 0;
      if (typeof pinId === 'number') return pinId|0;
      var k = node && node.kind;
      var defs = (window.NodeDefs && window.NodeDefs[k]) || null;
      var arr = isInput ? (defs && defs.pinsIn) : (defs && defs.pinsOut);
      if (Array.isArray(arr)){
        var i = arr.findIndex(function(p){ return (p && (p.label===pinId || p===pinId)); });
        if (i>=0) return i;
      }
      if (pinId==='A') return 0; if (pinId==='B') return 1;
      var asNum = parseInt(pinId,10); if (!isNaN(asNum)) return asNum;
      return 0;
    }
    var conns = [];
    (json.connections||[]).forEach(function(c){
      var fromId = (c.from && (c.from.nodeId || c.from.id)) || c.fromId;
      var toId   = (c.to && (c.to.nodeId || c.to.id)) || c.toId;
      var fromN = byId[String(fromId)]; var toN = byId[String(toId)];
      if (!fromN || !toN) return;
      var fp = pinIndex(fromN, c.from && (c.from.pin || c.from.pinId || c.from.name), false);
      var tp = pinIndex(toN,   c.to   && (c.to.pin   || c.to.pinId   || c.to.name),   true);
      conns.push({ from:{ nodeId: fromN.id, pin: fp }, to:{ nodeId: toN.id, pin: tp } });
      try{ toN.inputs[tp] = { from: fromN.id, pin: fp }; }catch(e){}
    });

    if (g){
      g.nodes = nodes;
      g.connections = conns;
    } else {
      if (typeof e.clear === 'function'){ e.clear(); }
      else { e.nodes = []; e.connections = []; }
      if (Array.isArray(e.nodes)) e.nodes = nodes;
      if (Array.isArray(e.connections)) e.connections = conns;
    }

    if (json.view){
      var pan = json.view.pan || {};
      if (e && 'panX' in e) e.panX = (typeof pan.x==='number') ? pan.x : e.panX;
      if (e && 'panY' in e) e.panY = (typeof pan.y==='number') ? pan.y : e.panY;
      if (e && 'zoom' in e) e.zoom = (typeof json.view.zoom==='number') ? json.view.zoom : e.zoom;
      if (e && typeof e.invalidate === 'function') e.invalidate();
    }

    try { if (typeof window.rebuild === 'function') { window.rebuild(); } } catch(e) {}
    try { if (typeof window.__afterImportHook === 'function') { window.__afterImportHook(); try{ if (window.__syncShaderNow) window.__syncShaderNow(); }catch(e){} } } catch(e) {}
    try { if (typeof window.computePreviews === 'function') { window.computePreviews(getGraph()); } } catch(e) {}
    if (e && typeof e.invalidate === 'function') e.invalidate();

    return true;
  }

  function mountPill(){
    if (document.getElementById('rz-fallback-pill')) return;
    var wrap = document.createElement('div');
    wrap.id='rz-fallback-pill';
    wrap.style.position='fixed'; wrap.style.right='12px'; wrap.style.bottom='12px'; wrap.style.display='flex'; wrap.style.gap='8px';
    wrap.style.padding='8px'; wrap.style.background='rgba(0,0,0,.35)'; wrap.style.backdropFilter='blur(6px)'; wrap.style.borderRadius='12px';
    ['Export','SaveLocal','LoadLocal','Import'].forEach(function(label){
      var b=document.createElement('button'); b.textContent=label; b.style.padding='6px 10px'; b.style.borderRadius='10px';
      b.style.border='1px solid rgba(255,255,255,.25)'; b.style.background='rgba(255,255,255,.08)'; b.style.color='#fff'; b.style.cursor='pointer'; b.style.fontSize='12px';
      b.onmouseenter=function(){ b.style.background='rgba(255,255,255,.15)'; }; b.onmouseleave=function(){ b.style.background='rgba(255,255,255,.08)'; };
      if(label==='Export') b.onclick=function(){ downloadJSON(exportJSON(), 'rhizomium-project.json'); };
      if(label==='SaveLocal') b.onclick=function(){ localStorage.setItem('rhizomium.autosave.v1', JSON.stringify(exportJSON({autosave:true}))); };
      if(label==='LoadLocal') b.onclick=function(){ var raw=localStorage.getItem('rhizomium.autosave.v1'); if(!raw) return; importJSON(JSON.parse(raw)); };
      if(label==='Import') b.onclick=function(){ var i=document.createElement('input'); i.type='file'; i.accept='.json,application/json'; i.onchange=async function(){ if(i.files[0]) await importFromFile(i.files[0]); i.remove(); }; document.body.appendChild(i); i.click(); };
      wrap.appendChild(b);
    });
    document.body.appendChild(wrap);
  }
  var __hotkeysAttached=false;
function attachHotkeys(){ if(__hotkeysAttached) return; __hotkeysAttached=true;
    window.addEventListener('keydown', function(ev){
      var mac = navigator.platform.toLowerCase().includes('mac');
      var mod = mac ? ev.metaKey : ev.ctrlKey;
      if(!mod) return;
      var k = ev.key.toLowerCase();
      if(k==='s' && !ev.shiftKey){ ev.preventDefault(); downloadJSON(exportJSON(), 'rhizomium-project.json'); }
if (k==='s' && ev.shiftKey){ ev.preventDefault(); localStorage.setItem('rhizomium.autosave.v1', JSON.stringify(exportJSON({autosave:true}))); }
if (k==='o'){ ev.preventDefault(); var i=document.createElement('input'); i.type='file'; i.accept='.json,application/json'; i.onchange=async function(){ if(i.files[0]) await importFromFile(i.files[0]); i.remove(); }; document.body.appendChild(i); i.click(); }
if (k==='l'){ ev.preventDefault(); var raw=localStorage.getItem('rhizomium.autosave.v1'); if(raw) importJSON(JSON.parse(raw)); }

      if(k==='a'){ ev.preventDefault(); var ed=getEditor(); if(ed&&ed.selectAll) ed.selectAll(); }
      if(k==='d'){ ev.preventDefault(); var ed=getEditor(); if(ed&&ed.duplicateSelected) ed.duplicateSelected(); }

    }, true);
  }
  
    function isTypingTarget(el){ return el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.isContentEditable); }
    function rhizoKeyArrows(ev){
      var ed = getEditor && getEditor();
      if(!ed) return;
      if(isTypingTarget(document.activeElement)) return;
      var step = ev.shiftKey ? 10 : 1;
      if(ev.key === 'ArrowLeft'){ ev.preventDefault(); ed.moveSelection && ed.moveSelection(-step,0); }
      if(ev.key === 'ArrowRight'){ ev.preventDefault(); ed.moveSelection && ed.moveSelection(step,0); }
      if(ev.key === 'ArrowUp'){ ev.preventDefault(); ed.moveSelection && ed.moveSelection(0,-step); }
      if(ev.key === 'ArrowDown'){ ev.preventDefault(); ed.moveSelection && ed.moveSelection(0,step); }
    }
    window.addEventListener('keydown', rhizoKeyArrows, true);

function boot(){ mountPill(); attachHotkeys(); ensureEditorHook(); if (getEditor()) tryApplyPending(); }
  if(document.readyState==='loading') window.addEventListener('DOMContentLoaded', boot); else boot();

  window.applyPendingGraph = tryApplyPending;

function looksLikeEditor(obj){
  try{
    if (!obj || typeof obj !== 'object') return false;
    var n = obj.nodes, c = obj.connections;
    if (!Array.isArray(n) || !Array.isArray(c)) return false;
    var plausibleAPI = (typeof obj.createNode === 'function') || (typeof obj.invalidate === 'function') || (typeof obj.clear === 'function');
    return plausibleAPI;
  }catch(e){ return false; }
}
function probePaths(root){
  var candidates = [];
  function add(o){ if (o && candidates.indexOf(o)===-1) candidates.push(o); }
  var names = ['editor','app','rz','rhizomium','state','ctx','core','engine','store'];
  names.forEach(function(k){ try{ add(root[k]); }catch(e){} });
  names.forEach(function(k){
    try{
      var o = root[k];
      if (o && typeof o === 'object'){
        for (var kk in o){ try{ add(o[kk]); }catch(e){} }
      }
    }catch(e){}
  });
  return candidates;
}
function scanForEditor(){
  var direct = probePaths(window);
  for (var i=0;i<direct.length;i++){
    var o = direct[i];
    if (looksLikeEditor(o)){
      try{ window.editor = o; }catch(e){}
      tryApplyPending();
      return true;
    }
  }
  var count = 0;
  for (var k in window){
    if (++count > 5000) break;
    try{
      var v = window[k];
      if (looksLikeEditor(v)){
        try{ window.editor = v; }catch(e){}
        tryApplyPending();
        return true;
      }
    }catch(e){}
  }
  return false;
}
(function(){
  var tries = 0;
  var iv = setInterval(function(){
    if (scanForEditor()){ clearInterval(iv); return; }
    if (++tries > 300){ clearInterval(iv); }
  }, 200);
  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    scanForEditor();
  } else {
    window.addEventListener('DOMContentLoaded', scanForEditor);
  }
})();

})();
