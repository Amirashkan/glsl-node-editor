// src/core/renderers/TextureRenderer.js

export class TextureRenderer {
  constructor(textureManager) {
    this.textureManager = textureManager;
  }

  render(ctx, node, size) {
    switch (node.kind.toLowerCase()) {
      case 'texture2d':
        this.renderTexture2D(ctx, node, size);
        break;
      case 'texturecube':
        this.renderTextureCube(ctx, node, size);
        break;
      default:
        this.renderPlaceholder(ctx, node, size);
    }
  }

  renderTexture2D(ctx, node, size) {
    // Clear background
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, size, size);
    
    // Check if texture is loaded via TextureManager
    const textureInfo = this.textureManager?.getTexture(node.id);
    
    if (textureInfo && textureInfo.bitmap) {
      // Draw the actual texture
      try {
        ctx.drawImage(textureInfo.bitmap, 0, 0, size, size);
        
        // Add 2D indicator
        this.addTextureIndicator(ctx, '2D', '#4a90e2');
      } catch (error) {
        console.warn('Failed to draw texture bitmap:', error);
        this.renderLoadingState(ctx, size);
      }
    } else if (textureInfo && textureInfo.file) {
      // Texture is being loaded
      this.renderLoadingState(ctx, size);
    } else {
      // No texture loaded
      this.renderTexturePlaceholder(ctx, '2D TEX', size);
    }
  }

  renderTextureCube(ctx, node, size) {
    // Clear background
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, size, size);
    
    const textureInfo = this.textureManager?.getTexture(node.id);
    
    if (textureInfo && textureInfo.bitmap) {
      try {
        // For cube textures, show the texture with a cube pattern overlay
        ctx.drawImage(textureInfo.bitmap, 0, 0, size, size);
        this.addCubePattern(ctx, size);
        this.addTextureIndicator(ctx, 'CUBE', '#9333ea');
      } catch (error) {
        console.warn('Failed to draw cube texture bitmap:', error);
        this.renderLoadingState(ctx, size);
      }
    } else if (textureInfo && textureInfo.file) {
      this.renderLoadingState(ctx, size);
    } else {
      this.renderTexturePlaceholder(ctx, 'CUBE', size);
    }
  }

  renderLoadingState(ctx, size) {
    ctx.fillStyle = '#555';
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = '#4a90e2';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', size/2, size/2);
  }

  renderTexturePlaceholder(ctx, label, size) {
    // Dark background
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, size, size);
    
    // Blue border
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, size-4, size-4);
    
    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    
    if (label.includes(' ')) {
      const parts = label.split(' ');
      ctx.fillText(parts[0], size/2, size/2 - 4);
      ctx.fillText(parts[1], size/2, size/2 + 10);
    } else {
      ctx.fillText(label, size/2, size/2);
    }
  }

  renderPlaceholder(ctx, node, size) {
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('UNKNOWN', size/2, size/2);
    ctx.fillText('TEXTURE', size/2, size/2 + 10);
  }

  addTextureIndicator(ctx, text, color) {
    // Small colored indicator in top-left
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 14, 10);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(text, 2, 8);
  }

  addCubePattern(ctx, size) {
    // Add a subtle cube pattern overlay for cube textures
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    
    // Draw cube wireframe
    const third = size / 3;
    ctx.beginPath();
    
    // Front face
    ctx.rect(third * 0.5, third * 0.5, third, third);
    
    // Back face (offset)
    ctx.rect(third * 1.2, third * 0.2, third * 0.8, third * 0.8);
    
    // Connect corners to show 3D effect
    ctx.moveTo(third * 0.5, third * 0.5);
    ctx.lineTo(third * 1.2, third * 0.2);
    
    ctx.moveTo(third * 1.5, third * 0.5);
    ctx.lineTo(third * 2.0, third * 0.2);
    
    ctx.moveTo(third * 0.5, third * 1.5);
    ctx.lineTo(third * 1.2, third * 1.0);
     
    ctx.moveTo(third * 1.5, third * 1.5);
    ctx.lineTo(third * 2.0, third * 1.0);
    
    ctx.stroke();
  }
}