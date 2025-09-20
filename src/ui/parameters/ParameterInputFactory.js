// src/ui/parameters/ParameterInputFactory.js
// Factory for creating different parameter input types

export class ParameterInputFactory {
  constructor(parameterHandler) {
    this.parameterHandler = parameterHandler;
  }

  createInput(param, node) {
    const factory = this.getInputFactory(param.type);
    return factory.create(param, node, this.parameterHandler);
  }

  getInputFactory(type) {
    switch (type) {
      case 'file':
        return new FileInputFactory();
      case 'select':
        return new SelectInputFactory();
      case 'float':
        return new NumericInputFactory();
      case 'expression':
        return new ExpressionInputFactory();
      default:
        return new TextInputFactory();
    }
  }
}

class BaseInputFactory {
  create(param, node, handler) {
    const div = this.createContainer();
    const label = this.createLabel(param.label);
    div.appendChild(label);
    
    const input = this.createInput(param, node, handler);
    div.appendChild(input);
    
    return div;
  }

  createContainer() {
    const div = document.createElement('div');
    div.className = 'param-input-group';
    return div;
  }

  createLabel(text) {
    const label = document.createElement('label');
    label.textContent = text;
    return label;
  }

  createBaseInput(param) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'param-input';
    input.dataset.paramName = param.name;
    input.dataset.paramType = param.type;
    input.style.cssText = this.getBaseInputStyles();
    input.placeholder = this.getPlaceholder(param);
    return input;
  }

  getBaseInputStyles() {
    return `
      width: 100%;
      padding: 6px;
      margin: 4px 0;
      background: #333;
      color: #fff;
      border: 1px solid #555;
      border-radius: 4px;
      font-size: 11px;
      box-sizing: border-box;
    `;
  }

  getPlaceholder(param) {
    return param.type === 'expression' ? 'Enter expression...' : `Default: ${param.default}`;
  }

  setupEventHandlers(input, param, node, handler) {
    // Prevent event bubbling
    input.addEventListener('click', (e) => e.stopPropagation());
    
    // Real-time updates
    input.addEventListener('input', (e) => {
      e.stopPropagation();
      handler.updateParameter(node, param.name, input.value.trim());
    });
  }
}

class TextInputFactory extends BaseInputFactory {
  createInput(param, node, handler) {
    const input = this.createBaseInput(param);
    
    // Set current value
    const currentValue = handler.getParameterValue(node, param.name, param.default);
    input.value = String(currentValue);
    
    // Check for connected inputs
    const hasConnectedInput = handler.hasConnectedInput(node, param.name);
    if (hasConnectedInput) {
      input.style.backgroundColor = '#2a4a2a';
      input.title = 'Connected to input - value reflects connected node';
    }
    
    this.setupEventHandlers(input, param, node, handler);
    return input;
  }
}

class NumericInputFactory extends TextInputFactory {
  createInput(param, node, handler) {
    const input = super.createInput(param, node, handler);
    this.addNumericDragSupport(input, param, node, handler);
    return input;
  }

  addNumericDragSupport(input, param, node, handler) {
    let isDragging = false;
    let startValue = 0;
    let startY = 0;
    
    input.addEventListener('mousedown', (e) => {
      if (e.button === 0 && e.shiftKey) {
        isDragging = true;
        startValue = parseFloat(input.value) || 0;
        startY = e.clientY;
        input.style.cursor = 'ns-resize';
        e.preventDefault();
        e.stopPropagation();
        
        const onMouseMove = (e) => {
          if (!isDragging) return;
          const deltaY = startY - e.clientY;
          const sensitivity = e.ctrlKey ? 0.001 : (e.altKey ? 0.1 : 0.01);
          const newValue = startValue + (deltaY * sensitivity);
          input.value = newValue.toFixed(3);
          handler.updateParameter(node, param.name, input.value);
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
    
    input.title = 'Shift+drag to adjust value\nCtrl: fine precision, Alt: coarse precision';
  }
}

class ExpressionInputFactory extends TextInputFactory {
  createInput(param, node, handler) {
    const input = super.createInput(param, node, handler);
    input.style.fontFamily = 'ui-monospace, Consolas, monospace';
    return input;
  }
}

class SelectInputFactory extends BaseInputFactory {
  createInput(param, node, handler) {
    const select = document.createElement('select');
    select.className = 'param-select';
    select.style.cssText = `
      width: 100%;
      padding: 6px;
      margin: 4px 0;
      background: #333;
      color: #fff;
      border: 1px solid #555;
      border-radius: 4px;
      font-size: 11px;
    `;
    
    // Add options
    for (const option of param.options) {
      const optionElement = document.createElement('option');
      optionElement.value = option;
      optionElement.textContent = option;
      select.appendChild(optionElement);
    }
    
    // Set current value
    const currentValue = handler.getParameterValue(node, param.name, param.default);
    select.value = currentValue;
    
    // Event handlers
    select.addEventListener('change', (e) => {
      e.stopPropagation();
      handler.updateParameter(node, param.name, select.value);
    });
    
    select.addEventListener('click', (e) => e.stopPropagation());
    
    return select;
  }
}

class FileInputFactory extends BaseInputFactory {
  createInput(param, node, handler) {
    const container = document.createElement('div');
    
    // Show current file if loaded
    this.addCurrentFileLabel(container, node);
    
    // Create file input and drop zone
    const fileInput = this.createFileInput(param);
    const dropZone = this.createDropZone();
    
    // Setup event handlers
    this.setupFileHandlers(fileInput, dropZone, param, node, handler);
    
    container.appendChild(dropZone);
    container.appendChild(fileInput);
    
    return container;
  }

  addCurrentFileLabel(container, node) {
    const textureInfo = window.textureManager?.getTexture(node.id);
    if (textureInfo && textureInfo.file) {
      const fileLabel = document.createElement('div');
      fileLabel.className = 'current-file';
      fileLabel.style.cssText = `
        font-size: 10px;
        color: #4a90e2;
        margin-bottom: 4px;
        font-style: italic;
      `;
      fileLabel.textContent = `✓ ${textureInfo.file.name}`;
      container.appendChild(fileLabel);
    }
  }

  createFileInput(param) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = param.accept || 'image/*';
    fileInput.style.display = 'none';
    return fileInput;
  }

  createDropZone() {
    const dropZone = document.createElement('div');
    dropZone.className = 'file-drop-zone';
    dropZone.style.cssText = `
      border: 2px dashed #666;
      border-radius: 6px;
      padding: 16px;
      text-align: center;
      color: #aaa;
      font-size: 11px;
      margin: 4px 0;
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(255,255,255,0.02);
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    dropZone.innerHTML = `
      <div>
        <div style="margin-bottom: 4px;">📁 Drop image here</div>
        <div style="font-size: 9px; opacity: 0.7;">or click to browse</div>
      </div>
    `;
    
    return dropZone;
  }

  setupFileHandlers(fileInput, dropZone, param, node, handler) {
    // Click to browse
    dropZone.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handler.handleFileLoad(node, file, dropZone);
      }
    });

    // Drag and drop
    this.setupDragAndDrop(dropZone, (file) => {
      handler.handleFileLoad(node, file, dropZone);
    });

    fileInput.addEventListener('click', (e) => e.stopPropagation());
  }

  setupDragAndDrop(dropZone, onFileDrop) {
    dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setDropZoneActive(dropZone, true);
    });
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dropZone.contains(e.relatedTarget)) {
        this.setDropZoneActive(dropZone, false);
      }
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setDropZoneActive(dropZone, false);
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          onFileDrop(file);
        } else {
          alert('Please drop an image file');
        }
      }
    });
  }

  setDropZoneActive(dropZone, active) {
    if (active) {
      dropZone.style.borderColor = '#4a90e2';
      dropZone.style.backgroundColor = 'rgba(74, 144, 226, 0.1)';
      dropZone.style.transform = 'scale(1.02)';
    } else {
      dropZone.style.borderColor = '#666';
      dropZone.style.backgroundColor = 'rgba(255,255,255,0.02)';
      dropZone.style.transform = 'scale(1)';
    }
  }
}