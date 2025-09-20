// src/core/WebGPUManager.js
import { initWebGPU } from '../gpu/gpuRenderer.js';
import { TextureManager } from './TextureManager.js';
import { CanvasCleanup } from '../utils/AppUtilities.js';

export class WebGPUManager {
  constructor() {
    this.device = null;
    this.textureManager = null;
    this.isReady = false;
  }

  async initialize(canvas) {
    try {
      this.device = await initWebGPU(canvas);
      
      if (this.device) {
        // Initialize texture manager
        this.textureManager = new TextureManager();
        await this.textureManager.initialize(this.device);
        
        // Make texture manager globally available
        window.textureManager = this.textureManager;
        
        console.log('✅ WebGPU and TextureManager initialized successfully');
      }
      
      this.isReady = !!this.device;
      return this.isReady;
      
    } catch (error) {
      console.error('WebGPU initialization failed:', error);
      this.isReady = false;
      return false;
    }
  }

  async reinitializeAfterLoad() {
    console.log("🔧 Reinitializing WebGPU after file load...");
    
    // Clean up any duplicate canvases
    const canvas = CanvasCleanup.cleanupDuplicateCanvases();
    if (!canvas) return false;
    
    try {
      console.log("🔄 Reinitializing WebGPU...");
      
      // Reset state
      this.isReady = false;
      
      // Reinitialize WebGPU with the canvas
      const success = await this.initialize(canvas);
      
      if (success) {
        console.log("✅ WebGPU reinitialized successfully");
        return true;
      } else {
        console.error("❌ Failed to reinitialize WebGPU");
        return false;
      }
    } catch (error) {
      console.error("❌ Error reinitializing WebGPU:", error);
      return false;
    }
  }

  getDevice() {
    return this.device;
  }

  getTextureManager() {
    return this.textureManager;
  }

  isDeviceReady() {
    return this.isReady;
  }

  destroy() {
    if (this.textureManager) {
      this.textureManager.destroy();
    }
    this.device = null;
    this.textureManager = null;
    this.isReady = false;
  }
}