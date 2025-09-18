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
    
    // Prevent clicks inside the panel from bubbling up
    panel.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // Prevent mousedown events from bubbling up
    panel.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    
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
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    
    buttons.appendChild(closeBtn);
    panel.appendChild(buttons);
    
    document.body.appendChild(panel);
    this.panel = panel;
    this.currentNode = node;
    
    // Focus the first input after a short delay
    setTimeout(() => {
      const firstInput = panel.querySelector('.param-input');
      if (firstInput) {
        firstInput.focus();
      }
    }, 10);
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
    input.addEventListener('input', (e) => {
      e.stopPropagation();
      this._updateNodeParameter(node, param.name, input.value.trim());
    });
    
    // Prevent click events from bubbling up from the input
    input.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    // Numeric drag support for float parameters
    if (param.type === 'float') {
      this._addNumericDragSupport(input, node, param.name);
    }
    
    div.appendChild(input);
    return div;
  }

// Replace _getNodeParameterValue in ParameterPanel.js with this:

_getNodeParameterValue(node, paramName, defaultValue) {
  // First check if there's a connected input for this parameter
  const connectedValue = this._getConnectedInputValue(node, paramName);
  if (connectedValue !== undefined) {
    return connectedValue; // Show the connected input value in the panel
  }
  
  // Otherwise use the stored parameter value
  if (paramName === 'value' && typeof node.value !== 'undefined') return node.value;
  if (paramName === 'x' && typeof node.x !== 'undefined') return node.x;
  if (paramName === 'y' && typeof node.y !== 'undefined') return node.y;
  if (paramName === 'expr' && typeof node.expr !== 'undefined') return node.expr;
  if (node.props && typeof node.props[paramName] !== 'undefined') return node.props[paramName];
  return defaultValue;
}

// Add this new method to ParameterPanel.js:

_getConnectedInputValue(node, paramName) {
  if (!this.graph?.connections) return undefined;
  
  // Map parameter names to input pin indices
  const paramToPinMap = {
    'radius': 0,
    'epsilon': 1,
    'value': 0,
    'x': 0,
    'y': 1,
    'z': 2
  };
  
  const pinIndex = paramToPinMap[paramName];
  if (pinIndex === undefined) return undefined;
  
  // Find connection to this node's input pin
  for (const conn of this.graph.connections) {
    if (conn.to.nodeId === node.id && conn.to.pin === pinIndex) {
      const sourceNode = this.graph.nodes.find(n => n.id === conn.from.nodeId);
      if (sourceNode) {
        // Get the value from the source node
        return this._getSourceNodeValue(sourceNode);
      }
    }
  }
  
  return undefined;
}

// Add this helper method to ParameterPanel.js:

_getSourceNodeValue(node) {
  switch (node.kind.toLowerCase()) {
    case 'constfloat':
    case 'float':
      return node.props?.value || node.value || 0;
    case 'time':
      return (Date.now() / 1000) % 1;
    case 'uv':
      return 0.5;
    default:
      return 0;
  }
}

// Also modify your _createParameterInput method to add real-time updates:

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

  // Get current value (now includes connected input values)
  let currentValue = this._getNodeParameterValue(node, param.name, param.default);
  input.value = String(currentValue);
  
  // Check if this parameter has a connected input
  const hasConnectedInput = this._getConnectedInputValue(node, param.name) !== undefined;
  if (hasConnectedInput) {
    input.style.backgroundColor = '#2a4a2a'; // Green tint to show it's connected
    input.title = 'Connected to input - value reflects connected node';
  }
  
  input.placeholder = param.type === 'expression' ? 'Enter expression...' : `Default: ${param.default}`;
  
  // Real-time updates on input
  input.addEventListener('input', (e) => {
    e.stopPropagation();
    this._updateNodeParameter(node, param.name, input.value.trim());
  });
  
  input.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Numeric drag support for float parameters
  if (param.type === 'float') {
    this._addNumericDragSupport(input, node, param.name);
  }
  
  // Store reference for real-time updates
  input._paramName = param.name;
  input._node = node;
  
  div.appendChild(input);
  return div;
}

// Replace your _updateNodeParameter method with this:

_updateNodeParameter(node, paramName, value) {
  console.log('Parameter update:', node.kind, paramName, value);

  // Check if this parameter has a connected input
  const connectedSourceNode = this._findConnectedSourceNode(node, paramName);
  
  if (connectedSourceNode) {
    // Update the source Float node instead of this node
    console.log('Updating connected source node:', connectedSourceNode.kind, connectedSourceNode.id);
    
    // Update the source node's value
    if (connectedSourceNode.kind === 'ConstFloat' || connectedSourceNode.kind === 'Float') {
      const numValue = isNaN(Number(value)) ? 0 : Number(value);
      
      // Store in both places for compatibility
      connectedSourceNode.value = numValue;
      if (!connectedSourceNode.props) connectedSourceNode.props = {};
      connectedSourceNode.props.value = numValue;
      
      console.log('Updated source Float node value to:', numValue);
      
      // Trigger updates for the source node
      if (this.onChange) this.onChange(); // Trigger shader recompilation
      
      if (window.editor?.previewIntegration) {
        console.log('Calling onParameterChange for source node:', connectedSourceNode.kind);
        window.editor.previewIntegration.onParameterChange(connectedSourceNode);
      }
    }
  } else {
    // No connected input - update this node's parameter normally
    console.log('No connected input - updating node parameter directly');
    
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
    
    if (window.editor?.previewIntegration) {
      console.log('Calling onParameterChange for:', node.kind);
      window.editor.previewIntegration.onParameterChange(node);
    }
  }
}

// Add this helper method to ParameterPanel.js:

_findConnectedSourceNode(node, paramName) {
  if (!this.graph?.connections) return null;
  
  // Map parameter names to input pin indices
  const paramToPinMap = {
    'radius': 0,
    'epsilon': 1,
    'value': 0,
    'x': 0,
    'y': 1,
    'z': 2
  };
  
  const pinIndex = paramToPinMap[paramName];
  if (pinIndex === undefined) return null;
  
  // Find connection to this node's input pin
  for (const conn of this.graph.connections) {
    if (conn.to.nodeId === node.id && conn.to.pin === pinIndex) {
      const sourceNode = this.graph.nodes.find(n => n.id === conn.from.nodeId);
      return sourceNode || null;
    }
  }
  
  return null;
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
        e.stopPropagation();
        
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