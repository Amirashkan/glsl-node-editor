// src/gpu/gpuRenderer.js
// Complete WebGPU renderer with uniform buffer support

let _device = null;
let _context = null;
let _format = null;
let _canvas = null;
let _pipeline = null;
let _uniformBuffer = null;
let _bindGroup = null;

let _lastUserSrcHash = null;
let _lastCompileOK = false;
let _loggedForHash = new Set();

// Simple string hash
function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export async function initWebGPU(canvas) {
  if (_device) return _device;

  if (!navigator.gpu) {
    console.warn("WebGPU not available");
    return null;
  }

  _canvas = canvas || document.getElementById('gpu-canvas');
  if (!_canvas) {
    throw new Error("Canvas element not found");
  }

  _context = _canvas.getContext("webgpu");
  const adapter = await navigator.gpu.requestAdapter();
  _device = await adapter.requestDevice();

  _format = navigator.gpu.getPreferredCanvasFormat();
  _context.configure({
    device: _device,
    format: _format,
    alphaMode: "premultiplied",
  });

  // Create uniform buffer for time
  _uniformBuffer = _device.createBuffer({
    size: 16, // 4 bytes for f32, padded to 16 bytes for alignment
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  return _device;
}

function createPipelineAndBindGroup(wgsl) {
  const module = _device.createShaderModule({ code: wgsl });
  
  const pipeline = _device.createRenderPipeline({
    layout: "auto",
    vertex: { 
      module, 
      entryPoint: "vs_main" 
    },
    fragment: { 
      module, 
      entryPoint: "fs_main", 
      targets: [{ format: _format }] 
    },
    primitive: { 
      topology: "triangle-list" 
    },
  });

  // Create bind group for uniforms
  const bindGroup = _device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: _uniformBuffer,
        },
      },
    ],
  });

  return { pipeline, bindGroup };
}

export async function setShaderSource(wgsl) {
  if (!_device) throw new Error("initWebGPU must be called first");

  const srcHash = hash(String(wgsl || ""));
  if (srcHash === _lastUserSrcHash && !_lastCompileOK) {
    return false; // Already tried this broken shader
  }

  _lastUserSrcHash = srcHash;

  try {
    _device.pushErrorScope("validation");
    _device.pushErrorScope("internal");
    
    const result = createPipelineAndBindGroup(wgsl);
    
    const errs = await Promise.all([_device.popErrorScope(), _device.popErrorScope()]);
    const msgs = errs.filter(Boolean);
    if (msgs.length) throw msgs[0];
    
    _pipeline = result.pipeline;
    _bindGroup = result.bindGroup;
    _lastCompileOK = true;
    
    return true;
  } catch (e) {
    _lastCompileOK = false;
    if (!_loggedForHash.has(srcHash)) {
      _loggedForHash.add(srcHash);
      console.warn("[WGSL] Shader compilation failed:", e.message || e);
    }
    return false;
  }
}

export function render() {
  if (!_device || !_context || !_pipeline || !_bindGroup) return;

  // Update time uniform
  const time = performance.now() / 1000;
  const timeData = new Float32Array([time]);
  _device.queue.writeBuffer(_uniformBuffer, 0, timeData);

  // Render
  const encoder = _device.createCommandEncoder();
  const view = _context.getCurrentTexture().createView();
  
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view,
      clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
      loadOp: "clear",
      storeOp: "store"
    }],
  });

  pass.setPipeline(_pipeline);
  pass.setBindGroup(0, _bindGroup);
  pass.draw(3, 1, 0, 0); // Single triangle
  pass.end();
  
  _device.queue.submit([encoder.finish()]);
}

// Backward-compatible aliases
export const updateShader = setShaderSource;
export const drawFrame = render;
export function clearOnce() { /* no-op */ }
export function smokeTest() { /* no-op */ }