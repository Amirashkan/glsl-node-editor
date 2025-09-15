// src/core/PreviewComputer.js
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

    // Evaluate each node
    for (const node of ordered) {
      let result = null;

      switch (node.kind) {
        case 'UV':
          result = [0.5, 0.5]; // Center UV
          break;

        case 'Time':
          result = this.animationTime;
          break;

        case 'ConstFloat':
          result = typeof node.value === 'number' ? node.value : 0;
          break;

        case 'ConstVec2':
          result = [node.x ?? 0, node.y ?? 0];
          break;

        case 'ConstVec3':
          result = [node.x ?? 0, node.y ?? 0, node.z ?? 0];
          break;

        case 'Expr': {
          const a = node.inputs?.[0] ? this._toF32(values.get(node.inputs[0])) : 0;
          const b = node.inputs?.[1] ? this._toF32(values.get(node.inputs[1])) : 0;
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
            result = Number(func(...Object.values(scope)));
            if (!Number.isFinite(result)) result = 0;
          } catch {
            result = 0;
          }
          break;
        }

        case 'CircleField': {
          const radius = node.inputs?.[0] ? this._toF32(values.get(node.inputs[0])) : 
                        (node.props?.radius ?? 0.25);
          const epsilon = Math.max(1e-4, node.inputs?.[1] ? this._toF32(values.get(node.inputs[1])) : 
                                  (node.props?.epsilon ?? 0.02));
          // For preview, we'll store the parameters for rendering
          result = { type: 'circle', radius, epsilon };
          break;
        }

        case 'Sin': {
          const input = node.inputs?.[0] ? this._toF32(values.get(node.inputs[0])) : 0;
          result = Math.sin(input);
          break;
        }

        case 'Cos': {
          const input = node.inputs?.[0] ? this._toF32(values.get(node.inputs[0])) : 0;
          result = Math.cos(input);
          break;
        }

        case 'Floor': {
          const input = node.inputs?.[0] ? this._toF32(values.get(node.inputs[0])) : 0;
          result = Math.floor(input);
          break;
        }

        case 'Fract': {
          const input = node.inputs?.[0] ? this._toF32(values.get(node.inputs[0])) : 0;
          result = input - Math.floor(input);
          break;
        }

        case 'Abs': {
          const input = node.inputs?.[0] ? this._toF32(values.get(node.inputs[0])) : 0;
          result = Math.abs(input);
          break;
        }

        case 'Multiply': {
          const a = node.inputs?.[0] ? values.get(node.inputs[0]) : [1, 1, 1];
          const b = node.inputs?.[1] ? values.get(node.inputs[1]) : [1, 1, 1];
          result = this._mulVec(a, b);
          break;
        }

        case 'Add': {
          const a = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
          const b = node.inputs?.[1] ? values.get(node.inputs[1]) : [0, 0, 0];
          result = this._addVec(a, b);
          break;
        }

        case 'Mix': {
          const a = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
          const b = node.inputs?.[1] ? values.get(node.inputs[1]) : [1, 1, 1];
          const t = node.inputs?.[2] ? this._toF32(values.get(node.inputs[2])) : 0.5;
          result = this._mixVec(a, b, t);
          break;
        }

        case 'Step': {
          const edge = node.inputs?.[0] ? this._toF32(values.get(node.inputs[0])) : 0.5;
          const x = node.inputs?.[1] ? this._toF32(values.get(node.inputs[1])) : 0;
          result = x < edge ? 0 : 1;
          break;
        }

        case 'Split3': {
          const v = node.inputs?.[0] ? this._toVec3(values.get(node.inputs[0])) : [0, 0, 0];
          result = { type: 'split', values: v };
          break;
        }

        case 'Combine3': {
          const x = node.inputs?.[0] ? this._toF32(values.get(node.inputs[0])) : 0;
          const y = node.inputs?.[1] ? this._toF32(values.get(node.inputs[1])) : 0;
          const z = node.inputs?.[2] ? this._toF32(values.get(node.inputs[2])) : 0;
          result = [x, y, z];
          break;
        }

        case 'Saturate': {
          const v = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
          result = this._clamp01(v);
          break;
        }

        case 'OutputFinal': {
          const c = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
          result = this._toVec3(c);
          break;
        }

        default:
          result = 0;
      }

      values.set(node.id, result);
      node.__preview = result;
    }

    // Generate enhanced thumbnails
    this._generateEnhancedThumbnails(graph.nodes, values);
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

    switch (node.kind) {
      case 'UV':
        this._renderUVThumbnail(ctx, size);
        break;
      
      case 'Time':
        this._renderTimeThumbnail(ctx, size, node.__preview);
        break;
      
      case 'ConstFloat':
        this._renderFloatThumbnail(ctx, size, node.__preview);
        break;
      
      case 'ConstVec2':
        this._renderVec2Thumbnail(ctx, size, node.__preview);
        break;
      
      case 'ConstVec3':
        this._renderColorThumbnail(ctx, size, node.__preview);
        break;
      
      case 'CircleField':
        this._renderCircleThumbnail(ctx, size, node.__preview);
        break;
      
      case 'Sin':
      case 'Cos':
        this._renderWaveThumbnail(ctx, size, node.kind);
        break;
      
      case 'Expr':
        this._renderExpressionThumbnail(ctx, size, node.expr || 'a');
        break;
      
      case 'Multiply':
        this._renderMathThumbnail(ctx, size, '×');
        break;
      
      case 'Add':
        this._renderMathThumbnail(ctx, size, '+');
        break;
      
      case 'Mix':
        this._renderMixThumbnail(ctx, size);
        break;
      
      case 'Split3':
        this._renderSplitThumbnail(ctx, size, node.__preview);
        break;
      
      case 'Combine3':
        this._renderCombineThumbnail(ctx, size);
        break;
      
      case 'Saturate':
        this._renderSaturateThumbnail(ctx, size);
        break;
      
      case 'OutputFinal':
        this._renderOutputThumbnail(ctx, size, node.__preview);
        break;
      
      default:
        this._renderDefaultThumbnail(ctx, size, node.__preview);
    }

    return canvas;
  }

  _renderUVThumbnail(ctx, size) {
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#ff0080');
    gradient.addColorStop(1, '#0080ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Add grid pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    const step = size / 4;
    for (let i = 0; i <= 4; i++) {
      const pos = i * step;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }
  }

  _renderTimeThumbnail(ctx, size, time) {
    // Animated circle
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.3;
    
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, size, size);
    
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

  _renderFloatThumbnail(ctx, size, value) {
    const normalizedValue = Math.max(0, Math.min(1, Math.abs(value)));
    const hue = value >= 0 ? 120 : 0; // Green for positive, red for negative
    
    ctx.fillStyle = `hsl(${hue}, 70%, ${30 + normalizedValue * 40}%)`;
    ctx.fillRect(0, 0, size, size);
    
    // Value bar
    const barHeight = size * normalizedValue;
    ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
    ctx.fillRect(size * 0.1, size - barHeight, size * 0.8, barHeight);
    
    // Text
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(value.toFixed(2), size / 2, size / 2 + 3);
  }

  _renderVec2Thumbnail(ctx, size, vec) {
    const [x, y] = this._toVec2(vec);
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, `hsl(${x * 180}, 60%, 30%)`);
    gradient.addColorStop(1, `hsl(${y * 180 + 180}, 60%, 30%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Vector arrow
    const centerX = size / 2;
    const centerY = size / 2;
    const scale = size * 0.3;
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

  _renderColorThumbnail(ctx, size, color) {
    const [r, g, b] = this._toVec3(color);
    const clampedR = Math.max(0, Math.min(1, r)) * 255;
    const clampedG = Math.max(0, Math.min(1, g)) * 255;
    const clampedB = Math.max(0, Math.min(1, b)) * 255;
    
    ctx.fillStyle = `rgb(${clampedR}, ${clampedG}, ${clampedB})`;
    ctx.fillRect(0, 0, size, size);
    
    // Add a subtle pattern to make it look less flat
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < size; i += 4) {
      for (let j = 0; j < size; j += 4) {
        if ((i + j) % 8 === 0) {
          ctx.fillRect(i, j, 2, 2);
        }
      }
    }
  }

  _renderCircleThumbnail(ctx, size, circleData) {
    if (!circleData || typeof circleData !== 'object') {
      this._renderDefaultThumbnail(ctx, size, circleData);
      return;
    }
    
    const { radius = 0.25, epsilon = 0.02 } = circleData;
    
    // Render the circle field as a gradient
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = size / 2;
    
    const imageData = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const dist = Math.hypot(u - 0.5, v - 0.5);
        const field = 1 - this._smoothstep(radius - epsilon, radius + epsilon, dist);
        
        const intensity = Math.max(0, Math.min(1, field)) * 255;
        const idx = (y * size + x) * 4;
        imageData.data[idx + 0] = intensity;     // R
        imageData.data[idx + 1] = intensity * 0.5; // G
        imageData.data[idx + 2] = intensity;     // B
        imageData.data[idx + 3] = 255;           // A
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  _renderWaveThumbnail(ctx, size, waveType) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, size, size);
    
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const amplitude = size * 0.3;
    const frequency = 2;
    const centerY = size / 2;
    
    for (let x = 0; x < size; x++) {
      const t = (x / size) * frequency * Math.PI * 2;
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

  _renderExpressionThumbnail(ctx, size, expr) {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, size, size);
    
    // Simple expression visualization
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    
    // Truncate long expressions
    const shortExpr = expr.length > 6 ? expr.substring(0, 6) + '...' : expr;
    ctx.fillText(shortExpr, size / 2, size / 2 + 2);
    
    // Add some visual elements based on expression content
    if (expr.includes('sin') || expr.includes('cos')) {
      this._renderWaveThumbnail(ctx, size, 'Sin');
    } else if (expr.includes('*')) {
      this._renderMathThumbnail(ctx, size, '×');
    }
  }

  _renderMathThumbnail(ctx, size, symbol) {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(symbol, size / 2, size / 2 + 5);
  }

  _renderMixThumbnail(ctx, size) {
    // Show a gradient from A to B
    const gradient = ctx.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(1, '#0000ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Add mix symbol
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MIX', size / 2, size / 2 + 3);
  }

  _renderSplitThumbnail(ctx, size, splitData) {
    if (splitData && splitData.type === 'split') {
      const [r, g, b] = splitData.values;
      const third = size / 3;
      
      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r * 255))}, 0, 0)`;
      ctx.fillRect(0, 0, third, size);
      
      ctx.fillStyle = `rgb(0, ${Math.max(0, Math.min(255, g * 255))}, 0)`;
      ctx.fillRect(third, 0, third, size);
      
      ctx.fillStyle = `rgb(0, 0, ${Math.max(0, Math.min(255, b * 255))})`;
      ctx.fillRect(third * 2, 0, third, size);
    } else {
      this._renderDefaultThumbnail(ctx, size, splitData);
    }
  }

  _renderCombineThumbnail(ctx, size) {
    // Show three inputs combining into one
    const third = size / 3;
    
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, third, size);
    
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(third, 0, third, size);
    
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(third * 2, 0, third, size);
    
    // Arrow pointing to combined result
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('→', size / 2, size / 2 + 3);
  }

  _renderSaturateThumbnail(ctx, size) {
    // Show a gradient that gets clamped
    const gradient = ctx.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0, '#000');
    gradient.addColorStop(0.5, '#888');
    gradient.addColorStop(1, '#fff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SAT', size / 2, size / 2 + 2);
  }

  _renderOutputThumbnail(ctx, size, color) {
    this._renderColorThumbnail(ctx, size, color);
    
    // Add output indicator
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, size - 4, size - 4);
  }

  _renderDefaultThumbnail(ctx, size, value) {
    const isVector = Array.isArray(value) && value.length >= 3;
    
    if (isVector) {
      this._renderColorThumbnail(ctx, size, value);
    } else {
      this._renderFloatThumbnail(ctx, size, typeof value === 'number' ? value : 0);
    }
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

  _toVec2(v) {
    if (Array.isArray(v) && v.length >= 2) return [v[0], v[1]];
    if (typeof v === 'number') return [v, v];
    return [0, 0];
  }

  _toVec3(v) {
    if (Array.isArray(v) && v.length >= 3) return [v[0], v[1], v[2]];
    if (Array.isArray(v) && v.length === 2) return [v[0], v[1], 0];
    if (typeof v === 'number') return [v, v, v];
    return [0, 0, 0];
  }

  _toF32(v) {
    if (typeof v === 'number') return v;
    if (Array.isArray(v)) return v.reduce((a, b) => a + b, 0) / v.length;
    return 0;
  }

  _addVec(a, b) {
    a = this._toVec3(a); 
    b = this._toVec3(b);
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  _mulVec(a, b) {
    a = this._toVec3(a); 
    b = this._toVec3(b);
    return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
  }

  _mixVec(a, b, t) {
    a = this._toVec3(a);
    b = this._toVec3(b);
    const invT = 1 - t;
    return [
      a[0] * invT + b[0] * t,
      a[1] * invT + b[1] * t,
      a[2] * invT + b[2] * t
    ];
  }

  _clamp01(v) {
    const x = this._toVec3(v);
    return [
      Math.min(1, Math.max(0, x[0])),
      Math.min(1, Math.max(0, x[1])),
      Math.min(1, Math.max(0, x[2]))
    ];
  }

  _smoothstep(edge0, edge1, x) {
    const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-4, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
}