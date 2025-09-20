// src/codegen/glslBuilder.js - Refactored WGSL builder with maintainable structure

// ============================================================================
// UTILITIES
// ============================================================================

function topoOrder(graph) {
  const nodes = graph.nodes || [];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const visited = new Set();
  const out = [];
  
  function visit(id) {
    if (!id || visited.has(id)) return;
    visited.add(id);
    const n = byId.get(id);
    if (!n) return;
    for (const inp of (n.inputs || [])) {
      if (inp) visit(inp);
    }
    out.push(n);
  }
  
  for (const n of nodes) visit(n.id);
  return out;
}

function sanitize(id) { 
  return String(id).replace(/[^a-zA-Z0-9_]/g, '_'); 
}

function pickActiveOutput(graph) {
  const outs = (graph.nodes || []).filter(n => /OutputFinal/i.test(n.kind || n.type || n.name || ''));
  const connected = outs.filter(o => Array.isArray(o.inputs) && o.inputs[0]);
  if (connected.length) return connected[connected.length - 1];
  return outs[outs.length - 1] || null;
}

function upstreamSet(start, byId) {
  const vis = new Set();
  (function dfs(id) {
    if (!id || vis.has(id)) return;
    vis.add(id);
    const n = byId.get(id);
    if (!n) return;
    for (const inp of (n.inputs || [])) {
      if (inp) dfs(inp);
    }
  })(start);
  return vis;
}

// ============================================================================
// TYPE CONVERSION SYSTEM
// ============================================================================

class TypeConverter {
  constructor() {
    this.types = new Map();   // nodeId -> 'f32' | 'vec2' | 'vec3' | 'vec4'
    this.exprs = new Map();   // nodeId -> expression string
  }

  setNodeOutput(nodeId, expression, type) {
    this.exprs.set(nodeId, expression);
    this.types.set(nodeId, type);
  }

  want(id, wantType) {
    const sid = sanitize(id);
    let e = this.exprs.get(id);
    let t = this.types.get(id);
    if (!e) { e = 'vec3<f32>(0.0)'; t = 'vec3'; }
    
    if (wantType === 'vec4') return this._toVec4(e, t);
    if (wantType === 'vec3') return this._toVec3(e, t);
    if (wantType === 'vec2') return this._toVec2(e, t);
    if (wantType === 'f32') return this._toF32(e, t);
    return e;
  }

  _toVec4(e, t) {
    if (t === 'vec4') return e;
    if (t === 'vec3') return `vec4<f32>(${e}, 1.0)`;
    if (t === 'vec2') return `vec4<f32>(${e}.x, ${e}.y, 0.0, 1.0)`;
    if (t === 'f32') return `vec4<f32>(${e})`;
    return `vec4<f32>(${e}, 1.0)`;
  }

  _toVec3(e, t) {
    if (t === 'vec3') return e;
    if (t === 'vec4') return `vec3<f32>(${e}.x, ${e}.y, ${e}.z)`;
    if (t === 'vec2') return `vec3<f32>(${e}.x, ${e}.y, 0.0)`;
    if (t === 'f32') return `vec3<f32>(${e})`;
    return e;
  }

  _toVec2(e, t) {
    if (t === 'vec2') return e;
    if (t === 'vec4') return `vec2<f32>(${e}.x, ${e}.y)`;
    if (t === 'vec3') return `vec2<f32>(${e}.x, ${e}.y)`;
    if (t === 'f32') return `vec2<f32>(${e})`;
    return `vec2<f32>(0.0)`;
  }

  _toF32(e, t) {
    if (t === 'f32') return e;
    if (t === 'vec4') return `${e}.w`;
    if (t === 'vec2') return `(${e}.x + ${e}.y) * 0.5`;
    if (t === 'vec3') return `(${e}.x + ${e}.y + ${e}.z) / 3.0`;
    return e;
  }
}

// ============================================================================
// TEXTURE BINDING SYSTEM
// ============================================================================

function generateTextureBindings(graph) {
  let textureBindings = '';
  let bindingIndex = 1; // Start after uniforms at binding 0
  
  if (!graph.nodes) return { bindings: textureBindings, nextBinding: bindingIndex };
  
  for (const node of graph.nodes) {
    if (node.kind === 'Texture2D') {
      const nodeId = sanitize(node.id);
      textureBindings += `
@group(0) @binding(${bindingIndex}) var texture_${nodeId}: texture_2d<f32>;
@group(0) @binding(${bindingIndex + 1}) var sampler_${nodeId}: sampler;`;
      bindingIndex += 2;
    } else if (node.kind === 'TextureCube') {
      const nodeId = sanitize(node.id);
      textureBindings += `
@group(0) @binding(${bindingIndex}) var textureCube_${nodeId}: texture_cube<f32>;
@group(0) @binding(${bindingIndex + 1}) var samplerCube_${nodeId}: sampler;`;
      bindingIndex += 2;
    }
  }
  
  return { bindings: textureBindings, nextBinding: bindingIndex };
}

// ============================================================================
// NODE PROCESSORS
// ============================================================================

class NodeProcessors {
  constructor(converter) {
    this.converter = converter;
  }

  // Input nodes
  processUV(node, id) {
    return { line: `let node_${id} = in.uv;`, type: 'vec2' };
  }

  processTime(node, id) {
    return { line: `let node_${id} = u.time;`, type: 'f32' };
  }

  // Constant nodes
  processConstFloat(node, id) {
    const v = (typeof node.value === 'number') ? node.value : (node.props?.value ?? 0.0);
    return { line: `let node_${id} = ${v.toFixed(6)};`, type: 'f32' };
  }

  processConstVec3(node, id) {
    // Read from props, NOT coordinates
    const x = parseFloat(node.props?.x) || 0;
    const y = parseFloat(node.props?.y) || 0;
    const z = parseFloat(node.props?.z) || 0;
    
    const line = `let node_${id} = vec3<f32>(${x.toFixed(6)}, ${y.toFixed(6)}, ${z.toFixed(6)});`;
    return { line, type: 'vec3' };
  }

  // Expression node
  processExpr(node, id) {
    const a = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'f32') : '0.0';
    const b = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'f32') : '0.0';
    let expr = (node.expr || 'a').toString();
    
    console.log('Original expression:', expr);
    
    // Replace variables with connected inputs FIRST
    expr = expr.replace(/\ba\b/g, `(${a})`);
    expr = expr.replace(/\bb\b/g, `(${b})`);
    
    // Replace built-in references
    expr = expr.replace(/\bu_time\b/g, 'u.time');
    expr = expr.replace(/\buv\b/g, 'in.uv');
    expr = expr.replace(/\b(pi|PI)\b/g, '3.14159265359');
    
    console.log('Final WGSL expression:', expr);
    
    return { line: `let node_${id} = ${expr};`, type: 'f32' };
  }

  // Field nodes
  processCircleField(node, id) {
    const R = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'f32') : (node.props?.radius ?? 0.25);
    const E = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'f32') : (node.props?.epsilon ?? 0.02);
    const line = `let node_${id} = 1.0 - smoothstep((${R}) - max(${E}, 0.0001), (${R}) + max(${E}, 0.0001), distance(in.uv, vec2<f32>(0.5, 0.5)));`;
    return { line, type: 'f32' };
  }

  // Math operations (vector)
  processMathVec3(node, id, op) {
    const A = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(1.0)';
    const B = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'vec3') : 'vec3<f32>(1.0)';
    
    let operation;
    switch (op) {
      case 'Multiply': operation = `(${A}) * (${B})`; break;
      case 'Add': operation = `(${A}) + (${B})`; break;
      case 'Subtract': operation = `(${A}) - (${B})`; break;
      case 'Divide': operation = `(${A}) / max((${B}), vec3<f32>(0.0001))`; break;
      default: operation = `(${A}) + (${B})`;
    }
    
    const line = `let node_${id} = ${operation};`;
    console.log(`${op} line: ${line}`);
    return { line, type: 'vec3' };
  }

  // Math functions (scalar)
  processMathScalar(node, id, func) {
    const inp = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'f32') : '0.0';
    let operation;
    
    switch (func) {
      case 'Sin': operation = `sin(${inp})`; break;
      case 'Cos': operation = `cos(${inp})`; break;
      case 'Tan': operation = `tan(${inp})`; break;
      case 'Floor': operation = `floor(${inp})`; break;
      case 'Fract': operation = `fract(${inp})`; break;
      case 'Abs': operation = `abs(${inp})`; break;
      case 'Sqrt': operation = `sqrt(max(${inp}, 0.0))`; break;
      case 'Sign': operation = `sign(${inp})`; break;
      default: operation = inp;
    }
    
    return { line: `let node_${id} = ${operation};`, type: 'f32' };
  }

  // Two-input math functions
  processMathDual(node, id, func) {
    const a = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'f32') : '0.0';
    const b = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'f32') : '0.0';
    let operation;
    
    switch (func) {
      case 'Pow': operation = `pow(${a}, ${b})`; break;
      case 'Min': operation = `min(${a}, ${b})`; break;
      case 'Max': operation = `max(${a}, ${b})`; break;
      case 'Step': operation = `step(${a}, ${b})`; break;
      case 'Mod': operation = `${a} - ${b} * floor(${a} / max(${b}, 0.0001))`; break;
      default: operation = `${a}`;
    }
    
    return { line: `let node_${id} = ${operation};`, type: 'f32' };
  }

  // Three-input functions
  processMathTriple(node, id, func) {
    if (func === 'Clamp') {
      const value = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'f32') : '0.0';
      const minVal = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'f32') : '0.0';
      const maxVal = node.inputs?.[2] ? this.converter.want(node.inputs[2], 'f32') : '1.0';
      return { line: `let node_${id} = clamp(${value}, ${minVal}, ${maxVal});`, type: 'f32' };
    }
    
    if (func === 'Smoothstep') {
      const edge0 = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'f32') : '0.0';
      const edge1 = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'f32') : '1.0';
      const x = node.inputs?.[2] ? this.converter.want(node.inputs[2], 'f32') : '0.5';
      return { line: `let node_${id} = smoothstep(${edge0}, ${edge1}, ${x});`, type: 'f32' };
    }
    
    if (func === 'Mix') {
      const a = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(0.0)';
      const b = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'vec3') : 'vec3<f32>(1.0)';
      const t = node.inputs?.[2] ? this.converter.want(node.inputs[2], 'f32') : '0.5';
      return { line: `let node_${id} = mix(${a}, ${b}, ${t});`, type: 'vec3' };
    }
    
    return { line: `let node_${id} = 0.0;`, type: 'f32' };
  }

  // Vector operations
  processVectorOp(node, id, op) {
    if (op === 'Dot') {
      const a = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(1.0, 0.0, 0.0)';
      const b = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'vec3') : 'vec3<f32>(0.0, 1.0, 0.0)';
      return { line: `let node_${id} = dot(${a}, ${b});`, type: 'f32' };
    }
    
    if (op === 'Cross') {
      const a = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(1.0, 0.0, 0.0)';
      const b = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'vec3') : 'vec3<f32>(0.0, 1.0, 0.0)';
      return { line: `let node_${id} = cross(${a}, ${b});`, type: 'vec3' };
    }
    
    if (op === 'Normalize') {
      const vec = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(1.0, 0.0, 0.0)';
      return { line: `let node_${id} = normalize(${vec});`, type: 'vec3' };
    }
    
    if (op === 'Length') {
      const vec = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(0.0)';
      return { line: `let node_${id} = length(${vec});`, type: 'f32' };
    }
    
    if (op === 'Distance') {
      const a = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(0.0)';
      const b = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'vec3') : 'vec3<f32>(0.0)';
      return { line: `let node_${id} = distance(${a}, ${b});`, type: 'f32' };
    }
    
    if (op === 'Reflect') {
      const incident = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(1.0, -1.0, 0.0)';
      const normal = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'vec3') : 'vec3<f32>(0.0, 1.0, 0.0)';
      return { line: `let node_${id} = reflect(${incident}, ${normal});`, type: 'vec3' };
    }
    
    if (op === 'Refract') {
      const incident = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(1.0, -1.0, 0.0)';
      const normal = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'vec3') : 'vec3<f32>(0.0, 1.0, 0.0)';
      const eta = node.inputs?.[2] ? this.converter.want(node.inputs[2], 'f32') : '1.5';
      return { line: `let node_${id} = refract(${incident}, ${normal}, ${eta});`, type: 'vec3' };
    }
    
    return { line: `let node_${id} = vec3<f32>(0.0);`, type: 'vec3' };
  }

  // Utility nodes
  processSaturate(node, id) {
    const v = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(0.0)';
    return { line: `let node_${id} = clamp(${v}, vec3<f32>(0.0), vec3<f32>(1.0));`, type: 'vec3' };
  }

  processSplit3(node, id) {
    const vec = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(0.0)';
    return { line: `let node_${id} = ${vec};`, type: 'vec3' };
  }

  processCombine3(node, id) {
    const x = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'f32') : '0.0';
    const y = node.inputs?.[1] ? this.converter.want(node.inputs[1], 'f32') : '0.0';
    const z = node.inputs?.[2] ? this.converter.want(node.inputs[2], 'f32') : '0.0';
    return { line: `let node_${id} = vec3<f32>(${x}, ${y}, ${z});`, type: 'vec3' };
  }

  // Noise nodes
  processRandom(node, id) {
    const uv = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec2') : 'in.uv';
    const seed = node.props?.seed ?? 1.0;
    const scale = node.props?.scale ?? 1.0;
    const line = `let node_${id} = vec3<f32>(random(${uv} * ${scale.toFixed(3)} + vec2<f32>(${seed.toFixed(3)})));`;
    return { line, type: 'vec3' };
  }

  processValueNoise(node, id) {
    const uv = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec2') : 'in.uv';
    const scale = node.props?.scale ?? 5.0;
    const amplitude = node.props?.amplitude ?? 1.0;
    const offset = node.props?.offset ?? 0.0;
    const power = node.props?.power ?? 1.0;
    const line = `let node_${id} = vec3<f32>(clamp(pow(valueNoise(${uv} * ${scale.toFixed(3)}) * ${amplitude.toFixed(3)} + ${offset.toFixed(3)}, ${power.toFixed(3)}), 0.0, 1.0));`;
    return { line, type: 'vec3' };
  }

  processAdvancedNoise(node, id, type) {
    const uv = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec2') : 'in.uv';
    
    if (type === 'FBMNoise') {
      const scale = node.props?.scale ?? 3.0;
      const octaves = node.props?.octaves ?? 4;
      const persistence = node.props?.persistence ?? 0.5;
      const lacunarity = node.props?.lacunarity ?? 2.0;
      const amplitude = node.props?.amplitude ?? 1.0;
      const offset = node.props?.offset ?? 0.0;
      const gain = node.props?.gain ?? 0.5;
      const warp = node.props?.warp ?? 0.0;
      
      let uvExpr = `${uv} * ${scale.toFixed(3)}`;
      if (warp > 0.001) {
        uvExpr = `${uvExpr} + vec2<f32>(valueNoise(${uv} * ${(scale * 2.0).toFixed(3)}) * ${warp.toFixed(3)})`;
      }
      const line = `let node_${id} = vec3<f32>(clamp((fbm(${uvExpr}, ${octaves}, ${persistence.toFixed(3)}, ${lacunarity.toFixed(3)}) * ${amplitude.toFixed(3)} + ${offset.toFixed(3)}) * ${gain.toFixed(3)}, 0.0, 1.0));`;
      return { line, type: 'vec3' };
    }
    
    // Add other noise types as needed...
    return { line: `let node_${id} = vec3<f32>(0.0);`, type: 'vec3' };
  }

  // Texture nodes
  processTexture2D(node, id) {
    const uv = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec2') : 'in.uv';
    const textureId = sanitize(node.id);
    const line = `let node_${id} = textureSample(texture_${textureId}, sampler_${textureId}, ${uv});`;
    console.log(`Texture2D line: ${line}`);
    return { line, type: 'vec4' };
  }

  processTextureCube(node, id) {
    const dir = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 
      'normalize(vec3<f32>(in.uv.x * 2.0 - 1.0, in.uv.y * 2.0 - 1.0, 1.0))';
    const textureId = sanitize(node.id);
    const line = `let node_${id} = textureSample(textureCube_${textureId}, samplerCube_${textureId}, ${dir});`;
    console.log(`TextureCube line: ${line}`);
    return { line, type: 'vec4' };
  }

  // Output node
  processOutputFinal(node, id) {
    const c = node.inputs?.[0] ? this.converter.want(node.inputs[0], 'vec3') : 'vec3<f32>(0.0,0.0,0.0)';
    const line = `finalColor = ${c};`;
    console.log(`OutputFinal line: ${line}`);
    return { line, type: 'vec3' };
  }
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

export function buildWGSL(graph) {
  console.log('=== WGSL Builder: Starting ===');
  
  let ordered = topoOrder(graph);
  
  // Debug logging
  console.log('=== DEBUG: All nodes before filtering ===');
  if (graph.nodes) {
    graph.nodes.forEach(node => {
      console.log(`Node ${node.id}: kind="${node.kind}" type="${node.type}" name="${node.name}"`);
    });
  }
  
  console.log('=== DEBUG: Ordered nodes ===');
  ordered.forEach(node => {
    console.log(`Ordered: ${node.id} -> kind="${node.kind}"`);
  });

  // Filter to only connected nodes
  const outNode = pickActiveOutput(graph);
  if (outNode) {
    const byId = new Map((graph.nodes || []).map(n => [n.id, n]));
    const keep = upstreamSet(outNode.id, byId);
    ordered = ordered.filter(n => keep.has(n.id));
    console.log(`Filtered to ${ordered.length} connected nodes`);
  }

  // Handle empty graph
  if (!outNode || ordered.length === 0) {
    console.log('Empty graph, returning fallback shader');
    return generateFallbackShader();
  }

  // Process nodes
  const converter = new TypeConverter();
  const processors = new NodeProcessors(converter);
  const lines = [];

  for (const node of ordered) {
    const id = sanitize(node.id);
    console.log(`Processing node ${id}: kind="${node.kind}"`);
    
    const result = processNode(node, id, processors);
    
    if (result) {
      console.log(`Generated line for ${node.kind}: ${result.line}`);
      lines.push(result.line);
      
      // Save for downstream nodes (except OutputFinal)
      if (node.kind !== 'OutputFinal') {
        converter.setNodeOutput(node.id, `node_${id}`, result.type);
      }
    }
  }

  // Generate final shader
  const textureInfo = generateTextureBindings(graph);
  const shader = generateShaderCode(textureInfo.bindings, lines);
  
  console.log('=== WGSL Builder: Complete ===');
  return shader;
}

// ============================================================================
// NODE PROCESSING DISPATCHER
// ============================================================================

function processNode(node, id, processors) {
  const kind = node.kind;
  
  // Input nodes
  if (kind === 'UV') return processors.processUV(node, id);
  if (kind === 'Time') return processors.processTime(node, id);
  
  // Constants
  if (kind === 'ConstFloat') return processors.processConstFloat(node, id);
  if (kind === 'ConstVec3') return processors.processConstVec3(node, id);
  
  // Expression
  if (kind === 'Expr') return processors.processExpr(node, id);
  
  // Fields
  if (kind === 'CircleField') return processors.processCircleField(node, id);
  
  // Vector math
  if (['Multiply', 'Add', 'Subtract', 'Divide'].includes(kind)) {
    return processors.processMathVec3(node, id, kind);
  }
  
  // Scalar math functions
  if (['Sin', 'Cos', 'Tan', 'Floor', 'Fract', 'Abs', 'Sqrt', 'Sign'].includes(kind)) {
    return processors.processMathScalar(node, id, kind);
  }
  
  // Dual input math
  if (['Pow', 'Min', 'Max', 'Step', 'Mod'].includes(kind)) {
    return processors.processMathDual(node, id, kind);
  }
  
  // Triple input math
  if (['Clamp', 'Smoothstep', 'Mix'].includes(kind)) {
    return processors.processMathTriple(node, id, kind);
  }
  
  // Vector operations
  if (['Dot', 'Cross', 'Normalize', 'Length', 'Distance', 'Reflect', 'Refract'].includes(kind)) {
    return processors.processVectorOp(node, id, kind);
  }
  
  // Utility
  if (kind === 'Saturate') return processors.processSaturate(node, id);
  if (kind === 'Split3') return processors.processSplit3(node, id);
  if (kind === 'Combine3') return processors.processCombine3(node, id);
  
  // Noise
  if (kind === 'Random') return processors.processRandom(node, id);
  if (kind === 'ValueNoise') return processors.processValueNoise(node, id);
  if (kind === 'FBMNoise') return processors.processAdvancedNoise(node, id, kind);
  
  // Textures
  if (kind === 'Texture2D') return processors.processTexture2D(node, id);
  if (kind === 'TextureCube') return processors.processTextureCube(node, id);
  
  // Output
  if (kind === 'OutputFinal') return processors.processOutputFinal(node, id);
  
  // Unknown node
  console.log(`UNKNOWN NODE TYPE: "${kind}"`);
  return { line: `let node_${id} = vec3<f32>(0.0);`, type: 'vec3' };
}

// ============================================================================
// SHADER CODE GENERATION
// ============================================================================

function generateFallbackShader() {
  return `
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
fn random(st: vec2<f32>) -> f32 {
  return fract(sin(dot(st, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}
@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}`;
}

function generateShaderCode(textureBindings, nodeLines) {
  return `
struct Globals {
  time: f32,
}

@group(0) @binding(0) var<uniform> u : Globals;${textureBindings}

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
  ${nodeLines.join('\n  ')}
  let _keep_uniform = u.time * 0.0;
  return vec4<f32>(finalColor + vec3<f32>(_keep_uniform), 1.0);
}
`;}