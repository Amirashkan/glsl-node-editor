// src/core/PreviewComputer.js - Refactored with maintainable structure

// ============================================================================
// UTILITIES
// ============================================================================

class TypeConverter {
  static toVec2(v) {
    if (Array.isArray(v) && v.length >= 2) return [v[0], v[1]];
    if (typeof v === 'number') return [v, v];
    return [0, 0];
  }

  static toVec3(v) {
    if (Array.isArray(v) && v.length >= 3) return [v[0], v[1], v[2]];
    if (Array.isArray(v) && v.length === 2) return [v[0], v[1], 0];
    if (typeof v === 'number') return [v, v, v];
    return [0, 0, 0];
  }

  static toF32(v) {
    if (typeof v === 'number') return v;
    if (Array.isArray(v)) return v.reduce((a, b) => a + b, 0) / v.length;
    return 0;
  }

  static addVec(a, b) {
    a = this.toVec3(a); 
    b = this.toVec3(b);
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  static mulVec(a, b) {
    a = this.toVec3(a); 
    b = this.toVec3(b);
    return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
  }

  static mixVec(a, b, t) {
    a = this.toVec3(a);
    b = this.toVec3(b);
    const invT = 1 - t;
    return [
      a[0] * invT + b[0] * t,
      a[1] * invT + b[1] * t,
      a[2] * invT + b[2] * t
    ];
  }

  static clamp01(v) {
    const x = this.toVec3(v);
    return [
      Math.min(1, Math.max(0, x[0])),
      Math.min(1, Math.max(0, x[1])),
      Math.min(1, Math.max(0, x[2]))
    ];
  }

  static smoothstep(edge0, edge1, x) {
    const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-4, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
}

// ============================================================================
// NODE VALUE PROCESSORS
// ============================================================================

class NodeValueProcessors {
  constructor(animationTime) {
    this.animationTime = animationTime;
  }

  // Input nodes
  processUV() {
    return [0.5, 0.5]; // Center UV
  }

  processTime() {
    return this.animationTime;
  }

  // Constants
  processConstFloat(node) {
    const value = node.props?.value ?? node.value ?? 0;
    return typeof value === 'number' ? value : 0;
  }

  processConstVec2(node) {
    // Read from props first, fallback to direct properties
    const x = node.props?.x ?? node.x ?? 0;
    const y = node.props?.y ?? node.y ?? 0;
    return [x, y];
  }

  processConstVec3(node) {
    // Read from props first, fallback to direct properties
    const x = node.props?.x ?? node.x ?? 0;
    const y = node.props?.y ?? node.y ?? 0;
    const z = node.props?.z ?? node.z ?? 0;
    return [x, y, z];
  }

  // Expression evaluation
  processExpr(node, values) {
    const a = node.inputs?.[0] ? TypeConverter.toF32(values.get(node.inputs[0])) : 0;
    const b = node.inputs?.[1] ? TypeConverter.toF32(values.get(node.inputs[1])) : 0;
    const expr = (node.expr || 'a').toString();
    
    try {
      const scope = { 
        a, b, 
        u_time: this.animationTime, 
        sin: Math.sin, cos: Math.cos, tan: Math.tan,
        floor: Math.floor, ceil: Math.ceil, abs: Math.abs,
        PI: Math.PI, 
        sqrt: Math.sqrt, pow: Math.pow,
        min: Math.min, max: Math.max
      };
      const func = new Function(...Object.keys(scope), `return (${expr});`);
      const result = Number(func(...Object.values(scope)));
      return Number.isFinite(result) ? result : 0;
    } catch {
      return 0;
    }
  }

  // Field nodes
  processCircleField(node, values) {
    const radius = node.inputs?.[0] ? TypeConverter.toF32(values.get(node.inputs[0])) : 
                  (node.props?.radius ?? 0.25);
    const epsilon = Math.max(1e-4, node.inputs?.[1] ? TypeConverter.toF32(values.get(node.inputs[1])) : 
                            (node.props?.epsilon ?? 0.02));
    return { type: 'circle', radius, epsilon };
  }

  // Math functions (scalar)
  processMathScalar(node, values, func) {
    const input = node.inputs?.[0] ? TypeConverter.toF32(values.get(node.inputs[0])) : 0;
    
    switch (func) {
      case 'Sin': return Math.sin(input);
      case 'Cos': return Math.cos(input);
      case 'Tan': return Math.tan(input);
      case 'Floor': return Math.floor(input);
      case 'Fract': return input - Math.floor(input);
      case 'Abs': return Math.abs(input);
      case 'Sqrt': return Math.sqrt(Math.max(0, input));
      case 'Sign': return Math.sign(input);
      default: return input;
    }
  }

  // Math operations (vector)
  processMathVec3(node, values, op) {
    const a = node.inputs?.[0] ? values.get(node.inputs[0]) : [1, 1, 1];
    const b = node.inputs?.[1] ? values.get(node.inputs[1]) : [1, 1, 1];

    switch (op) {
      case 'Multiply': return TypeConverter.mulVec(a, b);
      case 'Add': return TypeConverter.addVec(a, b);
      case 'Subtract': {
        const va = TypeConverter.toVec3(a);
        const vb = TypeConverter.toVec3(b);
        return [va[0] - vb[0], va[1] - vb[1], va[2] - vb[2]];
      }
      case 'Divide': {
        const va = TypeConverter.toVec3(a);
        const vb = TypeConverter.toVec3(b);
        return [
          va[0] / Math.max(vb[0], 1e-4),
          va[1] / Math.max(vb[1], 1e-4),
          va[2] / Math.max(vb[2], 1e-4)
        ];
      }
      default: return TypeConverter.addVec(a, b);
    }
  }

  // Dual input math
  processMathDual(node, values, func) {
    const a = node.inputs?.[0] ? TypeConverter.toF32(values.get(node.inputs[0])) : 0;
    const b = node.inputs?.[1] ? TypeConverter.toF32(values.get(node.inputs[1])) : 0;

    switch (func) {
      case 'Pow': return Math.pow(a, b);
      case 'Min': return Math.min(a, b);
      case 'Max': return Math.max(a, b);
      case 'Step': return a < b ? 0 : 1;
      case 'Mod': return a - b * Math.floor(a / Math.max(b, 1e-4));
      default: return a;
    }
  }

  // Triple input functions
  processMathTriple(node, values, func) {
    if (func === 'Mix') {
      const a = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
      const b = node.inputs?.[1] ? values.get(node.inputs[1]) : [1, 1, 1];
      const t = node.inputs?.[2] ? TypeConverter.toF32(values.get(node.inputs[2])) : 0.5;
      return TypeConverter.mixVec(a, b, t);
    }

    if (func === 'Clamp') {
      const value = node.inputs?.[0] ? TypeConverter.toF32(values.get(node.inputs[0])) : 0;
      const minVal = node.inputs?.[1] ? TypeConverter.toF32(values.get(node.inputs[1])) : 0;
      const maxVal = node.inputs?.[2] ? TypeConverter.toF32(values.get(node.inputs[2])) : 1;
      return Math.min(maxVal, Math.max(minVal, value));
    }

    if (func === 'Smoothstep') {
      const edge0 = node.inputs?.[0] ? TypeConverter.toF32(values.get(node.inputs[0])) : 0;
      const edge1 = node.inputs?.[1] ? TypeConverter.toF32(values.get(node.inputs[1])) : 1;
      const x = node.inputs?.[2] ? TypeConverter.toF32(values.get(node.inputs[2])) : 0.5;
      return TypeConverter.smoothstep(edge0, edge1, x);
    }

    return 0;
  }

  // Vector operations
  processVectorOp(node, values, op) {
    if (op === 'Dot') {
      const a = TypeConverter.toVec3(node.inputs?.[0] ? values.get(node.inputs[0]) : [1, 0, 0]);
      const b = TypeConverter.toVec3(node.inputs?.[1] ? values.get(node.inputs[1]) : [0, 1, 0]);
      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    if (op === 'Cross') {
      const a = TypeConverter.toVec3(node.inputs?.[0] ? values.get(node.inputs[0]) : [1, 0, 0]);
      const b = TypeConverter.toVec3(node.inputs?.[1] ? values.get(node.inputs[1]) : [0, 1, 0]);
      return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
    }

    if (op === 'Normalize') {
      const vec = TypeConverter.toVec3(node.inputs?.[0] ? values.get(node.inputs[0]) : [1, 0, 0]);
      const length = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
      return length > 1e-6 ? [vec[0] / length, vec[1] / length, vec[2] / length] : [0, 0, 0];
    }

    if (op === 'Length') {
      const vec = TypeConverter.toVec3(node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0]);
      return Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
    }

    if (op === 'Distance') {
      const a = TypeConverter.toVec3(node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0]);
      const b = TypeConverter.toVec3(node.inputs?.[1] ? values.get(node.inputs[1]) : [0, 0, 0]);
      const diff = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      return Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2]);
    }

    if (op === 'Reflect') {
      const incident = TypeConverter.toVec3(node.inputs?.[0] ? values.get(node.inputs[0]) : [1, -1, 0]);
      const normal = TypeConverter.toVec3(node.inputs?.[1] ? values.get(node.inputs[1]) : [0, 1, 0]);
      
      const nLength = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
      const n = nLength > 1e-6 ? [normal[0] / nLength, normal[1] / nLength, normal[2] / nLength] : [0, 1, 0];
      
      const dotNI = n[0] * incident[0] + n[1] * incident[1] + n[2] * incident[2];
      return [
        incident[0] - 2 * dotNI * n[0],
        incident[1] - 2 * dotNI * n[1],
        incident[2] - 2 * dotNI * n[2]
      ];
    }

    if (op === 'Refract') {
      const incident = TypeConverter.toVec3(node.inputs?.[0] ? values.get(node.inputs[0]) : [1, -1, 0]);
      const normal = TypeConverter.toVec3(node.inputs?.[1] ? values.get(node.inputs[1]) : [0, 1, 0]);
      const eta = node.inputs?.[2] ? TypeConverter.toF32(values.get(node.inputs[2])) : 1.5;
      
      const nLength = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
      const n = nLength > 1e-6 ? [normal[0] / nLength, normal[1] / nLength, normal[2] / nLength] : [0, 1, 0];
      
      const iLength = Math.sqrt(incident[0] * incident[0] + incident[1] * incident[1] + incident[2] * incident[2]);
      const i = iLength > 1e-6 ? [incident[0] / iLength, incident[1] / iLength, incident[2] / iLength] : [0, 0, 0];
      
      const dotNI = n[0] * i[0] + n[1] * i[1] + n[2] * i[2];
      const k = 1.0 - eta * eta * (1.0 - dotNI * dotNI);
      
      if (k < 0.0) return [0, 0, 0]; // Total internal reflection
      
      const sqrtK = Math.sqrt(k);
      return [
        eta * i[0] - (eta * dotNI + sqrtK) * n[0],
        eta * i[1] - (eta * dotNI + sqrtK) * n[1],
        eta * i[2] - (eta * dotNI + sqrtK) * n[2]
      ];
    }

    return [0, 0, 0];
  }

  // Utility functions
  processSplit3(node, values) {
    const v = TypeConverter.toVec3(node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0]);
    return { type: 'split', values: v };
  }

  processCombine3(node, values) {
    const x = node.inputs?.[0] ? TypeConverter.toF32(values.get(node.inputs[0])) : 0;
    const y = node.inputs?.[1] ? TypeConverter.toF32(values.get(node.inputs[1])) : 0;
    const z = node.inputs?.[2] ? TypeConverter.toF32(values.get(node.inputs[2])) : 0;
    return [x, y, z];
  }

  processSaturate(node, values) {
    const v = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
    return TypeConverter.clamp01(v);
  }

  // Output
  processOutputFinal(node, values) {
    const c = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
    return TypeConverter.toVec3(c);
  }
}

// ============================================================================
// THUMBNAIL RENDERERS
// ============================================================================

class ThumbnailRenderers {
  constructor(size) {
    this.size = size;
  }

  renderUV(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, this.size, this.size);
    gradient.addColorStop(0, '#ff0080');
    gradient.addColorStop(1, '#0080ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.size, this.size);
    
    // Add grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    const step = this.size / 4;
    for (let i = 0; i <= 4; i++) {
      const pos = i * step;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, this.size);
      ctx.moveTo(0, pos);
      ctx.lineTo(this.size, pos);
      ctx.stroke();
    }
  }

  renderTime(ctx, time) {
    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const radius = this.size * 0.3;
    
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, this.size, this.size);
    
    // Clock face
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Clock hand
    const angle = (time % 2) * Math.PI;
    const handLength = radius * 0.8;
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.sin(angle) * handLength,
      centerY - Math.cos(angle) * handLength
    );
    ctx.stroke();
  }

  renderFloat(ctx, value) {
    const normalizedValue = Math.max(0, Math.min(1, Math.abs(value)));
    const hue = value >= 0 ? 120 : 0; // Green for positive, red for negative
    
    ctx.fillStyle = `hsl(${hue}, 70%, ${30 + normalizedValue * 40}%)`;
    ctx.fillRect(0, 0, this.size, this.size);
    
    // Value bar
    const barHeight = this.size * normalizedValue;
    ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
    ctx.fillRect(this.size * 0.1, this.size - barHeight, this.size * 0.8, barHeight);
    
    // Text
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(value.toFixed(2), this.size / 2, this.size / 2 + 3);
  }

  renderVec2(ctx, vec) {
    const [x, y] = TypeConverter.toVec2(vec);
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, this.size, this.size);
    gradient.addColorStop(0, `hsl(${x * 180}, 60%, 30%)`);
    gradient.addColorStop(1, `hsl(${y * 180 + 180}, 60%, 30%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.size, this.size);
    
    // Vector arrow
    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const scale = this.size * 0.3;
    const endX = centerX + x * scale;
    const endY = centerY - y * scale; // Flip Y for screen coordinates
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Arrow head
    const angle = Math.atan2(endY - centerY, endX - centerX);
    const headLength = 6;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle - 0.5),
      endY - headLength * Math.sin(angle - 0.5)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - headLength * Math.cos(angle + 0.5),
      endY - headLength * Math.sin(angle + 0.5)
    );
    ctx.stroke();
  }

  renderColor(ctx, color) {
    const [r, g, b] = TypeConverter.toVec3(color);
    const clampedR = Math.max(0, Math.min(1, r)) * 255;
    const clampedG = Math.max(0, Math.min(1, g)) * 255;
    const clampedB = Math.max(0, Math.min(1, b)) * 255;
    
    ctx.fillStyle = `rgb(${clampedR}, ${clampedG}, ${clampedB})`;
    ctx.fillRect(0, 0, this.size, this.size);
    
    // Add a subtle pattern to make it look less flat
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < this.size; i += 4) {
      for (let j = 0; j < this.size; j += 4) {
        if ((i + j) % 8 === 0) {
          ctx.fillRect(i, j, 2, 2);
        }
      }
    }
  }

  renderCircle(ctx, circleData) {
    if (!circleData || typeof circleData !== 'object') {
      this.renderDefault(ctx, circleData);
      return;
    }
    
    const { radius = 0.25, epsilon = 0.02 } = circleData;
    
    // Clear to black background first
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.size, this.size);
    
    const imageData = ctx.createImageData(this.size, this.size);
    
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        // Convert to UV coordinates (0 to 1) - exactly like the shader
        const u = x / this.size;
        const v = y / this.size;
        
        // Distance from center (0.5, 0.5) - exactly like shader
        const dist = Math.sqrt((u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5));
        
        // Ensure epsilon has minimum value like shader
        const safeEpsilon = Math.max(epsilon, 0.0001);
        
        // Exact shader formula: 1.0 - smoothstep(radius - epsilon, radius + epsilon, distance)
        const field = 1.0 - TypeConverter.smoothstep(radius - safeEpsilon, radius + safeEpsilon, dist);
        
        // Convert to 0-255 intensity (grayscale)
        const intensity = Math.max(0, Math.min(1, field)) * 255;
        const idx = (y * this.size + x) * 4;
        imageData.data[idx + 0] = intensity; // R
        imageData.data[idx + 1] = intensity; // G  
        imageData.data[idx + 2] = intensity; // B
        imageData.data[idx + 3] = 255;       // A
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  renderWave(ctx, waveType) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, this.size, this.size);
    
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const amplitude = this.size * 0.3;
    const frequency = 2;
    const centerY = this.size / 2;
    
    for (let x = 0; x < this.size; x++) {
      const t = (x / this.size) * frequency * Math.PI * 2;
      const y = waveType === 'Sin' ? 
        centerY - Math.sin(t) * amplitude :
        centerY - Math.cos(t) * amplitude;
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  renderMath(ctx, symbol) {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, this.size, this.size);
    
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(symbol, this.size / 2, this.size / 2 + 5);
  }

  renderMix(ctx) {
    // Show a gradient from A to B
    const gradient = ctx.createLinearGradient(0, 0, this.size, 0);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(1, '#0000ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.size, this.size);
    
    // Add mix symbol
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MIX', this.size / 2, this.size / 2 + 3);
  }

  renderSplit(ctx, splitData) {
    if (splitData && splitData.type === 'split') {
      const [r, g, b] = splitData.values;
      const third = this.size / 3;
      
      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r * 255))}, 0, 0)`;
      ctx.fillRect(0, 0, third, this.size);
      
      ctx.fillStyle = `rgb(0, ${Math.max(0, Math.min(255, g * 255))}, 0)`;
      ctx.fillRect(third, 0, third, this.size);
      
      ctx.fillStyle = `rgb(0, 0, ${Math.max(0, Math.min(255, b * 255))})`;
      ctx.fillRect(third * 2, 0, third, this.size);
    } else {
      this.renderDefault(ctx, splitData);
    }
  }

  renderCombine(ctx) {
    // Show three inputs combining into one
    const third = this.size / 3;
    
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, third, this.size);
    
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(third, 0, third, this.size);
    
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(third * 2, 0, third, this.size);
    
    // Arrow pointing to combined result
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('→', this.size / 2, this.size / 2 + 3);
  }

  renderSaturate(ctx) {
    // Show a gradient that gets clamped
    const gradient = ctx.createLinearGradient(0, 0, this.size, 0);
    gradient.addColorStop(0, '#000');
    gradient.addColorStop(0.5, '#888');
    gradient.addColorStop(1, '#fff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.size, this.size);
    
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SAT', this.size / 2, this.size / 2 + 2);
  }

  renderOutput(ctx, color) {
    this.renderColor(ctx, color);
    
    // Add output indicator
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, this.size - 4, this.size - 4);
  }

  renderExpression(ctx, expr) {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, this.size, this.size);
    
    // Simple expression visualization
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    
    // Truncate long expressions
    const shortExpr = expr.length > 6 ? expr.substring(0, 6) + '...' : expr;
    ctx.fillText(shortExpr, this.size / 2, this.size / 2 + 2);
    
    // Add some visual elements based on expression content
    if (expr.includes('sin') || expr.includes('cos')) {
      this.renderWave(ctx, 'Sin');
    } else if (expr.includes('*')) {
      this.renderMath(ctx, '×');
    }
  }

  renderDefault(ctx, value) {
    const isVector = Array.isArray(value) && value.length >= 3;
    
    if (isVector) {
      this.renderColor(ctx, value);
    } else {
      this.renderFloat(ctx, typeof value === 'number' ? value : 0);
    }
  }
}

// ============================================================================
// MAIN PREVIEW COMPUTER CLASS
// ============================================================================

export class PreviewComputer {
  constructor() {
    this.previewSize = 32; // Increased size for better detail
    this.animationTime = 0;
    this.lastFrameTime = 0;
  }

  computePreviews(graph) {
    this.animationTime = performance.now() / 1000;
    
    const byId = new Map(graph.nodes.map(n => [n.id, n]));
    const ordered = this._topologicalSort(graph.nodes, byId);
    const values = new Map();
    const processors = new NodeValueProcessors(this.animationTime);

    // Evaluate each node
    for (const node of ordered) {
      const result = this._processNode(node, values, processors);
      values.set(node.id, result);
      node.__preview = result;
    }

    // Generate enhanced thumbnails
    this._generateEnhancedThumbnails(graph.nodes, values);
  }

  _processNode(node, values, processors) {
    const kind = node.kind;

    // Input nodes
    if (kind === 'UV') return processors.processUV();
    if (kind === 'Time') return processors.processTime();

    // Constants
    if (kind === 'ConstFloat') return processors.processConstFloat(node);
    if (kind === 'ConstVec2') return processors.processConstVec2(node);
    if (kind === 'ConstVec3') return processors.processConstVec3(node);

    // Expression
    if (kind === 'Expr') return processors.processExpr(node, values);

    // Fields
    if (kind === 'CircleField') return processors.processCircleField(node, values);

    // Scalar math functions
    if (['Sin', 'Cos', 'Tan', 'Floor', 'Fract', 'Abs', 'Sqrt', 'Sign'].includes(kind)) {
      return processors.processMathScalar(node, values, kind);
    }

    // Vector math operations
    if (['Multiply', 'Add', 'Subtract', 'Divide'].includes(kind)) {
      return processors.processMathVec3(node, values, kind);
    }

    // Dual input math
    if (['Pow', 'Min', 'Max', 'Step', 'Mod'].includes(kind)) {
      return processors.processMathDual(node, values, kind);
    }

    // Triple input functions
    if (['Mix', 'Clamp', 'Smoothstep'].includes(kind)) {
      return processors.processMathTriple(node, values, kind);
    }

    // Vector operations
    if (['Dot', 'Cross', 'Normalize', 'Length', 'Distance', 'Reflect', 'Refract'].includes(kind)) {
      return processors.processVectorOp(node, values, kind);
    }

    // Utility nodes
    if (kind === 'Split3') return processors.processSplit3(node, values);
    if (kind === 'Combine3') return processors.processCombine3(node, values);
    if (kind === 'Saturate') return processors.processSaturate(node, values);

    // Output
    if (kind === 'OutputFinal') return processors.processOutputFinal(node, values);

    // Unknown node
    console.log(`PreviewComputer: Unknown node type: ${kind}`);
    return 0;
  }

  _generateEnhancedThumbnails(nodes, values) {
    for (const node of nodes) {
      node.__thumb = this._createNodeThumbnail(node, values);
    }
  }

  _createNodeThumbnail(node, values) {
    const size = this.previewSize;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Clear background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size, size);

    const renderers = new ThumbnailRenderers(size);
    this._renderNodeThumbnail(ctx, node, renderers);

    return canvas;
  }

  _renderNodeThumbnail(ctx, node, renderers) {
    const kind = node.kind;
    const preview = node.__preview;

    // Input nodes
    if (kind === 'UV') return renderers.renderUV(ctx);
    if (kind === 'Time') return renderers.renderTime(ctx, preview);

    // Constants
    if (kind === 'ConstFloat') return renderers.renderFloat(ctx, preview);
    if (kind === 'ConstVec2') return renderers.renderVec2(ctx, preview);
    if (kind === 'ConstVec3') return renderers.renderColor(ctx, preview);

    // Expression
    if (kind === 'Expr') return renderers.renderExpression(ctx, node.expr || 'a');

    // Fields
    if (kind === 'CircleField') return renderers.renderCircle(ctx, preview);

    // Wave functions
    if (['Sin', 'Cos'].includes(kind)) return renderers.renderWave(ctx, kind);

    // Math operations
    if (kind === 'Multiply') return renderers.renderMath(ctx, '×');
    if (kind === 'Add') return renderers.renderMath(ctx, '+');
    if (kind === 'Subtract') return renderers.renderMath(ctx, '−');
    if (kind === 'Divide') return renderers.renderMath(ctx, '÷');

    // Special functions
    if (kind === 'Mix') return renderers.renderMix(ctx);
    if (kind === 'Split3') return renderers.renderSplit(ctx, preview);
    if (kind === 'Combine3') return renderers.renderCombine(ctx);
    if (kind === 'Saturate') return renderers.renderSaturate(ctx);

    // Output
    if (kind === 'OutputFinal') return renderers.renderOutput(ctx, preview);

    // Default fallback
    return renderers.renderDefault(ctx, preview);
  }

  // Helper functions
  _topologicalSort(nodes, byId) {
    const visited = new Set();
    const result = [];

    const visit = (nodeId) => {
      if (!nodeId || visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = byId.get(nodeId);
      if (!node) return;
      
      for (const input of (node.inputs || [])) {
        if (input) visit(input);
      }
      
      result.push(node);
    };

    for (const node of nodes) {
      visit(node.id);
    }

    return result;
  }
}