// src/core/utils/PreviewComputerAdapter.js
// Adapter to integrate existing PreviewComputer with new PreviewSystem

import { PreviewComputer } from '../PreviewComputer.js';

export class PreviewComputerAdapter {
  constructor() {
    this.previewComputer = new PreviewComputer();
    this.nodeToInputMap = new Map(); // Cache for connection mapping
  }

  computeNodeValue(node, graph) {
    // Use the existing PreviewComputer logic but adapt the data structure
    if (!graph) {
      console.warn('No graph provided for node computation');
      return this.getDefaultValue(node);
    }

    // Update the node's inputs array based on connections (if needed)
    this.updateNodeInputs(node, graph);
    
    // Use existing computation logic
    try {
      // Create a mini-graph with just this node and its dependencies
      const subGraph = this.createSubGraph(node, graph);
      this.previewComputer.computePreviews(subGraph);
      
      return node.__preview || this.getDefaultValue(node);
    } catch (error) {
      console.warn('Node computation failed:', node.kind, error);
      return this.getDefaultValue(node);
    }
  }

  updateNodeInputs(node, graph) {
    if (!graph.connections) return;
    
    // Reset inputs array
    const def = this.getNodeDefinition(node);
    node.inputs = new Array(def?.inputs || 0).fill(null);
    
    // Fill inputs based on connections
    for (const conn of graph.connections) {
      if (conn.to.nodeId === node.id) {
        const sourceNode = graph.nodes.find(n => n.id === conn.from.nodeId);
        if (sourceNode && conn.to.pin < node.inputs.length) {
          node.inputs[conn.to.pin] = sourceNode.id;
        }
      }
    }
  }

  createSubGraph(targetNode, fullGraph) {
    const visited = new Set();
    const nodes = [];
    
    const addNodeAndDependencies = (node) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      
      // Add dependencies first
      if (node.inputs) {
        for (const inputId of node.inputs) {
          if (inputId) {
            const inputNode = fullGraph.nodes.find(n => n.id === inputId);
            if (inputNode) {
              addNodeAndDependencies(inputNode);
            }
          }
        }
      }
      
      nodes.push(node);
    };
    
    addNodeAndDependencies(targetNode);
    
    return { nodes, connections: fullGraph.connections };
  }

  getDefaultValue(node) {
    switch (node.kind?.toLowerCase()) {
      case 'constfloat':
      case 'float':
        return node.value || 0;
      case 'constvec2':
      case 'vec2':
        return [node.x || 0, node.y || 0];
      case 'constvec3':
      case 'vec3':
        return [node.x || 0, node.y || 0, node.z || 0];
      case 'time':
        return (Date.now() / 1000) % 1;
      case 'uv':
        return [0.5, 0.5];
      case 'circlefield':
      case 'circle':
        return { 
          type: 'circle', 
          radius: node.props?.radius || 0.25, 
          epsilon: node.props?.epsilon || 0.02 
        };
      default:
        return 0;
    }
  }

  getNodeDefinition(node) {
    // This would normally come from NodeDefs, but we'll provide a simplified version
    const definitions = {
      'constfloat': { inputs: 0 },
      'float': { inputs: 0 },
      'constvec2': { inputs: 0 },
      'vec2': { inputs: 0 },
      'constvec3': { inputs: 0 },
      'vec3': { inputs: 0 },
      'multiply': { inputs: 2 },
      'add': { inputs: 2 },
      'subtract': { inputs: 2 },
      'divide': { inputs: 2 },
      'dot': { inputs: 2 },
      'cross': { inputs: 2 },
      'normalize': { inputs: 1 },
      'length': { inputs: 1 },
      'distance': { inputs: 2 },
      'reflect': { inputs: 2 },
      'refract': { inputs: 3 },
      'circlefield': { inputs: 2 },
      'circle': { inputs: 2 },
      'expr': { inputs: 2 },
      'saturate': { inputs: 1 },
      'uv': { inputs: 0 },
      'time': { inputs: 0 },
      'texture2d': { inputs: 1 },
      'texturecube': { inputs: 1 },
      'output': { inputs: 1 },
      'outputfinal': { inputs: 1 }
    };
    
    return definitions[node.kind?.toLowerCase()] || { inputs: 0 };
  }
}