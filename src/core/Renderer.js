// src/core/Renderer.js
import { NodeDefs } from '../data/NodeDefs.js';

export class Renderer {
  constructor(ctx, viewport) {
    this.ctx = ctx;
    this.viewport = viewport;
  }

  render(graph, renderState) {
    const ctx = this.ctx;
    
    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Save context and apply viewport transform
    ctx.save();
    ctx.translate(this.viewport.offsetX, this.viewport.offsetY);
    ctx.scale(this.viewport.scale, this.viewport.scale);

    // Render connections/wires
    this._renderConnections(graph.connections, graph.nodes);
    
    // Render drag wire if active
    if (renderState.dragWire) {
      this._renderDragWire(renderState.dragWire, graph.nodes);
    }

    // Render nodes
    this._renderNodes(graph.nodes, renderState.selection);

    // Render selection box if active
    if (renderState.boxSelect) {
      this._renderSelectionBox(renderState.boxSelect);
    }

    ctx.restore();
  }

  _renderConnections(connections, nodes) {
    const ctx = this.ctx;
    ctx.lineWidth = 2;

    for (const c of connections) {
      const fromNode = nodes.find(n => n.id === c.from.nodeId);
      const toNode = nodes.find(n => n.id === c.to.nodeId);
      if (!fromNode || !toNode) continue;

      const fromPos = this._getOutputPinPosition(fromNode, c.from.pin);
      const toPos = this._getInputPinPosition(toNode, c.to.pin);
      if (!fromPos || !toPos) continue;

      // Get wire color based on output type
      const srcType = (NodeDefs[fromNode.kind]?.pinsOut?.[c.from.pin]?.type) || 'default';
      const color = this._getWireColor(srcType);
      
      ctx.strokeStyle = color;
      this._drawBezierCurve(fromPos.x, fromPos.y, toPos.x, toPos.y);
    }
  }

  _renderDragWire(dragWire, nodes) {
    const ctx = this.ctx;
    const fromNode = nodes.find(n => n.id === dragWire.from.nodeId);
    if (!fromNode) return;

    const fromPos = this._getOutputPinPosition(fromNode, dragWire.from.pin);
    if (!fromPos) return;

    const srcType = (NodeDefs[fromNode.kind]?.pinsOut?.[dragWire.from.pin]?.type) || 'default';
    const color = this._getWireColor(srcType);
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    this._drawBezierCurve(fromPos.x, fromPos.y, dragWire.pos.x, dragWire.pos.y);
  }

  _renderNodes(nodes, selection) {
    for (const node of nodes) {
      this._renderNode(node, selection.has(node.id));
    }
  }

  _renderNode(node, isSelected) {
    const ctx = this.ctx;

    // Enhanced node background with subtle gradient
    const gradient = ctx.createLinearGradient(node.x, node.y, node.x, node.y + node.h);
    gradient.addColorStop(0, '#252525');
    gradient.addColorStop(1, '#1b1b1b');
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = isSelected ? '#66aaff' : '#404040';
    ctx.lineWidth = isSelected ? 2 : 1;
    
    ctx.beginPath();
    ctx.roundRect(node.x, node.y, node.w, node.h, 8);
    ctx.fill();
    ctx.stroke();

    // Add subtle inner glow for selected nodes
    if (isSelected) {
      ctx.save();
      ctx.shadowColor = '#66aaff';
      ctx.shadowBlur = 8;
      ctx.shadowInset = true;
      ctx.strokeStyle = 'rgba(102, 170, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(node.x + 1, node.y + 1, node.w - 2, node.h - 2, 7);
      ctx.stroke();
      ctx.restore();
    }

    // Draw node category indicator (small colored bar on the left)
    const categoryColor = this._getCategoryColor(NodeDefs[node.kind]?.cat || 'default');
    ctx.fillStyle = categoryColor;
    ctx.fillRect(node.x, node.y + 8, 3, node.h - 16);

    // Draw node label with better typography
    ctx.fillStyle = '#e8e8e8';
    ctx.font = `${Math.max(10, 12 / this.viewport.scale)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
    ctx.fontWeight = '500';
    const label = NodeDefs[node.kind]?.label || node.kind;
    ctx.fillText(label, node.x + 10, node.y + 18);

    // Render enhanced thumbnail
    this._renderNodeThumbnail(node);

    // Render pins with enhanced styling
    this._renderNodePins(node);

    // Add subtle drop shadow for depth
    if (!isSelected) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.roundRect(node.x + 2, node.y + 2, node.w, node.h, 8);
      ctx.fill();
      ctx.restore();
    }
  }

  _renderNodeThumbnail(node) {
    if (!node.__thumb) return;

    const ctx = this.ctx;
    const thumbSize = 32; // Match the enhanced preview size
    const padding = 6;
    const thumbX = node.x + node.w - thumbSize - padding;
    const thumbY = node.y + padding;

    // Enhanced thumbnail background with border
    ctx.save();
    
    // Thumbnail background
    ctx.fillStyle = '#0a0a0a';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(thumbX - 1, thumbY - 1, thumbSize + 2, thumbSize + 2, 4);
    ctx.fill();
    ctx.stroke();

    // Handle both Canvas objects (new) and ImageData objects (old)
    if (node.__thumb instanceof HTMLCanvasElement) {
      // New enhanced Canvas-based thumbnails
      ctx.drawImage(node.__thumb, thumbX, thumbY, thumbSize, thumbSize);
    } else if (node.__thumb.data) {
      // Legacy ImageData thumbnails - convert to canvas for better rendering
      if (!node.__thumbCanvas || node.__thumbCanvas.__imageDataVer !== node.__thumb) {
        const canvas = document.createElement('canvas');
        canvas.width = node.__thumb.width || 16;
        canvas.height = node.__thumb.height || 16;
        const canvasCtx = canvas.getContext('2d');
        
        try {
          canvasCtx.putImageData(node.__thumb, 0, 0);
          canvas.__imageDataVer = node.__thumb;
          node.__thumbCanvas = canvas;
        } catch(e) {
          console.warn('Failed to render thumbnail:', e);
          return;
        }
      }
      
      // Draw the legacy thumbnail scaled up
      ctx.imageSmoothingEnabled = false; // Pixel art scaling
      ctx.drawImage(node.__thumbCanvas, thumbX, thumbY, thumbSize, thumbSize);
      ctx.imageSmoothingEnabled = true;
    }

    // Add a subtle inner border to the thumbnail
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 3);
    ctx.stroke();

    ctx.restore();
  }

  _renderNodePins(node) {
    const ctx = this.ctx;
    const { inputPins, outputPins } = this._getNodePinPositions(node);

    // Enhanced pin rendering with glow effects
    ctx.save();

    // Render output pins with enhanced styling
    for (const [i, pos] of outputPins.entries()) {
      const pinType = NodeDefs[node.kind]?.pinsOut?.[i]?.type || 'default';
      const pinColor = this._getWireColor(pinType);
      
      // Pin glow effect
      ctx.shadowColor = pinColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = pinColor;
      this._drawEnhancedPin(pos.x, pos.y, 5, 'output');
      
      // Reset shadow for label
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      this._renderOutputPinLabel(node, i, pos);
    }

    // Render input pins with enhanced styling
    for (const [i, pos] of inputPins.entries()) {
      const connected = node.inputs && node.inputs[i];
      const pinColor = connected ? '#ff7a7a' : '#444';
      
      if (connected) {
        ctx.shadowColor = '#ff7a7a';
        ctx.shadowBlur = 6;
      }
      
      ctx.fillStyle = pinColor;
      this._drawEnhancedPin(pos.x, pos.y, 4, 'input');
      
      // Input pin label
      if (!connected) {
        const inputLabel = NodeDefs[node.kind]?.pinsIn?.[i] || `In${i}`;
        ctx.fillStyle = '#666';
        ctx.font = `${Math.max(8, 9 / this.viewport.scale)}px ui-monospace, Consolas, monospace`;
        ctx.fillText(inputLabel, pos.x - ctx.measureText(inputLabel).width - 8, pos.y + 3);
      }
    }

    ctx.restore();
  }

  _drawEnhancedPin(x, y, radius, type) {
    const ctx = this.ctx;
    
    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, radius + 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Main pin
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(x - 1, y - 1, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  _renderOutputPinLabel(node, pinIndex, pinPos) {
    const ctx = this.ctx;
    const pinDef = NodeDefs[node.kind]?.pinsOut?.[pinIndex];
    const pinType = pinDef?.type || '•';
    
    let labelText = pinType;
    
    // Enhanced labels with more context
    if (node.kind === 'ConstFloat' && typeof node.value === 'number') {
      labelText = `${node.value.toFixed(2)}`;
    } else if (node.kind === 'ConstVec2' && node.x !== undefined && node.y !== undefined) {
      labelText = `(${node.x.toFixed(1)}, ${node.y.toFixed(1)})`;
    } else if (node.kind === 'ConstVec3' && node.x !== undefined) {
      labelText = `(${(node.x || 0).toFixed(1)}, ${(node.y || 0).toFixed(1)}, ${(node.z || 0).toFixed(1)})`;
    } else if (node.kind === 'Expr' && node.expr) {
      labelText = node.expr.length > 8 ? node.expr.substring(0, 8) + '...' : node.expr;
    } else if (pinDef?.label) {
      labelText = pinDef.label;
    }

    // Skip label if it would be too cramped
    if (this.viewport.scale < 0.7) return;

    ctx.save();
    ctx.font = `${Math.max(8, 9 / this.viewport.scale)}px ui-monospace, Consolas, monospace`;
    const textWidth = ctx.measureText(labelText).width + 8;
    
    // Enhanced label background with gradient
    const gradient = ctx.createLinearGradient(
      pinPos.x + 8, pinPos.y - 8, 
      pinPos.x + 8, pinPos.y + 4
    );
    gradient.addColorStop(0, 'rgba(20, 20, 25, 0.95)');
    gradient.addColorStop(1, 'rgba(15, 15, 20, 0.95)');
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pinPos.x + 8, pinPos.y - 8, textWidth, 12, 3);
    ctx.fill();
    ctx.stroke();
    
    // Label text with better color based on pin type
    const textColor = this._getWireColor(pinType);
    ctx.fillStyle = textColor;
    ctx.fillText(labelText, pinPos.x + 12, pinPos.y + 2);
    ctx.restore();
  }

  _renderSelectionOutline(node) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setLineDash([]);
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#66aaff';
    ctx.beginPath();
    ctx.roundRect(node.x - 2, node.y - 2, node.w + 4, node.h + 4, 10);
    ctx.stroke();
    ctx.restore();
  }

  _renderSelectionBox(boxSelect) {
    const ctx = this.ctx;
    const x0 = Math.min(boxSelect.x0, boxSelect.x1);
    const y0 = Math.min(boxSelect.y0, boxSelect.y1);
    const x1 = Math.max(boxSelect.x0, boxSelect.x1);
    const y1 = Math.max(boxSelect.y0, boxSelect.y1);

    ctx.save();
    ctx.setLineDash([8, 4]);
    ctx.strokeStyle = '#66aaff';
    ctx.fillStyle = 'rgba(102, 170, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  // Helper methods
  _getNodePinPositions(node) {
    const inputPins = [];
    for (let i = 0; i < (NodeDefs[node.kind]?.inputs || 0); i++) {
      inputPins.push({ x: node.x + 8, y: node.y + 32 + i * 18 });
    }

    const outputPins = [];
    const outCount = (NodeDefs[node.kind]?.pinsOut || []).length || 1;
    for (let i = 0; i < outCount; i++) {
      outputPins.push({ x: node.x + node.w - 8, y: node.y + 32 + i * 18 });
    }

    return { inputPins, outputPins };
  }

  _getInputPinPosition(node, pinIndex) {
    const { inputPins } = this._getNodePinPositions(node);
    return inputPins[pinIndex] || null;
  }

  _getOutputPinPosition(node, pinIndex) {
    const { outputPins } = this._getNodePinPositions(node);
    return outputPins[pinIndex] || null;
  }

  _getWireColor(type) {
    switch (type) {
      case 'f32': return '#ffd166';      // Yellow for floats
      case 'vec2': return '#40c9b4';     // Teal for vec2  
      case 'vec3': return '#d06bff';     // Purple for vec3
      case 'vec4': return '#ff6b9d';     // Pink for vec4
      default: return '#9aa0a6';         // Gray for default
    }
  }

  _getCategoryColor(category) {
    // Colors that match the menu system categories
    switch (category) {
      case 'Input': return '#10b981';    // Emerald
      case 'Math': return '#f59e0b';     // Amber
      case 'Field': return '#8b5cf6';    // Violet
      case 'Utility': return '#06b6d4';  // Cyan
      case 'Output': return '#ef4444';   // Red
      case 'Misc': return '#6b7280';     // Gray
      default: return '#6b7280';         // Gray
    }
  }

  _drawBezierCurve(x1, y1, x2, y2) {
    const ctx = this.ctx;
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    
    // Add subtle shadow to wires
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
    ctx.stroke();
    
    ctx.restore();
  }

  _drawPin(x, y, radius) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}