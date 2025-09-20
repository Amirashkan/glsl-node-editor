// src/ui/ParameterPanel.js - Refactored with separated concerns
import { NodeDefs } from '../data/NodeDefs.js';
import { ParameterInputFactory } from './parameters/ParameterInputFactory.js';
import { ParameterHandler } from './parameters/ParameterHandler.js';

export class ParameterPanel {
  constructor(graph, onChange) {
    this.graph = graph;
    this.onChange = onChange;
    this.panel = null;
    this.currentNode = null;
    
    // Initialize components
    this.parameterHandler = new ParameterHandler(graph, onChange);
    this.inputFactory = new ParameterInputFactory(this.parameterHandler);
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
    
    if (!this.hasParameters(node)) {
      console.log('No parameters for this node type');
      return;
    }
    
    this.createPanel(node, clientX, clientY);
  }

  hasParameters(node) {
    const def = NodeDefs[node.kind];
    console.log('NodeDef found:', def);
    return def?.params && def.params.length > 0;
  }

  createPanel(node, clientX, clientY) {
    const def = NodeDefs[node.kind];
    console.log('Creating panel with', def.params.length, 'parameters');
    
    const panel = this.createPanelElement(clientX, clientY);
    
    // Add header
    panel.appendChild(this.createHeader(def.label));
    
    // Add parameter inputs
    for (const param of def.params) {
      const paramInput = this.inputFactory.createInput(param, node);
      panel.appendChild(paramInput);
    }
    
    // Add footer with close button
    panel.appendChild(this.createFooter());
    
    // Setup panel
    this.setupPanel(panel, node);
  }

  createPanelElement(clientX, clientY) {
    const panel = document.createElement('div');
    panel.className = 'param-panel';
    panel.style.position = 'fixed';
    panel.style.left = (clientX + 20) + 'px';
    panel.style.top = clientY + 'px';
    panel.style.zIndex = '1000';
    
    // Prevent event bubbling
    this.setupEventPrevention(panel);
    
    return panel;
  }

  createHeader(label) {
    const header = document.createElement('div');
    header.className = 'param-header';
    header.textContent = `${label} Parameters`;
    return header;
  }

  createFooter() {
    const buttons = document.createElement('div');
    buttons.className = 'param-buttons';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    
    buttons.appendChild(closeBtn);
    return buttons;
  }

  setupEventPrevention(panel) {
    // Prevent clicks and mousedown from bubbling up
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  setupPanel(panel, node) {
    document.body.appendChild(panel);
    this.panel = panel;
    this.currentNode = node;
    
    // Store reference for file label updates
    panel._currentNode = node;
    
    // Focus first input
    this.focusFirstInput(panel);
  }

  focusFirstInput(panel) {
    setTimeout(() => {
      const firstInput = panel.querySelector('.param-input');
      if (firstInput) {
        firstInput.focus();
      }
    }, 10);
  }
}