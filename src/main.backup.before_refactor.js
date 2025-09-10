
// src/main.js
// Minimal driver that debounces rebuilds and never rebuilds inside RAF.

import { initWebGPU, setShaderSource, render } from "./gpu/gpuRenderer.js";

const canvas = document.getElementById("app-canvas");
let inited = false;

// Simple debounce
async function ensureDomReady() {
  if (document.readyState === 'loading') {
    await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
  }
}

async function ensureInit() {
  await ensureDomReady();
  const canvas =
    document.getElementById('webgpu-canvas') ||
    document.querySelector('canvas') ||
    (function () {
      // اگر نبود، بساز
      const c = document.createElement('canvas');
      c.id = 'webgpu-canvas';
      c.width = innerWidth;
      c.height = innerHeight;
      document.body.appendChild(c);
      return c;
    })();

  await initWebGPU({ canvas });  // ← canvas را صراحتاً می‌فرستیم
}

function debounce(fn, wait) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function ensureInit() {
  if (inited) return;
  const dev = await initWebGPU(canvas);
  inited = !!dev;
}

async function rebuild(wgsl) {
  await ensureInit();
  await setShaderSource(wgsl);
}

// Only rebuild when source really changes (e.g., editor onChange)
export const queueRebuild = debounce((wgsl) => {
  rebuild(wgsl);
}, 120);

// Render loop is independent of (re)builds.
function tick() {
  render();
  requestAnimationFrame(tick);
}
ensureInit().then(() => requestAnimationFrame(tick));

// If you used to call updateShader directly elsewhere, replace with queueRebuild.
// For quick testing you can expose it:
window.queueRebuild = queueRebuild;
