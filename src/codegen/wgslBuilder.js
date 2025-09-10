function topoOrder(graph){
  const nodes = graph.nodes || [];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const visited = new Set();
  const out = [];
  function visit(id){
    if(!id || visited.has(id)) return;
    visited.add(id);
    const n = byId.get(id);
    if(!n) return;
    for(const inp of (n.inputs||[])) if(inp) visit(inp);
    out.push(n);
  }
  for(const n of nodes) visit(n.id);
  return out;
}

function sanitize(id){ return String(id).replace(/[^a-zA-Z0-9_]/g,'_'); }

export function buildWGSL(graph){
  let ordered = topoOrder(graph);
  // --- begin: restrict graph to the chain feeding the active Output ---
  function pickActiveOutput(graph){
    const outs = (graph.nodes||[]).filter(n => /OutputFinal/i.test(n.kind||n.type||n.name||''));
    const connected = outs.filter(o => Array.isArray(o.inputs) && o.inputs[0]);
    if (connected.length) return connected[connected.length-1];
    return outs[outs.length-1] || null;
  }
  function upstreamSet(start, byId){
    const vis = new Set();
    (function dfs(id){
      if(!id || vis.has(id)) return;
      vis.add(id);
      const n = byId.get(id);
      if(!n) return;
      for(const inp of (n.inputs||[])) if(inp) dfs(inp);
    })(start);
    return vis;
  }
  const outNode = pickActiveOutput(graph);
  if (outNode){
    const byId = new Map((graph.nodes||[]).map(n => [n.id, n]));
    const keep = upstreamSet(outNode.id, byId);
    ordered = ordered.filter(n => keep.has(n.id));
  }
  // --- end: restrict graph chain ---

  // If there's no active output or chain is empty, return a trivial black shader
  if (!outNode || ordered.length === 0) {
    const code = `
struct Globals { time: f32, }
@group(0) @binding(0) var<uniform> u : Globals;

struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VSOut {
  var p = array<vec2<f32>, 6>(
    vec2<f32>(-1.0,-1.0), vec2<f32>( 1.0,-1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>( 1.0,-1.0), vec2<f32>( 1.0, 1.0)
  );
  var out: VSOut;
  out.pos = vec4<f32>(p[vid], 0.0, 1.0);
  out.uv = 0.5 * (p[vid] + vec2<f32>(1.0,1.0));
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}`;
    return code;
  }


  const defs = [];
  const lines = [];
  const types = new Map();   // nodeId -> 'f32' | 'vec2' | 'vec3'
  const exprs = new Map();   // nodeId -> expression string

  function want(id, wantType){
    const sid = sanitize(id);
    let e = exprs.get(id);
    let t = types.get(id);
    if(!e){ e = 'vec3<f32>(0.0)'; t = 'vec3'; }
    function toVec3(e,t){
      if(t === 'vec3') return [e,'vec3'];
      if(t === 'vec2') return [`vec3<f32>(${e}.x, ${e}.y, 0.0)`, 'vec3'];
      if(t === 'f32')  return [`vec3<f32>(${e})`, 'vec3'];
      return [e,'vec3'];
    }
    function toF32(e,t){
      if(t === 'f32') return [e,'f32'];
      if(t === 'vec2') return [`(${e}.x + ${e}.y) * 0.5`, 'f32'];
      if(t === 'vec3') return [`(${e}.x + ${e}.y + ${e}.z) / 3.0`, 'f32'];
      return [e,'f32'];
    }
    if(wantType === 'vec3') return toVec3(e,t)[0];
    if(wantType === 'vec2'){
      if(t === 'vec2') return e;
      if(t === 'vec3') return `vec2<f32>(${e}.x, ${e}.y)`;
      if(t === 'f32')  return `vec2<f32>(${e})`;
      return `vec2<f32>(0.0)`;
    }
    if(wantType === 'f32') return toF32(e,t)[0];
    return e;
  }

  for(const n of ordered){
    const id = sanitize(n.id);
    let line = '';
    let outType = 'vec3';

    switch(n.kind){
      case 'UV': {
        line = `let node_${id} = in.uv;`;
        outType = 'vec2';
        break;
      }
      case 'Time': {
        line = `let node_${id} = u.time;`;
        outType = 'f32';
        break;
      }
      case 'ConstFloat': {
        const v = (typeof n.value === 'number') ? n.value : 0.0;
        line = `let node_${id} = ${v.toFixed(6)};`;
        outType = 'f32';
        break;
      }
      case 'Expr': {
        const a = n.inputs?.[0] ? want(n.inputs[0],'f32') : '0.0';
        // b available if needed
        const b = n.inputs?.[1] ? want(n.inputs[1],'f32') : '0.0';
        let expr = (n.expr || 'a').toString();
        expr = expr.replace(/\bu_time\b/g, 'u.time').replace(/\buv\b/g, 'in.uv');
        expr = expr.replace(/\ba\b/g, `(${a})`).replace(/\bb\b/g, `(${b})`);
        line = `let node_${id} = ${expr};`;
        outType = 'f32';
        break;
      }
      case 'CircleField': {
        const R = n.inputs?.[0] ? want(n.inputs[0],'f32') : '0.25';
        const E = n.inputs?.[1] ? want(n.inputs[1],'f32') : '0.02';
        line = `let node_${id} = 1.0 - smoothstep((${R}) - max(${E}, 0.0001), (${R}) + max(${E}, 0.0001), distance(in.uv, vec2<f32>(0.5, 0.5)));`;
        outType = 'f32';
        break;
      }
      case 'Multiply': {
        const A = n.inputs?.[0] ? want(n.inputs[0],'vec3') : 'vec3<f32>(0.0)';
        const B = n.inputs?.[1] ? want(n.inputs[1],'vec3') : 'vec3<f32>(0.0)';
        line = `let node_${id} = (${A}) * (${B});`;
        outType = 'vec3';
        break;
      }
      case 'Add': {
        const A = n.inputs?.[0] ? want(n.inputs[0],'vec3') : 'vec3<f32>(0.0)';
        const B = n.inputs?.[1] ? want(n.inputs[1],'vec3') : 'vec3<f32>(0.0)';
        line = `let node_${id} = (${A}) + (${B});`;
        outType = 'vec3';
        break;
      }
      case 'Saturate': {
        const v = n.inputs?.[0] ? want(n.inputs[0],'vec3') : 'vec3<f32>(0.0)';
        line = `let node_${id} = clamp(${v}, vec3<f32>(0.0), vec3<f32>(1.0));`;
        outType = 'vec3';
        break;
      }
      case 'OutputFinal': {
        const c = n.inputs?.[0] ? want(n.inputs[0],'vec3') : 'vec3<f32>(0.0,0.0,0.0)';
        line = `finalColor = ${c};`;
        outType = 'vec3';
        break;
      }
      default: {
        line = `let node_${id} = vec3<f32>(0.0);`;
        outType = 'vec3';
        break;
      }
    }

    lines.push(line);
    // Save expression/type for downstream
    if(n.kind === 'OutputFinal'){
      // Output doesn't produce new value; skip
    }else{
      exprs.set(n.id, `node_${id}`);
      types.set(n.id, outType);
    }
  }

  const code = /* wgsl */`
struct Globals { time: f32, }
@group(0) @binding(0) var<uniform> u : Globals;

struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VSOut {
  var p = array<vec2<f32>, 6>(
    vec2<f32>(-1.0,-1.0), vec2<f32>( 1.0,-1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>( 1.0,-1.0), vec2<f32>( 1.0, 1.0)
  );
  var out: VSOut;
  out.pos = vec4<f32>(p[vid], 0.0, 1.0);
  out.uv = 0.5 * (p[vid] + vec2<f32>(1.0,1.0));
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  var finalColor: vec3<f32> = vec3<f32>(0.0);
  ${lines.join('\n  ')}
  let _keep_uniform = u.time * 0.0;
  return vec4<f32>(finalColor, 1.0);
}
`;
  return code;
}