// src/ui/parameters/ParameterHandler.js
// Handles parameter value management and connected inputs

export class ParameterHandler {
  constructor(graph, onChange) {
    this.graph = graph;
    this.onChange = onChange;
  }

  getParameterValue(node, paramName, defaultValue) {
    // First check if there's a connected input for this parameter
    const connectedValue = this.getConnectedInputValue(node, paramName);
    if (connectedValue !== undefined) {
      return connectedValue;
    }
    
    // Otherwise use the stored parameter value
    return this.getStoredParameterValue(node, paramName, defaultValue);
  }

  getStoredParameterValue(node, paramName, defaultValue) {
    if (paramName === 'value' && typeof node.value !== 'undefined') return node.value;
    if (paramName === 'x' && typeof node.x !== 'undefined') return node.x;
    if (paramName === 'y' && typeof node.y !== 'undefined') return node.y;
    if (paramName === 'expr' && typeof node.expr !== 'undefined') return node.expr;
    if (node.props && typeof node.props[paramName] !== 'undefined') return node.props[paramName];
    return defaultValue;
  }

  hasConnectedInput(node, paramName) {
    return this.getConnectedInputValue(node, paramName) !== undefined;
  }

  getConnectedInputValue(node, paramName) {
    if (!this.graph?.connections) return undefined;
    
    const pinIndex = this.getParameterPinIndex(paramName);
    if (pinIndex === undefined) return undefined;
    
    // Find connection to this node's input pin
    for (const conn of this.graph.connections) {
      if (conn.to.nodeId === node.id && conn.to.pin === pinIndex) {
        const sourceNode = this.graph.nodes.find(n => n.id === conn.from.nodeId);
        if (sourceNode) {
          return this.getSourceNodeValue(sourceNode);
        }
      }
    }
    
    return undefined;
  }

  getParameterPinIndex(paramName) {
    // Map parameter names to input pin indices
    const paramToPinMap = {
      'radius': 0,
      'epsilon': 1,
      'value': 0,
      'x': 0,
      'y': 1,
      'z': 2
    };
    
    return paramToPinMap[paramName];
  }

  getSourceNodeValue(node) {
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

  updateParameter(node, paramName, value) {
    console.log('Parameter update:', node.kind, paramName, value);

    const connectedSourceNode = this.findConnectedSourceNode(node, paramName);
    
    if (connectedSourceNode) {
      this.updateConnectedSource(connectedSourceNode, value);
    } else {
      this.updateNodeParameter(node, paramName, value);
    }

    this.triggerUpdates(connectedSourceNode || node);
  }

  updateConnectedSource(sourceNode, value) {
    console.log('Updating connected source node:', sourceNode.kind, sourceNode.id);
    
    if (sourceNode.kind === 'ConstFloat' || sourceNode.kind === 'Float') {
      const numValue = isNaN(Number(value)) ? 0 : Number(value);
      
      sourceNode.value = numValue;
      if (!sourceNode.props) sourceNode.props = {};
      sourceNode.props.value = numValue;
      
      console.log('Updated source Float node value to:', numValue);
    }
  }

  updateNodeParameter(node, paramName, value) {
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
      if (!node.props) node.props = {};
      node.props[paramName] = isNaN(Number(value)) ? value : Number(value);
    }
  }

  findConnectedSourceNode(node, paramName) {
    if (!this.graph?.connections) return null;
    
    const pinIndex = this.getParameterPinIndex(paramName);
    if (pinIndex === undefined) return null;
    
    for (const conn of this.graph.connections) {
      if (conn.to.nodeId === node.id && conn.to.pin === pinIndex) {
        const sourceNode = this.graph.nodes.find(n => n.id === conn.from.nodeId);
        return sourceNode || null;
      }
    }
    
    return null;
  }

  triggerUpdates(node) {
    if (this.onChange) {
      this.onChange();
    }
    
    if (window.editor?.previewIntegration) {
      console.log('Calling onParameterChange for:', node.kind);
      window.editor.previewIntegration.onParameterChange(node);
    }
  }

  async handleFileLoad(node, file, dropZone) {
    try {
      console.log('Loading texture file:', file.name, 'for node:', node.id);
      
      if (!window.textureManager) {
        throw new Error('TextureManager not available. Make sure it\'s initialized.');
      }
      
      // Show loading state
      this.setDropZoneState(dropZone, 'loading', 'Loading...');
      
      // Load the texture
      await window.textureManager.loadTexture(node.id, file, node);
      console.log('✅ Texture loaded successfully');
      
      // Show success state
      this.setDropZoneState(dropZone, 'success', `✓ ${file.name}`);
      
      // Update any visible file labels
      this.updateFileLabels(node, file);
      
      // Trigger updates
      this.triggerFileLoadUpdates(node);
      
      // Reset drop zone after success
      setTimeout(() => {
        this.resetDropZone(dropZone);
      }, 2000);
      
    } catch (error) {
      console.error('Failed to load texture:', error);
      
      // Show error state
      this.setDropZoneState(dropZone, 'error', '❌ Load failed');
      
      setTimeout(() => {
        this.resetDropZone(dropZone);
      }, 3000);
      
      alert(`Failed to load texture: ${error.message}`);
    }
  }

  setDropZoneState(dropZone, state, text) {
    if (!dropZone) return;
    
    const colors = {
      loading: '#f0ad4e',
      success: '#5cb85c',
      error: '#d9534f'
    };
    
    dropZone.style.borderColor = colors[state] || '#666';
    dropZone.innerHTML = `<div style="color: ${colors[state] || '#aaa'};">${text}</div>`;
  }

  resetDropZone(dropZone) {
    if (!dropZone) return;
    
    dropZone.style.borderColor = '#666';
    dropZone.innerHTML = `
      <div>
        <div style="margin-bottom: 4px;">📁 Drop image here</div>
        <div style="font-size: 9px; opacity: 0.7;">or click to browse</div>
      </div>
    `;
  }

  updateFileLabels(node, file) {
    // Update any visible current file labels
    const fileLabels = document.querySelectorAll('.current-file');
    fileLabels.forEach(label => {
      const panel = label.closest('.param-panel');
      if (panel && panel._currentNode === node) {
        label.textContent = `✓ ${file.name}`;
        label.style.color = '#5cb85c';
      }
    });
  }

  triggerFileLoadUpdates(node) {
    // Update node preview
    if (window.editor?.previewIntegration) {
      window.editor.previewIntegration.generateNodePreview(node);
      window.editor.draw();
    }
    
    // Trigger shader rebuild
    if (this.onChange) {
      console.log('Triggering shader rebuild...');
      this.onChange();
    }
  }
}