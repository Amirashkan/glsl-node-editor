// src/core/renderers/NodeRenderer.js
// Focused node rendering with separated concerns

import { NodeDefs } from '../../data/NodeDefs.js';
import { NodeStyler } from './NodeStyler.js';
import { RenderingContext } from './RenderingContext.js';

export class NodeRenderer {
  constructor(styler, renderingContext) {
    this.styler = styler;
    this.rc = renderingContext;
  }

  renderNode(node, isSelected, viewport, editor) {
    // Ensure node has proper dimensions
    if (!node.w) node.w = 120;
    if (!node.h) node.h = 80;

    // Render components in order
    this.renderBackground(node, isSelected);
    this.renderCategoryIndicator(node);
    this.renderLabel(node, viewport);
    this.renderThumbnail(node, editor);
    this.renderPreviewControls(node, editor);
    this.renderPins(node, viewport, editor);
    
    if (isSelected) {
      this.renderSelectionGlow(node);
    }
  }

  renderBackground(node, isSelected) {
    const style = this.styler.getNodeStyle(isSelected);
    
    // Draw drop shadow FIRST (behind the main node)
    if (!isSelected) {
      this.rc.drawRoundedRect(node.x + 2, node.y + 2, node.w, node.h, 8, {
        fill: 'rgba(0, 0, 0, 0.3)'  // Semi-transparent shadow
      });
    }
    
    // Main node rectangle with gradient ON TOP
    this.rc.drawRoundedRect(node.x, node.y, node.w, node.h, 8, {
      fill: style.background,
      stroke: {
        color: style.border,
        width: style.borderWidth
      }
    });
  }

  renderSelectionGlow(node) {
    const style = this.styler.getNodeStyle(true);
    if (style.glow) {
      this.rc.drawGlow(node.x, node.y, node.w, node.h, 8, style.glow);
    }
  }

  renderCategoryIndicator(node) {
    const categoryColor = this.styler.getCategoryColor(NodeDefs[node.kind]?.cat || 'default');
    this.rc.drawRoundedRect(node.x, node.y + 8, 3, node.h - 16, 1.5, {
      fill: categoryColor
    });
  }

  renderLabel(node, viewport) {
    const textStyle = this.styler.getTextStyle(viewport.scale, 'label');
    const label = NodeDefs[node.kind]?.label || node.kind;
    
    this.rc.drawText(label, node.x + 10, node.y + 18, textStyle);
  }

  renderThumbnail(node, editor) {
    if (!node.__thumb || !editor) return;

    const thumbSize = editor.getPreviewSize(node.id);
    const style = this.styler.getThumbnailStyle(thumbSize);
    
    // Smart positioning based on size
    let thumbX, thumbY;
    if (thumbSize <= 64) {
      thumbX = node.x + node.w - thumbSize - 6;
      thumbY = node.y + 6;
    } else {
      thumbX = node.x + 6;
      thumbY = node.y + 25;
    }

    this.rc.drawThumbnail(thumbX, thumbY, thumbSize, node.__thumb, style);
  }

  renderPreviewControls(node, editor) {
    if (!editor || !editor.shouldShowPreview(node)) return;

    const controlY = node.y + 50;
    const buttonWidth = 12;
    const buttonHeight = 10;

    // Hide visual info button
    const hideX = node.x + node.w - 65;
    const showVisualInfo = editor.isVisualInfoEnabled(node.id);
    const hideStyle = this.styler.getControlButtonStyle(showVisualInfo, 'hide');
    this.rc.drawControlButton(hideX, controlY, buttonWidth, buttonHeight, hideStyle, hideStyle.text);

    // Preview toggle button
    const eyeX = node.x + node.w - 45;
    const isPreviewEnabled = editor.isPreviewEnabled;
    const previewStyle = this.styler.getControlButtonStyle(isPreviewEnabled, 'preview');
    this.rc.drawControlButton(eyeX, controlY, buttonWidth, buttonHeight, previewStyle, previewStyle.text);

    // Size cycle button
    const sizeX = node.x + node.w - 25;
    const currentSize = editor.nodePreviews.get(node.id)?.size || 'small';
    const sizeLabel = currentSize === 'small' ? 'S' : currentSize === 'medium' ? 'M' : 'L';
    const sizeDisabled = !isPreviewEnabled;
    const sizeStyle = this.styler.getControlButtonStyle(!sizeDisabled, 'size');
    this.rc.drawControlButton(sizeX, controlY, buttonWidth, buttonHeight, sizeStyle, sizeLabel);
  }

  renderPins(node, viewport, editor) {
    const { inputPins, outputPins } = this.getNodePinPositions(node);

    // Render output pins
    for (const [i, pos] of outputPins.entries()) {
      const pinType = NodeDefs[node.kind]?.pinsOut?.[i]?.type || 'default';
      const style = this.styler.getOutputPinStyle(pinType);
      
      this.rc.drawPin(pos.x, pos.y, style);
      this.renderOutputPinLabel(node, i, pos, viewport, editor);
    }

    // Render input pins
    for (const [i, pos] of inputPins.entries()) {
      const connected = node.inputs && node.inputs[i];
      const pinType = NodeDefs[node.kind]?.pinsIn?.[i] || 'default';
      const style = this.styler.getPinStyle(pinType, connected);
      
      this.rc.drawPin(pos.x, pos.y, style);
      
      // Input pin label (only if not connected)
      if (!connected) {
        const inputLabel = NodeDefs[node.kind]?.pinsIn?.[i] || `In${i}`;
        const textStyle = this.styler.getTextStyle(viewport.scale, 'pin');
        const textMetrics = this.rc.drawText('', 0, 0, textStyle); // Get metrics without drawing
        const textWidth = this.rc.ctx.measureText(inputLabel).width;
        this.rc.drawText(inputLabel, pos.x - textWidth - 8, pos.y + 3, textStyle);
      }
    }
  }

  renderOutputPinLabel(node, pinIndex, pinPos, viewport, editor) {
    if (!editor || !editor.isPreviewEnabled || viewport.scale < 0.7) return;

    const pinDef = NodeDefs[node.kind]?.pinsOut?.[pinIndex];
    const pinType = pinDef?.type || '•';
    
    let labelText = this.getEnhancedLabelText(node, pinDef, pinType);
    
    const textStyle = this.styler.getTextStyle(viewport.scale, 'pin');
    const textMetrics = this.rc.ctx.measureText(labelText);
    const textWidth = textMetrics.width + 8;
    
    // Draw label background
    this.rc.drawLabelBackground(pinPos.x + 8, pinPos.y, textWidth, 12);
    
    // Draw label text
    const textColor = this.styler.getWireColor(pinType);
    this.rc.drawText(labelText, pinPos.x + 12, pinPos.y + 2, {
      ...textStyle,
      color: textColor
    });
  }

  getEnhancedLabelText(node, pinDef, pinType) {
    // Enhanced labels with more context
    if (node.kind === 'ConstFloat' && typeof node.value === 'number') {
      return `${node.value.toFixed(2)}`;
    } else if (node.kind === 'ConstVec2' && node.x !== undefined && node.y !== undefined) {
      return `(${node.x.toFixed(1)}, ${node.y.toFixed(1)})`;
    } else if (node.kind === 'ConstVec3' && node.x !== undefined) {
      return `(${(node.x || 0).toFixed(1)}, ${(node.y || 0).toFixed(1)}, ${(node.z || 0).toFixed(1)})`;
    } else if (node.kind === 'Expr' && node.expr) {
      return node.expr.length > 8 ? node.expr.substring(0, 8) + '...' : node.expr;
    } else if (pinDef?.label) {
      return pinDef.label;
    }
    return pinType;
  }

  getNodePinPositions(node) {
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

  getInputPinPosition(node, pinIndex) {
    const { inputPins } = this.getNodePinPositions(node);
    return inputPins[pinIndex] || null;
  }

  getOutputPinPosition(node, pinIndex) {
    const { outputPins } = this.getNodePinPositions(node);
    return outputPins[pinIndex] || null;
  }
}