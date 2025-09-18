// src/codegen/glslBuilder.js
// WGSL shader generation with proper syntax

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

function sanitize(id){ 
  return String(id).replace(/[^a-zA-Z0-9_]/g,'_'); 
}

export function buildWGSL(graph){
  const ordered = topoOrder(graph);
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
  const v = (typeof n.value === 'number') ? n.value : (n.props?.value ?? 0.0);
  line = `let node_${id} = ${v.toFixed(6)};`;
  outType = 'f32';
  break;
}
// Replace the 'Expr' case in your glslBuilder.js with this:

// Replace the 'Expr' case in your glslBuilder.js with this:

case 'Expr': {
  const a = n.inputs?.[0] ? want(n.inputs[0],'f32') : '0.0';
  const b = n.inputs?.[1] ? want(n.inputs[1],'f32') : '0.0';
  let expr = (n.expr || 'a').toString();
  
  console.log('Original expression:', expr);
  
  // Replace variables with connected inputs FIRST (before function replacements)
  expr = expr.replace(/\ba\b/g, `(${a})`);
  expr = expr.replace(/\bb\b/g, `(${b})`);
  
  // Replace time and UV references
  expr = expr.replace(/\bu_time\b/g, 'u.time');
  expr = expr.replace(/\buv\b/g, 'in.uv');
  
  // Replace constants
  expr = expr.replace(/\bpi\b/g, '3.14159265359');
  expr = expr.replace(/\bPI\b/g, '3.14159265359');
  
  // Note: Don't replace function names - WGSL functions are the same as the input
  // sin, cos, etc. are already valid WGSL function names
  
  console.log('Final WGSL expression:', expr);
  
  line = `let node_${id} = ${expr};`;
  outType = 'f32';
  break;
}


case 'CircleField': {
  // Use connected inputs if available, otherwise use node parameters, finally fallback to defaults
  const R = n.inputs?.[0] ? want(n.inputs[0],'f32') : (n.props?.radius ?? 0.25);
  const E = n.inputs?.[1] ? want(n.inputs[1],'f32') : (n.props?.epsilon ?? 0.02);
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
      case 'Sin': {
        const inp = want(n.inputs[0], 'f32');
        line = `let node_${id} = sin(${inp});`;
        outType = 'f32';
        break;
      }
      case 'Cos': {
        const inp = want(n.inputs[0], 'f32');
        line = `let node_${id} = cos(${inp});`;
        outType = 'f32';
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

// Add these complete noise cases to your glslBuilder.js switch statement:

// Enhanced noise cases with more parameters for glslBuilder.js

case 'Random': {
  const uv = n.inputs?.[0] ? want(n.inputs[0], 'vec2') : 'in.uv';
  const seed = n.props?.seed ?? 1.0;
  const scale = n.props?.scale ?? 1.0;
  line = `let node_${id} = random(${uv} * ${scale.toFixed(3)} + vec2<f32>(${seed.toFixed(3)}));`;
  outType = 'vec3';
  break;
}

case 'ValueNoise': {
  const uv = n.inputs?.[0] ? want(n.inputs[0], 'vec2') : 'in.uv';
  const scale = n.props?.scale ?? 5.0;
  const amplitude = n.props?.amplitude ?? 1.0;
  const offset = n.props?.offset ?? 0.0;
  const power = n.props?.power ?? 1.0;
  line = `let node_${id} = vec3<f32>(clamp(pow(valueNoise(${uv} * ${scale.toFixed(3)}) * ${amplitude.toFixed(3)} + ${offset.toFixed(3)}, ${power.toFixed(3)}), 0.0, 1.0));`;
  outType = 'vec3';
  break;
}

case 'FBMNoise': {
  const uv = n.inputs?.[0] ? want(n.inputs[0], 'vec2') : 'in.uv';
  const scale = n.props?.scale ?? 3.0;
  const octaves = n.props?.octaves ?? 4;
  const persistence = n.props?.persistence ?? 0.5;
  const lacunarity = n.props?.lacunarity ?? 2.0;
  const amplitude = n.props?.amplitude ?? 1.0;
  const offset = n.props?.offset ?? 0.0;
  const gain = n.props?.gain ?? 0.5;
  const warp = n.props?.warp ?? 0.0;
  
  let uvExpr = `${uv} * ${scale.toFixed(3)}`;
  if (warp > 0.001) {
    uvExpr = `${uvExpr} + vec2<f32>(valueNoise(${uv} * ${(scale * 2.0).toFixed(3)}) * ${warp.toFixed(3)})`;
  }
  
  line = `let node_${id} = (fbm(${uvExpr}, ${octaves}, ${persistence.toFixed(3)}, ${lacunarity.toFixed(3)}) * ${amplitude.toFixed(3)} + ${offset.toFixed(3)}) * ${gain.toFixed(3)};`;
  outType = 'vec3';
  break;
}

case 'SimplexNoise': {
  const uv = n.inputs?.[0] ? want(n.inputs[0], 'vec2') : 'in.uv';
  const scale = n.props?.scale ?? 4.0;
  const amplitude = n.props?.amplitude ?? 1.0;
  const offset = n.props?.offset ?? 0.0;
  const ridge = n.props?.ridge ?? false;
  const turbulence = n.props?.turbulence ?? false;
  
  let noiseExpr = `simplexNoise(${uv} * ${scale.toFixed(3)})`;
  
  if (ridge) {
    noiseExpr = `abs(${noiseExpr})`;
  }
  if (turbulence) {
    noiseExpr = `abs(${noiseExpr})`;
  }
  
  line = `let node_${id} = ${noiseExpr} * ${amplitude.toFixed(3)} + ${offset.toFixed(3)};`;
  outType = 'vec3';
  break;
}

case 'VoronoiNoise': {
  const uv = n.inputs?.[0] ? want(n.inputs[0], 'vec2') : 'in.uv';
  const scale = n.props?.scale ?? 8.0;
  const randomness = n.props?.randomness ?? 1.0;
  const minkowskiP = n.props?.minkowskiP ?? 2.0;
  const smoothness = n.props?.smoothness ?? 0.0;
  const cellType = n.props?.cellType ?? 0;
  const outputType = n.props?.outputType ?? 0;
  
  // Basic voronoi call
  let voronoiExpr = `voronoi(${uv} * ${scale.toFixed(3)}, ${randomness.toFixed(3)})`;
  
  // Output selection
  if (outputType === 1) {
    voronoiExpr = `${voronoiExpr}.y`; // Cell ID
  } else {
    voronoiExpr = `${voronoiExpr}.x`; // Distance
  }
  
  // Smoothness
  if (smoothness > 0.001) {
    voronoiExpr = `smoothstep(0.0, ${smoothness.toFixed(3)}, ${voronoiExpr})`;
  }
  
  line = `let node_${id} = ${voronoiExpr};`;
  outType = 'vec3';
  break;
}

case 'RidgedNoise': {
  const uv = n.inputs?.[0] ? want(n.inputs[0], 'vec2') : 'in.uv';
  const scale = n.props?.scale ?? 4.0;
  const octaves = n.props?.octaves ?? 6;
  const lacunarity = n.props?.lacunarity ?? 2.0;
  const gain = n.props?.gain ?? 0.5;
  const amplitude = n.props?.amplitude ?? 1.0;
  const offset = n.props?.offset ?? 1.0;
  const threshold = n.props?.threshold ?? 0.0;
  
  line = `let node_${id} = ridgedNoise(${uv} * ${scale.toFixed(3)}, ${octaves}, ${lacunarity.toFixed(3)}, ${gain.toFixed(3)}, ${offset.toFixed(3)}, ${threshold.toFixed(3)}) * ${amplitude.toFixed(3)};`;
  outType = 'vec3';
  break;
}

case 'WarpNoise': {
  const uv = n.inputs?.[0] ? want(n.inputs[0], 'vec2') : 'in.uv';
  const scale = n.props?.scale ?? 3.0;
  const warpScale = n.props?.warpScale ?? 2.0;
  const warpStrength = n.props?.warpStrength ?? 0.1;
  const octaves = n.props?.octaves ?? 3;
  const amplitude = n.props?.amplitude ?? 1.0;
  
  line = `let node_${id} = warpedNoise(${uv}, ${scale.toFixed(3)}, ${warpScale.toFixed(3)}, ${warpStrength.toFixed(3)}, ${octaves}) * ${amplitude.toFixed(3)};`;
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

// Fixed WGSL code with proper syntax
const code = /* wgsl */`
struct Globals {
  time: f32,
}

@group(0) @binding(0) var<uniform> u : Globals;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>
}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VSOut {
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0), 
    vec2<f32>( 3.0, -1.0), 
    vec2<f32>(-1.0,  3.0)
  );
  var out: VSOut;
  out.pos = vec4<f32>(p[vid], 0.0, 1.0);
  out.uv = 0.5 * (p[vid] + vec2<f32>(1.0, 1.0));
  return out;
}

fn random(st: vec2<f32>) -> f32 {
  return fract(sin(dot(st, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

fn valueNoise(st: vec2<f32>) -> f32 {
  let i = floor(st);
  let f = fract(st);
  let a = random(i);
  let b = random(i + vec2<f32>(1.0, 0.0));
  let c = random(i + vec2<f32>(0.0, 1.0));
  let d = random(i + vec2<f32>(1.0, 1.0));
  let u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

fn fbm(st: vec2<f32>, octaves: i32, persistence: f32, lacunarity: f32) -> f32 {
  var value = 0.0;
  var amplitude = 1.0;
  var frequency = 1.0;
  var maxValue = 0.0;
  for (var i = 0; i < octaves; i++) {
    value += valueNoise(st * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return value / maxValue;
}

fn simplexNoise(st: vec2<f32>) -> f32 {
  let K1 = 0.366025404;
  let K2 = 0.211324865;
  let i = floor(st + (st.x + st.y) * K1);
  let a = st - i + (i.x + i.y) * K2;
  let o = vec2<f32>(step(a.y, a.x), 1.0 - step(a.y, a.x));
  let b = a - o + K2;
  let c = a - 1.0 + 2.0 * K2;
  let h = max(0.5 - vec3<f32>(dot(a, a), dot(b, b), dot(c, c)), vec3<f32>(0.0));
  let n = h * h * h * h * vec3<f32>(
    dot(a, vec2<f32>(random(i) - 0.5, random(i + vec2<f32>(1.0, 0.0)) - 0.5)),
    dot(b, vec2<f32>(random(i + o) - 0.5, random(i + o + vec2<f32>(1.0, 0.0)) - 0.5)),
    dot(c, vec2<f32>(random(i + vec2<f32>(1.0)) - 0.5, random(i + vec2<f32>(2.0, 1.0)) - 0.5))
  );
  return dot(n, vec3<f32>(70.0));
}

fn voronoi(st: vec2<f32>, randomness: f32) -> vec2<f32> {
  let n = floor(st);
  let f = fract(st);
  var minDist = 1.0;
  var minPoint = vec2<f32>(0.0);
  
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let neighbor = vec2<f32>(f32(i), f32(j));
      let point = vec2<f32>(random(n + neighbor), random(n + neighbor + vec2<f32>(0.1))) * randomness;
      let diff = neighbor + point - f;
      let dist = length(diff);
      
      if (dist < minDist) {
        minDist = dist;
        minPoint = point;
      }
    }
  }
  
  return vec2<f32>(minDist, minPoint.x);
}

// In your glslBuilder.js, around line 208, after the existing voronoi function
// and BEFORE the @fragment line, add:

fn ridgedNoise(st: vec2<f32>, octaves: i32, lacunarity: f32, gain: f32, offset: f32, threshold: f32) -> f32 {
  var value = 0.0;
  var amplitude = 1.0;
  var frequency = 1.0;
  var prev = 1.0;
  
  for (var i = 0; i < octaves; i++) {
    var n = valueNoise(st * frequency);
    n = abs(n);
    n = offset - n;
    n = n * n;
    n = n * prev;
    prev = n;
    value += n * amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  
  return max(value - threshold, 0.0);
}

fn warpedNoise(st: vec2<f32>, scale: f32, warpScale: f32, warpStrength: f32, octaves: i32) -> f32 {
  let warp1 = vec2<f32>(
    valueNoise(st * warpScale),
    valueNoise(st * warpScale + vec2<f32>(5.2, 1.3))
  );
  
  let warp2 = vec2<f32>(
    valueNoise(st * warpScale + 4.0 * warp1 + vec2<f32>(1.7, 9.2)),
    valueNoise(st * warpScale + 4.0 * warp1 + vec2<f32>(8.3, 2.8))
  );
  
  let warpedPos = st + warpStrength * warp2;
  return fbm(warpedPos * scale, octaves, 0.5, 2.0);
}



@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  var finalColor: vec3<f32> = vec3<f32>(0.0);
  ${lines.join('\n  ')}
  return vec4<f32>(finalColor, 1.0);
}
`;
  return code;
}