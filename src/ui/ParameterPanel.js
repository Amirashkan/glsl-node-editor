// src/ui/ParameterPanel.js
import { NodeDefs } from '../data/NodeDefs.js';

export class ParameterPanel {
  constructor(graph, onChange) {
    this.graph = graph;
    this.onChange = onChange;
    this.panel = null;
    this.currentNode = null;
  }

  hide() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
      this.currentNode = null;
    }
  }

  contains(element) {
    return this.panel && this.panel.contains(element);
  }

  show(node, clientX, clientY) {
    console.log('ParameterPanel.show called for:', node.kind, 'at', clientX, clientY);
    
    this.hide();
    const def = NodeDefs[node.kind];
    console.log('NodeDef found:', def);
    
    if (!def?.params || def.params.length === 0) {
      console.log('No parameters for this node type');
      return;
    }
    
    console.log('Creating panel with', def.params.length, 'parameters');
    
    const panel = document.createElement('div');
    panel.className = 'param-panel';
    panel.style.position = 'fixed';
    panel.style.left = (clientX + 20) + 'px';
    panel.style.top = clientY + 'px';
    panel.style.zIndex = '1000';
    
    // Header
    const header = document.createElement('div');
    header.className = 'param-header';
    header.textContent = `${def.label} Parameters`;
    panel.appendChild(header);
    
    // Parameters
    for (const param of def.params) {
      const paramDiv = this._createParameterInput(param, node);
      panel.appendChild(paramDiv);
    }
    
    // Close button
    const buttons = document.createElement('div');
    buttons.className = 'param-buttons';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => {
      this.hide();
    });
    
    buttons.appendChild(closeBtn);
    panel.appendChild(buttons);
    
    document.body.appendChild(panel);
    this.panel = panel;
    this.currentNode = node;
  }

  _createParameterInput(param, node) {
    const div = document.createElement('div');
    div.className = 'param-input-group';
    
    const label = document.createElement('label');
    label.textContent = param.label;
    div.appendChild(label);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'param-input';
    input.dataset.paramName = param.name;
    input.dataset.paramType = param.type;

    // Get current value
    let currentValue = this._getNodeParameterValue(node, param.name, param.default);
    input.value = String(currentValue);
    input.placeholder = param.type === 'expression' ? 'Enter expression...' : `Default: ${param.default}`;
    
    // Real-time updates on input
    input.addEventListener('input', () => {
      this._updateNodeParameter(node, param.name, input.value.trim());
    });
    
    // Numeric drag support for float parameters
    if (param.type === 'float') {
      this._addNumericDragSupport(input, node, param.name);
    }
    
    div.appendChild(input);
    return div;
  }

  _getNodeParameterValue(node, paramName, defaultValue) {
    if (paramName === 'value' && typeof node.value !== 'undefined') return node.value;
    if (paramName === 'x' && typeof node.x !== 'undefined') return node.x;
    if (paramName === 'y' && typeof node.y !== 'undefined') return node.y;
    if (paramName === 'expr' && typeof node.expr !== 'undefined') return node.expr;
    if (node.props && typeof node.props[paramName] !== 'undefined') return node.props[paramName];
    return defaultValue;
  }

  _updateNodeParameter(node, paramName, value) {
    // Store the value
    if (paramName === 'value') {
      node.value = isNaN(Number(value)) ? value : Number(value);
    } else if (paramName === 'x') {
      node.x = isNaN(Number(value)) ? value : Number(value);
    } else if (paramName === 'y') {
      node.y = isNaN(Number(value)) ? value : Number(value);
    } else if (paramName === 'expr') {
      node.expr = value;
    } else {
      // For CircleField props and others
      if (!node.props) node.props = {};
      node.props[paramName] = isNaN(Number(value)) ? value : Number(value);
    }
    
    // Immediate updates
    if (this.onChange) this.onChange(); // Trigger shader recompilation
  }

  _addNumericDragSupport(input, node, paramName) {
    let isDragging = false;
    let startValue = 0;
    let startY = 0;
    
    input.addEventListener('mousedown', (e) => {
      if (e.button === 0 && e.shiftKey) { // Shift+click for drag mode
        isDragging = true;
        startValue = parseFloat(input.value) || 0;
        startY = e.clientY;
        input.style.cursor = 'ns-resize';
        e.preventDefault();
        
        const onMouseMove = (e) => {
          if (!isDragging) return;
          const deltaY = startY - e.clientY; // Inverted: up = positive
          const sensitivity = e.ctrlKey ? 0.001 : (e.altKey ? 0.1 : 0.01);
          const newValue = startValue + (deltaY * sensitivity);
          input.value = newValue.toFixed(3);
          this._updateNodeParameter(node, paramName, input.value);
          e.preventDefault();
        };
        
        const onMouseUp = () => {
          isDragging = false;
          input.style.cursor = '';
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      }
    });
    
    // Add visual hint
    input.title = 'Shift+drag to adjust value\nCtrl: fine precision, Alt: coarse precision';
  }
}