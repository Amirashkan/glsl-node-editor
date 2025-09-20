// src/core/renderers/NodeStyler.js
// Centralized styling decisions for node rendering

export class NodeStyler {
  constructor() {
    this.categoryColors = {
      'Input': '#10b981',    // Emerald
      'Math': '#f59e0b',     // Amber
      'Field': '#8b5cf6',    // Violet
      'Utility': '#06b6d4',  // Cyan
      'Output': '#ef4444',   // Red
      'Texture': '#9333ea',  // Purple
      'Noise': '#059669',    // Emerald
      'Vector': '#dc2626',   // Red
      'Misc': '#6b7280',     // Gray
      'default': '#6b7280'   // Gray
    };

    this.wireColors = {
      'f32': '#ffd166',      // Yellow for floats
      'vec2': '#40c9b4',     // Teal for vec2  
      'vec3': '#d06bff',     // Purple for vec3
      'vec4': '#ff6b9d',     // Pink for vec4
      'default': '#9aa0a6'   // Gray for default
    };

    this.nodeStyles = {
      normal: {
        background: ['#252525', '#1b1b1b'], // Gradient stops
        border: '#404040',
        borderWidth: 1
      },
      selected: {
        background: ['#252525', '#1b1b1b'],
        border: '#66aaff',
        borderWidth: 2,
        glow: {
          color: '#66aaff',
          blur: 8,
          innerGlow: 'rgba(102, 170, 255, 0.3)'
        }
      }
    };
  }

  getNodeStyle(isSelected) {
    return isSelected ? this.nodeStyles.selected : this.nodeStyles.normal;
  }

  getCategoryColor(category) {
    return this.categoryColors[category] || this.categoryColors.default;
  }

  getWireColor(type) {
    return this.wireColors[type] || this.wireColors.default;
  }

  getPinStyle(type, connected = false) {
    return {
      color: connected ? '#ff7a7a' : this.getWireColor(type),
      radius: 4,
      glowRadius: connected ? 6 : 0,
      glowColor: connected ? '#ff7a7a' : 'transparent'
    };
  }

  getOutputPinStyle(type) {
    return {
      color: this.getWireColor(type),
      radius: 5,
      glowRadius: 8,
      glowColor: this.getWireColor(type)
    };
  }

  getThumbnailStyle(size) {
    return {
      background: '#0a0a0a',
      border: '#333',
      borderWidth: 1,
      innerBorder: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 4,
      padding: 1
    };
  }

  getTextStyle(scale, type = 'default') {
    const baseSize = type === 'label' ? 12 : type === 'pin' ? 9 : 8;
    return {
      font: `${Math.max(8, baseSize / scale)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`,
      weight: type === 'label' ? '500' : 'normal',
      color: type === 'label' ? '#e8e8e8' : '#666'
    };
  }

  getControlButtonStyle(active, type) {
    const styles = {
      hide: {
        active: { bg: 'rgba(68, 68, 68, 0.3)', color: '#666', text: 'X' },
        inactive: { bg: 'rgba(255, 68, 68, 0.2)', color: '#ff4444', text: 'X' }
      },
      preview: {
        active: { bg: 'rgba(0, 255, 136, 0.2)', color: '#00ff88', text: '•' },
        inactive: { bg: 'rgba(68, 68, 68, 0.3)', color: '#666', text: '○' }
      },
      size: {
        enabled: { bg: 'rgba(68, 68, 68, 0.3)', color: '#888' },
        disabled: { bg: 'rgba(40, 40, 40, 0.3)', color: '#333' }
      }
    };

    return styles[type]?.[active ? 'active' : 'inactive'] || styles[type]?.enabled || {};
  }
}