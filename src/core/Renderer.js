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

    // Draw node background
    ctx.fillStyle = '#1b1b1b';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(node.x, node.y, node.w, node.h, 8);
    ctx.fill();
    ctx.stroke();

    // Draw node label
    ctx.fillStyle = '#ddd';
    ctx.font = `${12 / this.viewport.scale}px sans-serif`;
    const label = NodeDefs[node.kind]?.label || node.kind;
    ctx.fillText(label, node.x + 8, node.y + 18);

    // Render thumbnail if available
    this._renderNodeThumbnail(node);

    // Render pins
    this._renderNodePins(node);

    // Draw selection outline
    if (isSelected) {
      this._renderSelectionOutline(node);
    }
  }

  _renderNodeThumbnail(node) {
    if (!node.__thumb) return;

    const ctx = this.ctx;
    
    // Create/update thumbnail canvas if needed
    if (!node.__thumbCanvas || node.__thumbCanvas.__ver !== node.__thumb) {
      const canvas = document.createElement('canvas');
      canvas.width = node.__thumb.width || 16;
      canvas.height = node.__thumb.height || 16;
      const canvasCtx = canvas.getContext('2d');
      
      try {
        canvasCtx.putImageData(node.__thumb, 0, 0);
      } catch(_) {
        // Ignore putImageData errors
      }
      
      canvas.__ver = node.__thumb;
      node.__thumbCanvas = canvas;
    }

    const tw = 16, th = 16;
    ctx.drawImage(
      node.__thumbCanvas, 
      Math.floor(node.x + node.w - 4 - tw), 
      Math.floor(node.y + 4), 
      tw, th
    );
  }

  _renderNodePins(node) {
    const ctx = this.ctx;
    const { inputPins, outputPins } = this._getNodePinPositions(node);

    // Render output pins (blue)
    ctx.fillStyle = '#4aa3ff';
    for (const [i, pos] of outputPins.entries()) {
      this._drawPin(pos.x, pos.y, 4);
      this._renderOutputPinLabel(node, i, pos);
    }

    // Render input pins (red)
    ctx.fillStyle = '#ff7a7a';
    for (const pos of inputPins) {
      this._drawPin(pos.x, pos.y, 4);
    }
  }

  _renderOutputPinLabel(node, pinIndex, pinPos) {
    const ctx = this.ctx;
    const pinType = (NodeDefs[node.kind]?.pinsOut?.[pinIndex]?.type) || '•';
    
    let labelText = pinType;
    
    // Special cases for specific node types
    if (node.kind === 'ConstFloat' && typeof node.value === 'number') {
      labelText = `${pinType}:${node.value.toFixed(3)}`;
    } else if (node.kind === 'Expr' && node.expr) {
      labelText = `${pinType}:${node.expr}`;
    }

    ctx.save();
    ctx.font = `${10 / this.viewport.scale}px ui-monospace,Consolas,monospace`;
    const textWidth = ctx.measureText(labelText).width + 6;
    
    // Draw label background
    ctx.fillStyle = '#0f0f0f';
    ctx.strokeStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.roundRect(pinPos.x + 6, pinPos.y - 8, textWidth, 12, 3);
    ctx.fill();
    ctx.stroke();
    
    // Draw label text
    ctx.fillStyle = '#9aa0a6';
    ctx.fillText(labelText, pinPos.x + 9, pinPos.y + 3);
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
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#66aaff';
    ctx.fillStyle = 'rgba(102,170,255,0.12)';
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
      default: return '#888';            // Gray for default
    }
  }

  _drawBezierCurve(x1, y1, x2, y2) {
    const ctx = this.ctx;
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
    ctx.stroke();
  }

  _drawPin(x, y, radius) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}