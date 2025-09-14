// src/core/PreviewComputer.js
export class PreviewComputer {
  computePreviews(graph) {
    const byId = new Map(graph.nodes.map(n => [n.id, n]));
    const ordered = this._topologicalSort(graph.nodes, byId);
    const values = new Map();
    const now = performance.now() / 1000;
    const UV_CENTER = [0.5, 0.5];

    // Evaluate each node
    for (const node of ordered) {
      let result = null;

      switch (node.kind) {
        case 'UV':
          result = UV_CENTER;
          break;

        case 'Time':
          result = now;
          break;

        case 'ConstFloat':
          result = typeof node.value === 'number' ? node.value : 0;
          break;

        case 'Expr': {
          const a = node.inputs?.[0] ? this._toF32(values.get(node.inputs[0])) : 0;
          const b = node.inputs?.[1] ? this._toF32(values.get(node.inputs[1])) : 0;
          const expr = (node.expr || 'a').toString();
          
          try {
            const scope = { a, b, u_time: now, sin: Math.sin, cos: Math.cos, PI: Math.PI };
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
          const dist = this._distance(UV_CENTER, [0.5, 0.5]);
          result = 1 - this._smoothstep(radius - epsilon, radius + epsilon, dist);
          break;
        }

        case 'Multiply': {
          const a = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
          const b = node.inputs?.[1] ? values.get(node.inputs[1]) : [0, 0, 0];
          result = this._mulVec(a, b);
          break;
        }

        case 'Add': {
          const a = node.inputs?.[0] ? values.get(node.inputs[0]) : [0, 0, 0];
          const b = node.inputs?.[1] ? values.get(node.inputs[1]) : [0, 0, 0];
          result = this._addVec(a, b);
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

    // Generate thumbnails
    this._generateThumbnails(graph.nodes);
  }

  _topologicalSort(nodes, byId) {
    const visited = new Set();
    const result = [];

    const visit = (nodeId) => {
      if (!nodeId || visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = byId.get(nodeId);
      if (!node) return;
      
      // Visit dependencies first
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

  _generateThumbnails(nodes) {
    const canvas = document.getElementById('ui-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    for (const node of nodes) {
      const value = node.__preview;
      const isVector = Array.isArray(value) && value.length === 3;
      const size = 16;
      
      const imageData = ctx.createImageData(size, size);
      
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let r, g, b;
          
          if (isVector) {
            [r, g, b] = value.map(c => Math.max(0, Math.min(1, c)) * 255 | 0);
          } else {
            const gray = Math.max(0, Math.min(1, typeof value === 'number' ? value : 0)) * 255 | 0;
            r = g = b = gray;
          }
          
          const idx = (y * size + x) * 4;
          imageData.data[idx + 0] = r;
          imageData.data[idx + 1] = g;
          imageData.data[idx + 2] = b;
          imageData.data[idx + 3] = 255;
        }
      }
      
      node.__thumb = imageData;
    }
  }

  // Helper functions
  _toVec3(v) {
    if (Array.isArray(v) && v.length === 3) return v;
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

  _clamp01(v) {
    const x = this._toVec3(v);
    return [
      Math.min(1, Math.max(0, x[0])),
      Math.min(1, Math.max(0, x[1])),
      Math.min(1, Math.max(0, x[2]))
    ];
  }

  _distance(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.hypot(dx, dy);
  }

  _smoothstep(edge0, edge1, x) {
    const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-4, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
}