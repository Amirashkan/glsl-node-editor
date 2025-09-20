// src/core/renderers/RenderingContext.js
// Higher-level canvas operations and reusable drawing primitives

export class RenderingContext {
  constructor(ctx) {
    this.ctx = ctx;
  }

  // Reusable shape drawing
  drawRoundedRect(x, y, width, height, radius, style = {}) {
    const ctx = this.ctx;
    
    ctx.save();
    
    if (style.shadow) {
      ctx.shadowColor = style.shadow.color || 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = style.shadow.blur || 3;
      ctx.shadowOffsetX = style.shadow.offsetX || 0;
      ctx.shadowOffsetY = style.shadow.offsetY || 1;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    
    if (style.fill) {
      if (Array.isArray(style.fill)) {
        // Gradient fill
        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        style.fill.forEach((color, index) => {
          gradient.addColorStop(index / (style.fill.length - 1), color);
        });
        ctx.fillStyle = gradient;
      } else if (style.fill instanceof CanvasGradient || style.fill instanceof CanvasPattern) {
        // Already a gradient or pattern object
        ctx.fillStyle = style.fill;
      } else {
        ctx.fillStyle = style.fill;
      }
      ctx.fill();
    }
    
    if (style.stroke) {
      ctx.strokeStyle = style.stroke.color || style.stroke;
      ctx.lineWidth = style.stroke.width || 1;
      ctx.stroke();
    }
    
    ctx.restore();
  }

  drawGlow(x, y, width, height, radius, glowStyle) {
    if (!glowStyle) return;
    
    const ctx = this.ctx;
    ctx.save();
    
    ctx.shadowColor = glowStyle.color;
    ctx.shadowBlur = glowStyle.blur;
    ctx.strokeStyle = glowStyle.innerColor || 'rgba(102, 170, 255, 0.3)';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, width - 2, height - 2, radius - 1);
    ctx.stroke();
    
    ctx.restore();
  }

  drawPin(x, y, style) {
    const ctx = this.ctx;
    ctx.save();

    // Glow effect
    if (style.glowRadius > 0) {
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur = style.glowRadius;
    }

    // Outer ring
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, style.radius + 1, 0, Math.PI * 2);
    ctx.stroke();

    // Main pin
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(x, y, style.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(x - 1, y - 1, style.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawBezierWire(x1, y1, x2, y2, color, width = 2) {
    const ctx = this.ctx;
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    
    ctx.save();
    
    // Wire shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
    ctx.stroke();
    
    ctx.restore();
  }

  drawText(text, x, y, style) {
    const ctx = this.ctx;
    ctx.save();
    
    ctx.font = style.font;
    ctx.fillStyle = style.color;
    ctx.textAlign = style.align || 'left';
    ctx.textBaseline = style.baseline || 'alphabetic';
    
    if (style.weight) {
      ctx.fontWeight = style.weight;
    }
    
    ctx.fillText(text, x, y);
    ctx.restore();
    
    return ctx.measureText(text);
  }

  drawControlButton(x, y, width, height, style, text) {
    const ctx = this.ctx;
    
    // Button background
    this.drawRoundedRect(x - 1, y - 8, width, height, 2, {
      fill: style.bg
    });
    
    // Button text
    this.drawText(text, x + 3, y - 1, {
      font: `8px ui-monospace, Consolas, monospace`,
      color: style.color
    });
  }

  drawLabelBackground(x, y, width, height, radius = 3) {
    const ctx = this.ctx;
    
    // Enhanced label background with gradient
    const gradient = ctx.createLinearGradient(x, y - 8, x, y + 4);
    gradient.addColorStop(0, 'rgba(20, 20, 25, 0.95)');
    gradient.addColorStop(1, 'rgba(15, 15, 20, 0.95)');
    
    this.drawRoundedRect(x, y - 8, width, height, radius, {
      fill: gradient,
      stroke: {
        color: 'rgba(255, 255, 255, 0.1)',
        width: 1
      }
    });
  }

  drawThumbnail(thumbX, thumbY, thumbSize, thumbnail, style) {
    const ctx = this.ctx;
    ctx.save();

    // Thumbnail background
    this.drawRoundedRect(
      thumbX - style.padding, 
      thumbY - style.padding, 
      thumbSize + style.padding * 2, 
      thumbSize + style.padding * 2, 
      style.borderRadius, 
      {
        fill: style.background,
        stroke: {
          color: style.border,
          width: style.borderWidth
        }
      }
    );

    // Enable smooth scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw thumbnail content
    if (thumbnail instanceof HTMLCanvasElement) {
      ctx.drawImage(thumbnail, thumbX, thumbY, thumbSize, thumbSize);
    } else if (thumbnail instanceof ImageData) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = thumbnail.width;
      tempCanvas.height = thumbnail.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(thumbnail, 0, 0);
      ctx.drawImage(tempCanvas, thumbX, thumbY, thumbSize, thumbSize);
    }

    // Inner border
    this.drawRoundedRect(thumbX, thumbY, thumbSize, thumbSize, style.borderRadius - 1, {
      stroke: {
        color: style.innerBorder,
        width: 1
      }
    });

    ctx.restore();
  }

  drawSelectionBox(x0, y0, x1, y1) {
    const ctx = this.ctx;
    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const width = Math.abs(x1 - x0);
    const height = Math.abs(y1 - y0);

    ctx.save();
    ctx.setLineDash([8, 4]);
    ctx.strokeStyle = '#66aaff';
    ctx.fillStyle = 'rgba(102, 170, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }

  applyViewportTransform(viewport) {
    this.ctx.save();
    this.ctx.translate(viewport.offsetX, viewport.offsetY);
    this.ctx.scale(viewport.scale, viewport.scale);
  }

  restoreViewportTransform() {
    this.ctx.restore();
  }

  clear() {
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}