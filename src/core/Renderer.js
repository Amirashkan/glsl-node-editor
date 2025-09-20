// src/core/Renderer.js - Refactored with separated concerns
import { NodeDefs } from '../data/NodeDefs.js';
import { NodeRenderer } from './renderers/NodeRenderer.js';
import { NodeStyler } from './renderers/NodeStyler.js';
import { RenderingContext } from './renderers/RenderingContext.js';

export class Renderer {
  constructor(ctx, viewport) {
    this.ctx = ctx;
    this.viewport = viewport;
    
    // Initialize rendering components
    this.styler = new NodeStyler();
    this.rc = new RenderingContext(ctx);
    this.nodeRenderer = new NodeRenderer(this.styler, this.rc);
  }

  render(graph, renderState) {
    // Make editor accessible (for backward compatibility)
    if (renderState.editor) {
      window.editor = renderState.editor;
    }

    // Clear and setup viewport
    this.rc.clear();
    this.rc.applyViewportTransform(this.viewport);

    // Render scene components
    this.renderConnections(graph.connections, graph.nodes);
    this.renderDragWire(renderState.dragWire, graph.nodes);
    this.renderNodes(graph.nodes, renderState.selection, renderState.editor);
    this.renderSelectionBox(renderState.boxSelect);

    this.rc.restoreViewportTransform();
  }

  renderConnections(connections, nodes) {
    for (const connection of connections) {
      const fromNode = nodes.find(n => n.id === connection.from.nodeId);
      const toNode = nodes.find(n => n.id === connection.to.nodeId);
      if (!fromNode || !toNode) continue;

      const fromPos = this.nodeRenderer.getOutputPinPosition(fromNode, connection.from.pin);
      const toPos = this.nodeRenderer.getInputPinPosition(toNode, connection.to.pin);
      if (!fromPos || !toPos) continue;

      // Get wire color based on output type
      const srcType = NodeDefs[fromNode.kind]?.pinsOut?.[connection.from.pin]?.type || 'default';
      const color = this.styler.getWireColor(srcType);
      
      this.rc.drawBezierWire(fromPos.x, fromPos.y, toPos.x, toPos.y, color);
    }
  }

  renderDragWire(dragWire, nodes) {
    if (!dragWire) return;

    const fromNode = nodes.find(n => n.id === dragWire.from.nodeId);
    if (!fromNode) return;

    const fromPos = this.nodeRenderer.getOutputPinPosition(fromNode, dragWire.from.pin);
    if (!fromPos) return;

    const srcType = NodeDefs[fromNode.kind]?.pinsOut?.[dragWire.from.pin]?.type || 'default';
    const color = this.styler.getWireColor(srcType);
    
    this.rc.drawBezierWire(fromPos.x, fromPos.y, dragWire.pos.x, dragWire.pos.y, color);
  }

  renderNodes(nodes, selection, editor) {
    for (const node of nodes) {
      const isSelected = selection.has(node.id);
      this.nodeRenderer.renderNode(node, isSelected, this.viewport, editor);
    }
  }

  renderSelectionBox(boxSelect) {
    if (!boxSelect) return;
    this.rc.drawSelectionBox(boxSelect.x0, boxSelect.y0, boxSelect.x1, boxSelect.y1);
  }

  // Public API for pin position queries (backward compatibility)
  getInputPinPosition(node, pinIndex) {
    return this.nodeRenderer.getInputPinPosition(node, pinIndex);
  }

  getOutputPinPosition(node, pinIndex) {
    return this.nodeRenderer.getOutputPinPosition(node, pinIndex);
  }

  // Legacy method support
  _getInputPinPosition(node, pinIndex) {
    return this.getInputPinPosition(node, pinIndex);
  }

  _getOutputPinPosition(node, pinIndex) {
    return this.getOutputPinPosition(node, pinIndex);
  }

  _getWireColor(type) {
    return this.styler.getWireColor(type);
  }
}