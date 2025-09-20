// src/core/renderers/NodeThumbnailRenderer.js

export class NodeThumbnailRenderer {
  constructor() {
    this.renderMap = new Map([
      // Basic types
      ['constfloat', this.renderFloat.bind(this)],
      ['float', this.renderFloat.bind(this)],
      ['constvec3', this.renderVec3.bind(this)],
      ['vec3', this.renderVec3.bind(this)],
      ['constvec2', this.renderVec2.bind(this)],
      ['vec2', this.renderVec2.bind(this)],
      
      // Math operations
      ['multiply', this.renderMath.bind(this, '×', '#f59e0b')],
      ['add', this.renderMath.bind(this, '+', '#60a5fa')],
      ['subtract', this.renderMath.bind(this, '−', '#f87171')],
      ['divide', this.renderMath.bind(this, '÷', '#a78bfa')],
      
      // Vector operations
      ['dot', this.renderDot.bind(this)],
      ['cross', this.renderCross.bind(this)],
      ['normalize', this.renderNormalize.bind(this)],
      ['length', this.renderLength.bind(this)],
      ['distance', this.renderDistance.bind(this)],
      ['reflect', this.renderReflect.bind(this)],
      ['refract', this.renderRefract.bind(this)],
      
      // Special nodes
      ['uv', this.renderUV.bind(this)],
      ['time', this.renderTime.bind(this)],
      ['expr', this.renderExpression.bind(this)],
      ['saturate', this.renderSaturate.bind(this)],
      ['circlefield', this.renderCircle.bind(this)],
      ['circle', this.renderCircle.bind(this)],
      
      // Output
      ['output', this.renderOutput.bind(this)],
      ['outputfinal', this.renderOutput.bind(this)]
    ]);
  }

  render(ctx, node, computedValue, size) {
    // Clear background
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, size, size);
    
    const renderer = this.renderMap.get(node.kind.toLowerCase());
    if (renderer) {
      renderer(ctx, node, computedValue, size);
    } else {
      this.renderGeneric(ctx, node, computedValue, size);
    }
  }

  renderFloat(ctx, node, value, size) {
    const numValue = typeof value === 'number' ? value : 0;
    const intensity = Math.min(0.8, Math.abs(numValue) / 10);
    const hue = numValue >= 0 ? 120 : 0;
    
    ctx.fillStyle = `hsl(${hue}, 60%, ${10 + intensity * 30}%)`;
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = `hsl(${hue}, 80%, 80%)`;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = Math.abs(numValue) < 0.01 ? 
      numValue.toExponential(1) : 
      numValue.toFixed(2);
    
    ctx.fillText(text, size/2, size/2);
  }

  renderVec3(ctx, node, value, size) {
    const vec = this.toVec3(value);
    const [r, g, b] = vec.map(v => Math.abs(v) * 127 + 128);
    
    ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    ctx.fillRect(0, 0, size, size);
    
    // Add component labels
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`X:${vec[0].toFixed(2)}`, size/2, 10);
    ctx.fillText(`Y:${vec[1].toFixed(2)}`, size/2, 20);
    ctx.fillText(`Z:${vec[2].toFixed(2)}`, size/2, 30);
  }

  renderVec2(ctx, node, value, size) {
    const vec = this.toVec2(value);
    const [x, y] = vec;
    
    // Vector visualization
    const centerX = size / 2;
    const centerY = size / 2;
    const scale = size * 0.3;
    
    ctx.fillStyle = `hsl(${x * 180}, 60%, 30%)`;
    ctx.fillRect(0, 0, size, size);
    
    // Arrow
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + x * scale, centerY - y * scale);
    ctx.stroke();
  }

  renderMath(symbol, color, ctx, node, value, size) {
    ctx.fillStyle = color + '20';
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = color;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(symbol, size/2, size/2 - 4);
    
    // Show result
    if (typeof value === 'number') {
      ctx.font = '8px monospace';
      const resultText = Math.abs(value) < 0.01 ? 
        value.toExponential(1) : 
        value.toFixed(2);
      ctx.fillText(resultText, size/2, size/2 + 12);
    }
  }

  renderUV(ctx, node, value, size) {
    // UV gradient
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const r = Math.floor(u * 255);
        const g = Math.floor(v * 255);
        ctx.fillStyle = `rgb(${r}, ${g}, 128)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  renderTime(ctx, node, value, size) {
    const time = typeof value === 'number' ? value : (Date.now() / 1000) % (Math.PI * 2);
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);
    
    // Clock visualization
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.3;
    
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Clock hand
    const angle = time % (Math.PI * 2);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.sin(angle) * radius * 0.8,
      centerY - Math.cos(angle) * radius * 0.8
    );
    ctx.stroke();
  }

  renderExpression(ctx, node, value, size) {
    const expr = node.expr || 'x';
    
    ctx.fillStyle = '#0c1821';
    ctx.fillRect(0, 0, size, size);
    
    // Show expression text
    ctx.fillStyle = '#10b981';
    ctx.font = '6px monospace';
    ctx.textAlign = 'left';
    const displayExpr = expr.length > 10 ? expr.substring(0, 10) + '...' : expr;
    ctx.fillText(displayExpr, 2, size - 2);
    
    // Show result if available
    if (typeof value === 'number') {
      ctx.fillStyle = '#fff';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(value.toFixed(2), size/2, size/2);
    }
  }

  renderSaturate(ctx, node, value, size) {
    // Show saturation effect as a gradient
    for (let x = 0; x < size; x++) {
      const testValue = (x / size) * 2 - 0.5;
      const saturated = Math.max(0, Math.min(1, testValue));
      const color = Math.floor(saturated * 255);
      ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
      ctx.fillRect(x, 0, 1, size);
    }
  }

  renderCircle(ctx, node, value, size) {
    // Use the computed circle data from PreviewComputer
    if (value && typeof value === 'object' && value.type === 'circle') {
      const { radius = 0.25, epsilon = 0.02 } = value;
      
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);
      
      // Render circle field
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const u = x / size;
          const v = y / size;
          const dist = Math.sqrt((u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5));
          const safeEpsilon = Math.max(epsilon, 0.0001);
          const field = 1.0 - this.smoothstep(radius - safeEpsilon, radius + safeEpsilon, dist);
          
          if (field > 0.01) {
            const intensity = Math.max(0, Math.min(1, field));
            const color = Math.floor(intensity * 255);
            ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    } else {
      this.renderGeneric(ctx, node, value, size);
    }
  }

  renderOutput(ctx, node, value, size) {
    if (Array.isArray(value)) {
      this.renderVec3(ctx, node, value, size);
    } else if (typeof value === 'number') {
      this.renderFloat(ctx, node, value, size);
    } else {
      this.renderGeneric(ctx, node, value, size);
    }
    
    // Add output border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, size - 4, size - 4);
  }

  renderGeneric(ctx, node, value, size) {
    const hash = this.hashString(node.kind);
    const hue = hash % 360;
    
    ctx.fillStyle = `hsl(${hue}, 60%, 25%)`;
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = `hsl(${hue}, 80%, 70%)`;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const label = node.kind.substring(0, 4);
    ctx.fillText(label, size/2, size/2);
  }

  // Vector operations (simplified from PreviewComputer pattern)
  renderDot(ctx, node, value, size) {
    const normalizedValue = typeof value === 'number' ? (value + 1) / 2 : 0.5;
    const hue = normalizedValue * 240;
    
    ctx.fillStyle = `hsl(${hue}, 70%, 40%)`;
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DOT', size/2, size/2 - 8);
    if (typeof value === 'number') {
      ctx.fillText(value.toFixed(2), size/2, size/2 + 8);
    }
  }

  renderCross(ctx, node, value, size) {
    ctx.fillStyle = `hsl(280, 70%, 30%)`;
    ctx.fillRect(0, 0, size, size);
    
    // Cross symbol
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    const crossSize = 6;
    const centerX = size / 2;
    const centerY = size / 2;
    ctx.beginPath();
    ctx.moveTo(centerX - crossSize, centerY - crossSize);
    ctx.lineTo(centerX + crossSize, centerY + crossSize);
    ctx.moveTo(centerX + crossSize, centerY - crossSize);
    ctx.lineTo(centerX - crossSize, centerY + crossSize);
    ctx.stroke();
  }

  renderNormalize(ctx, node, value, size) {
    ctx.fillStyle = '#1a2332';
    ctx.fillRect(0, 0, size, size);
    
    // Normalize arrow
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.4;
    
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.stroke();
    
    // Unit circle
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  renderLength(ctx, node, value, size) {
    const length = typeof value === 'number' ? value : 0;
    const normalizedLength = Math.min(1, length / 2);
    const hue = normalizedLength * 120;
    
    ctx.fillStyle = `hsl(${hue}, 70%, 30%)`;
    ctx.fillRect(0, 0, size, size);
    
    // Length bar
    const barWidth = size * 0.8;
    const barHeight = 6;
    const barY = size - 12;
    
    ctx.fillStyle = '#333';
    ctx.fillRect((size - barWidth) / 2, barY, barWidth, barHeight);
    
    ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
    ctx.fillRect((size - barWidth) / 2, barY, barWidth * normalizedLength, barHeight);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(length.toFixed(2), size/2, barY - 2);
  }

  renderDistance(ctx, node, value, size) {
    this.renderLength(ctx, node, value, size); // Similar visualization
  }

  renderReflect(ctx, node, value, size) {
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, size, size);
    
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Reflection surface
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - size * 0.3, centerY + size * 0.1);
    ctx.lineTo(centerX + size * 0.3, centerY - size * 0.1);
    ctx.stroke();
    
    // Incident ray
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - size * 0.2, centerY - size * 0.3);
    ctx.lineTo(centerX, centerY);
    ctx.stroke();
    
    // Reflected ray
    ctx.strokeStyle = '#44ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + size * 0.2, centerY - size * 0.3);
    ctx.stroke();
  }

  renderRefract(ctx, node, value, size) {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, size, size);
    
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Interface
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(size, centerY);
    ctx.stroke();
    
    // Incident ray
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - size * 0.2, centerY - size * 0.3);
    ctx.lineTo(centerX, centerY);
    ctx.stroke();
    
    // Refracted ray
    ctx.strokeStyle = '#44ff44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + size * 0.1, centerY + size * 0.3);
    ctx.stroke();
  }

  // Helper methods
  toVec2(value) {
    if (Array.isArray(value) && value.length >= 2) return [value[0], value[1]];
    if (typeof value === 'number') return [value, value];
    return [0, 0];
  }

  toVec3(value) {
    if (Array.isArray(value) && value.length >= 3) return [value[0], value[1], value[2]];
    if (Array.isArray(value) && value.length === 2) return [value[0], value[1], 0];
    if (typeof value === 'number') return [value, value, value];
    return [0, 0, 0];
  }

  smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(0.0001, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
  }
}