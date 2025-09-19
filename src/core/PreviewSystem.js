// PreviewSystem.js - Complete working preview system

export class PreviewSystem {
  constructor(editor) {
    this.editor = editor;
    this.canvasCache = new Map();
    this.size = 48;
  }

  // Generate preview for a single node
generateNodePreview(node) {
  console.log('Generating preview for:', node.kind, node.kind.toLowerCase()); 

  if (!this.editor.isPreviewEnabled) {
    node.__thumb = null;
    return;
  }

  try {
    const canvas = this.getCanvas(node.id);
    const ctx = canvas.getContext('2d');
    
    // Clear
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, this.size, this.size);
    
    // Route to specific renderer
    switch (node.kind.toLowerCase()) {
      case 'constfloat':
      case 'float':
        this.renderFloat(ctx, node);
        break;
      case 'multiply':
        this.renderMath(ctx, node, '×', '#f59e0b');
        break;
      case 'add':
        this.renderMath(ctx, node, '+', '#60a5fa');
        break;
      case 'subtract':
        this.renderMath(ctx, node, '−', '#f87171');
        break;
      case 'divide':
        this.renderMath(ctx, node, '÷', '#a78bfa');
        break;
      case 'circle':
      case 'circlefield':
        this.renderCircle(ctx, node);
        break;
      case 'uv':
        this.renderUV(ctx, node);
        break;
      case 'time':
        this.renderTime(ctx, node);
        break;
      case 'expr':
        this.renderExpression(ctx, node);
        break;
      case 'saturate':
        this.renderSaturate(ctx, node);
        break;
      case 'output':
      case 'outputfinal':
        this.renderOutput(ctx, node);
        break;
      case 'random':
        this.renderRandom(ctx, node);
        break;
      case 'valuenoise':
        this.renderValueNoise(ctx, node);
        break;
      case 'fbmnoise':
        this.renderFBMNoise(ctx, node);
        break;
      case 'simplexnoise':
        this.renderSimplexNoise(ctx, node);
        break;
      case 'voronoinoise':
        this.renderVoronoiNoise(ctx, node);
        break;
      default:
        this.renderGeneric(ctx, node);
    }
    
    node.__thumb = canvas;
    
  } catch (error) {
    console.warn('Preview failed:', node.kind, error);
    // Fix: Get canvas and ctx for error rendering
    const canvas = this.getCanvas(node.id);
    const ctx = canvas.getContext('2d');
    this.renderError(ctx, node);
    node.__thumb = canvas;
  }
}

renderRandom(ctx, node) {
  // Static noise pattern
  for (let y = 0; y < this.size; y++) {
    for (let x = 0; x < this.size; x++) {
      const noise = Math.random();
      const color = Math.floor(noise * 255);
      ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

renderValueNoise(ctx, node) {
  const scale = node.props?.scale ?? 5.0;
  
  for (let y = 0; y < this.size; y++) {
    for (let x = 0; x < this.size; x++) {
      const u = (x / this.size) * scale;
      const v = (y / this.size) * scale;
      
      // Simple value noise approximation
      const noise = this.simpleNoise(u, v);
      const color = Math.floor((noise * 0.5 + 0.5) * 255);
      ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

renderFBMNoise(ctx, node) {
  const scale = node.props?.scale ?? 3.0;
  const octaves = node.props?.octaves ?? 4;
  
  for (let y = 0; y < this.size; y++) {
    for (let x = 0; x < this.size; x++) {
      const u = (x / this.size) * scale;
      const v = (y / this.size) * scale;
      
      let noise = 0;
      let amplitude = 1;
      let frequency = 1;
      let maxValue = 0;
      
      for (let i = 0; i < octaves; i++) {
        noise += this.simpleNoise(u * frequency, v * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      
      noise /= maxValue;
      const color = Math.floor((noise * 0.5 + 0.5) * 255);
      ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

renderSimplexNoise(ctx, node) {
  const scale = node.props?.scale ?? 4.0;
  
  for (let y = 0; y < this.size; y++) {
    for (let x = 0; x < this.size; x++) {
      const u = (x / this.size) * scale;
      const v = (y / this.size) * scale;
      
      // Simplified simplex-style noise
      const noise = this.simpleNoise(u * 1.5, v * 1.5) * 0.7 + this.simpleNoise(u * 3, v * 3) * 0.3;
      const color = Math.floor((noise * 0.5 + 0.5) * 255);
      ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
renderRidgedNoise(ctx, node) {
  const scale = node.props?.scale ?? 4.0;
  const octaves = node.props?.octaves ?? 6;
  
  for (let y = 0; y < this.size; y++) {
    for (let x = 0; x < this.size; x++) {
      const u = (x / this.size) * scale;
      const v = (y / this.size) * scale;
      
      let noise = 0;
      let amplitude = 1;
      let frequency = 1;
      
      for (let i = 0; i < octaves; i++) {
        let n = this.simpleNoise(u * frequency, v * frequency);
        n = Math.abs(n); // Ridge effect
        n = 1.0 - n;
        noise += n * amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      
      const color = Math.floor(Math.min(noise, 1.0) * 255);
      ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

renderWarpNoise(ctx, node) {
  const scale = node.props?.scale ?? 3.0;
  const warpStrength = node.props?.warpStrength ?? 0.1;
  
  for (let y = 0; y < this.size; y++) {
    for (let x = 0; x < this.size; x++) {
      const u = (x / this.size) * scale;
      const v = (y / this.size) * scale;
      
      // Simple warp
      const warpX = this.simpleNoise(u * 2, v * 2) * warpStrength;
      const warpY = this.simpleNoise(u * 2 + 5.2, v * 2 + 1.3) * warpStrength;
      
      const noise = this.simpleNoise(u + warpX, v + warpY);
      const color = Math.floor((noise * 0.5 + 0.5) * 255);
      ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}
renderVoronoiNoise(ctx, node) {
  const scale = node.props?.scale ?? 8.0;
  
  for (let y = 0; y < this.size; y++) {
    for (let x = 0; x < this.size; x++) {
      const u = (x / this.size) * scale;
      const v = (y / this.size) * scale;
      
      // Simple Voronoi cell approximation
      const cellX = Math.floor(u);
      const cellY = Math.floor(v);
      
      let minDist = 999;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const pointX = cellX + dx + this.pseudoRandom(cellX + dx, cellY + dy);
          const pointY = cellY + dy + this.pseudoRandom(cellX + dx + 1, cellY + dy + 1);
          
          const dist = Math.sqrt((u - pointX) ** 2 + (v - pointY) ** 2);
          minDist = Math.min(minDist, dist);
        }
      }
      
      const color = Math.floor((1.0 - Math.min(minDist, 1.0)) * 255);
      ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// Helper methods for noise generation
simpleNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  
  const a = this.hash2D(ix, iy);
  const b = this.hash2D(ix + 1, iy);
  const c = this.hash2D(ix, iy + 1);
  const d = this.hash2D(ix + 1, iy + 1);
  
  const u = fx * fx * (3.0 - 2.0 * fx);
  const v = fy * fy * (3.0 - 2.0 * fy);
  
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

hash2D(x, y) {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (h - Math.floor(h)) * 2 - 1; // Range -1 to 1
}
pseudoRandom(x, y) {
  return ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) * 0.5;
}
  // Update all previews
  updateAllPreviews() {
    if (!this.editor.graph?.nodes) return;
    
    this.editor.graph.nodes.forEach(node => {
      this.generateNodePreview(node);
    });
    
    this.editor.draw();
  }

  // Render float value
renderFloat(ctx, node) {
  const value = this.getParameter(node, 'value') || 0;
  
  // Ensure value is a number
  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  
  // Background color based on value
  const intensity = Math.min(0.8, Math.abs(numValue) / 10);
  const hue = numValue >= 0 ? 120 : 0;
  
  ctx.fillStyle = `hsl(${hue}, 60%, ${10 + intensity * 30}%)`;
  ctx.fillRect(0, 0, this.size, this.size);
  
  // Value text
  ctx.fillStyle = `hsl(${hue}, 80%, 80%)`;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const text = Math.abs(numValue) < 0.01 ? 
    numValue.toExponential(1) : 
    numValue.toFixed(2);
  
  ctx.fillText(text, this.size/2, this.size/2);
  
  // Grid
  ctx.strokeStyle = `hsl(${hue}, 40%, 40%)`;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < this.size; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i, this.size);
    ctx.moveTo(0, i); ctx.lineTo(this.size, i);
    ctx.stroke();
  }
}
  // Render math operations

renderMath(ctx, node, symbol, color) {
  // Get actual computed value for this node
  const computedResult = this.computeNodeValue(node);
  
  // Get actual input values - handle different input pin naming conventions
  const inputs = this.getConnectedInputs(node);
  console.log(`${node.kind} inputs:`, inputs); 
  
  let a, b;
  
  switch (node.kind.toLowerCase()) {
    case 'divide':
    case 'subtract':
      a = inputs.a !== undefined ? inputs.a : 1;
      b = inputs.b !== undefined ? inputs.b : 1;
      break;
    case 'multiply':
    case 'add':
      a = inputs.a !== undefined ? inputs.a : 1;
      b = inputs.b !== undefined ? inputs.b : 1;
      break;
    default:
      a = inputs.a !== undefined ? inputs.a : 1;
      b = inputs.b !== undefined ? inputs.b : 1;
  }
  
  console.log(`${node.kind} final values - a:${a}, b:${b}, result:${computedResult}`);
  
  // Background
  ctx.fillStyle = color + '20';
  ctx.fillRect(0, 0, this.size, this.size);
  
  // Symbol
  ctx.fillStyle = color;
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(symbol, this.size/2, this.size/2 - 4);
  
  // Result - use the computed result, not a manual calculation
  ctx.font = '8px monospace';
  const resultText = Math.abs(computedResult) < 0.01 ? 
    computedResult.toExponential(1) : 
    computedResult.toFixed(2);
  ctx.fillText(resultText, this.size/2, this.size/2 + 12);
  
  // Inputs
  ctx.font = '6px monospace';
  ctx.textAlign = 'left';
  const aText = Math.abs(a) < 0.01 ? a.toExponential(1) : a.toFixed(2);
  const bText = Math.abs(b) < 0.01 ? b.toExponential(1) : b.toFixed(2);
  ctx.fillText(`A:${aText}`, 2, 10);
  ctx.fillText(`B:${bText}`, 2, 18);
}

// Replace the renderCircle function in PreviewSystem.js with this:

renderCircle(ctx, node) {
  // Simple approach: always check BOTH sources and use whichever is available
  const inputs = this.getConnectedInputs(node);
  
  // For radius: use connected input if available, otherwise use node parameter
  let radius = 0.25;
  if (inputs.a !== undefined) {
    radius = inputs.a;  // Connected Float node wins
  } else if (node.props?.radius !== undefined) {
    radius = node.props.radius;  // Direct parameter as fallback
  }
  
  // For epsilon: same logic
  let epsilon = 0.02;
  if (inputs.b !== undefined) {
    epsilon = inputs.b;  // Connected Float node wins
  } else if (node.props?.epsilon !== undefined) {
    epsilon = node.props.epsilon;  // Direct parameter as fallback
  }
  
  console.log('Circle preview - radius:', radius, 'epsilon:', epsilon, 'hasInputs:', !!inputs.a, !!inputs.b);
  
  // Rest of the rendering code stays the same
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, this.size, this.size);
  
  for (let y = 0; y < this.size; y++) {
    for (let x = 0; x < this.size; x++) {
      const u = x / this.size;
      const v = y / this.size;
      const dist = Math.sqrt((u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5));
      const safeEpsilon = Math.max(epsilon, 0.0001);
      const field = 1.0 - this.smoothstep(radius - safeEpsilon, radius + safeEpsilon, dist);
      
      if (field > 0.01) {
        const intensity = Math.max(0, Math.min(1, field));
        const color = Math.floor(intensity * 255);
        ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

// Add this smoothstep function to PreviewSystem class if it doesn't exist:
smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(0.0001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

  // Render UV coordinates
  renderUV(ctx, node) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const u = x / this.size;
        const v = y / this.size;
        const r = Math.floor(u * 255);
        const g = Math.floor(v * 255);
        ctx.fillStyle = `rgb(${r}, ${g}, 128)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    
    // Grid lines
    ctx.strokeStyle = '#ffffff80';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.size/2, 0);
    ctx.lineTo(this.size/2, this.size);
    ctx.moveTo(0, this.size/2);
    ctx.lineTo(this.size, this.size/2);
    ctx.stroke();
  }

  // Render time node
  renderTime(ctx, node) {
    const time = (Date.now() / 1000) % (Math.PI * 2);
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, this.size, this.size);
    
    // Sine wave
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let x = 0; x < this.size; x++) {
      const t = (x / this.size) * Math.PI * 2;
      const y = this.size/2 + Math.sin(t + time) * this.size * 0.3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Time indicator
    const indicatorX = (time / (Math.PI * 2)) * this.size;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(indicatorX, this.size/2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Render expression
// Replace the renderExpression function in PreviewSystem.js with this:
// Replace the renderExpression function in PreviewSystem.js with this:
// Replace the renderExpression function in PreviewSystem.js with this:

// Replace the renderExpression function in PreviewSystem.js with this:

// Replace the renderExpression function in PreviewSystem.js with this:

// Replace the renderExpression function in PreviewSystem.js with this:

// Replace the renderExpression function in PreviewSystem.js with this:

renderExpression(ctx, node) {
  const expr = this.getParameter(node, 'expr') || node.expr || 'x';
  
  console.log('Expression preview - expr:', expr);
  
  ctx.fillStyle = '#0c1821';
  ctx.fillRect(0, 0, this.size, this.size);
  
  // Plot expression
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  let hasValidPlot = false;
  let firstPoint = true;
  
  for (let x = 0; x < this.size; x++) {
    try {
      // Convert pixel x to mathematical domain
      const mathX = (x / this.size) * 4 - 2; // Range: -2 to +2
      
      // Get connected inputs if any
      const inputs = this.getConnectedInputs(node);
      const a = inputs.a !== undefined ? inputs.a : mathX; // Use connected input or x-position
      const b = inputs.b !== undefined ? inputs.b : 0;
      
      // Create evaluation context with scaled time for better visualization
      const variables = {
        x: mathX,
        a: a,
        b: b,
        t: (Date.now() / 1000) % (Math.PI * 2), 
        u_time: mathX * 10 + (Date.now() / 1000), // Use mathX as fake time progression + real time
        pi: Math.PI,
        PI: Math.PI
      };
      
      const result = this.evaluateExpression(expr, variables);
      
      // Debug logging
      if (x === 0 || x === 15 || x === 31) {
        console.log(`x=${x}, mathX=${mathX}, a=${a}, result=${result}`);
      }
      
      if (typeof result === 'number' && isFinite(result)) {
        // For expressions like "a + sin(u_time*0.8)*0.05"
        // The sine part varies, but it's tiny compared to the base value
        
        // Extract just the varying part by subtracting the base 'a' value
        const variationFromBase = result - a;  // This isolates the sin(u_time*0.8)*0.05 part
        
        // Amplify the variation dramatically and center it on screen
        const amplifiedY = this.size/2 - (variationFromBase * 1000);  // 1000x amplification
        const clampedY = Math.max(0, Math.min(this.size - 1, amplifiedY));
        
        if (firstPoint) {
          ctx.moveTo(x, clampedY);
          firstPoint = false;
        } else {
          ctx.lineTo(x, clampedY);
        }
        hasValidPlot = true;
      }
    } catch (e) {
      console.warn('Expression evaluation failed at x=', x, ':', e);
      // Skip invalid points but continue plotting
    }
  }
  
  if (hasValidPlot) {
    ctx.stroke();
  } else {
    // If no valid plot, show error indicator
    ctx.fillStyle = '#ff4444';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ERR', this.size/2, this.size/2);
  }
  
  // Expression text (smaller and at bottom)
  ctx.fillStyle = '#10b981';
  ctx.font = '6px monospace';
  ctx.textAlign = 'left';
  const displayExpr = expr.length > 10 ? expr.substring(0, 10) + '...' : expr;
  ctx.fillText(displayExpr, 2, this.size - 2);
}

// Also improve the evaluateExpression method:
evaluateExpression(expr, vars) {
  try {
    let processed = expr.toString();
    
    // Replace variables first
    for (const [name, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      processed = processed.replace(regex, `(${value})`);
    }
    
    // Replace mathematical functions
    processed = processed.replace(/\bsin\b/g, 'Math.sin');
    processed = processed.replace(/\bcos\b/g, 'Math.cos'); 
    processed = processed.replace(/\btan\b/g, 'Math.tan');
    processed = processed.replace(/\babs\b/g, 'Math.abs');
    processed = processed.replace(/\bfloor\b/g, 'Math.floor');
    processed = processed.replace(/\bceil\b/g, 'Math.ceil');
    processed = processed.replace(/\bsqrt\b/g, 'Math.sqrt');
    processed = processed.replace(/\bpow\b/g, 'Math.pow');
    processed = processed.replace(/\bmin\b/g, 'Math.min');
    processed = processed.replace(/\bmax\b/g, 'Math.max');
    processed = processed.replace(/\bpi\b/g, 'Math.PI');
    processed = processed.replace(/\bPI\b/g, 'Math.PI');
    
    console.log('Evaluating:', processed);
    const result = eval(processed);
    return isFinite(result) ? result : 0;
  } catch (e) {
    console.warn('Expression evaluation error:', e);
    return 0;
  }
}
// Also improve the evaluateExpression method:
evaluateExpression(expr, vars) {
  try {
    let processed = expr.toString();
    
    // Replace variables first
    for (const [name, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      processed = processed.replace(regex, `(${value})`);
    }
    
    // Replace mathematical functions
    processed = processed.replace(/\bsin\b/g, 'Math.sin');
    processed = processed.replace(/\bcos\b/g, 'Math.cos'); 
    processed = processed.replace(/\btan\b/g, 'Math.tan');
    processed = processed.replace(/\babs\b/g, 'Math.abs');
    processed = processed.replace(/\bfloor\b/g, 'Math.floor');
    processed = processed.replace(/\bceil\b/g, 'Math.ceil');
    processed = processed.replace(/\bsqrt\b/g, 'Math.sqrt');
    processed = processed.replace(/\bpow\b/g, 'Math.pow');
    processed = processed.replace(/\bmin\b/g, 'Math.min');
    processed = processed.replace(/\bmax\b/g, 'Math.max');
    processed = processed.replace(/\bpi\b/g, 'Math.PI');
    processed = processed.replace(/\bPI\b/g, 'Math.PI');
    
    console.log('Evaluating:', processed);
    const result = eval(processed);
    return isFinite(result) ? result : 0;
  } catch (e) {
    console.warn('Expression evaluation error:', e);
    return 0;
  }
}
// Also improve the evaluateExpression method:
evaluateExpression(expr, vars) {
  try {
    let processed = expr.toString();
    
    // Replace variables first
    for (const [name, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      processed = processed.replace(regex, `(${value})`);
    }
    
    // Replace mathematical functions
    processed = processed.replace(/\bsin\b/g, 'Math.sin');
    processed = processed.replace(/\bcos\b/g, 'Math.cos'); 
    processed = processed.replace(/\btan\b/g, 'Math.tan');
    processed = processed.replace(/\babs\b/g, 'Math.abs');
    processed = processed.replace(/\bfloor\b/g, 'Math.floor');
    processed = processed.replace(/\bceil\b/g, 'Math.ceil');
    processed = processed.replace(/\bsqrt\b/g, 'Math.sqrt');
    processed = processed.replace(/\bpow\b/g, 'Math.pow');
    processed = processed.replace(/\bmin\b/g, 'Math.min');
    processed = processed.replace(/\bmax\b/g, 'Math.max');
    processed = processed.replace(/\bpi\b/g, 'Math.PI');
    processed = processed.replace(/\bPI\b/g, 'Math.PI');
    
    console.log('Evaluating:', processed);
    const result = eval(processed);
    return isFinite(result) ? result : 0;
  } catch (e) {
    console.warn('Expression evaluation error:', e);
    return 0;
  }
}

// Also improve the evaluateExpression method:
evaluateExpression(expr, vars) {
  try {
    let processed = expr.toString();
    
    // Replace variables first
    for (const [name, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      processed = processed.replace(regex, `(${value})`);
    }
    
    // Replace mathematical functions
    processed = processed.replace(/\bsin\b/g, 'Math.sin');
    processed = processed.replace(/\bcos\b/g, 'Math.cos'); 
    processed = processed.replace(/\btan\b/g, 'Math.tan');
    processed = processed.replace(/\babs\b/g, 'Math.abs');
    processed = processed.replace(/\bfloor\b/g, 'Math.floor');
    processed = processed.replace(/\bceil\b/g, 'Math.ceil');
    processed = processed.replace(/\bsqrt\b/g, 'Math.sqrt');
    processed = processed.replace(/\bpow\b/g, 'Math.pow');
    processed = processed.replace(/\bmin\b/g, 'Math.min');
    processed = processed.replace(/\bmax\b/g, 'Math.max');
    processed = processed.replace(/\bpi\b/g, 'Math.PI');
    processed = processed.replace(/\bPI\b/g, 'Math.PI');
    
    console.log('Evaluating:', processed);
    const result = eval(processed);
    return isFinite(result) ? result : 0;
  } catch (e) {
    console.warn('Expression evaluation error:', e);
    return 0;
  }
}
// Also improve the evaluateExpression method:
evaluateExpression(expr, vars) {
  try {
    let processed = expr.toString();
    
    // Replace variables first
    for (const [name, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      processed = processed.replace(regex, `(${value})`);
    }
    
    // Replace mathematical functions
    processed = processed.replace(/\bsin\b/g, 'Math.sin');
    processed = processed.replace(/\bcos\b/g, 'Math.cos'); 
    processed = processed.replace(/\btan\b/g, 'Math.tan');
    processed = processed.replace(/\babs\b/g, 'Math.abs');
    processed = processed.replace(/\bfloor\b/g, 'Math.floor');
    processed = processed.replace(/\bceil\b/g, 'Math.ceil');
    processed = processed.replace(/\bsqrt\b/g, 'Math.sqrt');
    processed = processed.replace(/\bpow\b/g, 'Math.pow');
    processed = processed.replace(/\bmin\b/g, 'Math.min');
    processed = processed.replace(/\bmax\b/g, 'Math.max');
    processed = processed.replace(/\bpi\b/g, 'Math.PI');
    processed = processed.replace(/\bPI\b/g, 'Math.PI');
    
    console.log('Evaluating:', processed);
    const result = eval(processed);
    return isFinite(result) ? result : 0;
  } catch (e) {
    console.warn('Expression evaluation error:', e);
    return 0;
  }
}

// Also improve the evaluateExpression method:
evaluateExpression(expr, vars) {
  try {
    let processed = expr.toString();
    
    // Replace variables first
    for (const [name, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      processed = processed.replace(regex, `(${value})`);
    }
    
    // Replace mathematical functions
    processed = processed.replace(/\bsin\b/g, 'Math.sin');
    processed = processed.replace(/\bcos\b/g, 'Math.cos'); 
    processed = processed.replace(/\btan\b/g, 'Math.tan');
    processed = processed.replace(/\babs\b/g, 'Math.abs');
    processed = processed.replace(/\bfloor\b/g, 'Math.floor');
    processed = processed.replace(/\bceil\b/g, 'Math.ceil');
    processed = processed.replace(/\bsqrt\b/g, 'Math.sqrt');
    processed = processed.replace(/\bpow\b/g, 'Math.pow');
    processed = processed.replace(/\bmin\b/g, 'Math.min');
    processed = processed.replace(/\bmax\b/g, 'Math.max');
    processed = processed.replace(/\bpi\b/g, 'Math.PI');
    processed = processed.replace(/\bPI\b/g, 'Math.PI');
    
    console.log('Evaluating:', processed);
    const result = eval(processed);
    return isFinite(result) ? result : 0;
  } catch (e) {
    console.warn('Expression evaluation error:', e);
    return 0;
  }
}


// Also improve the evaluateExpression method:
evaluateExpression(expr, vars) {
  try {
    let processed = expr.toString();
    
    // Replace variables first
    for (const [name, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      processed = processed.replace(regex, `(${value})`);
    }
    
    // Replace mathematical functions
    processed = processed.replace(/\bsin\b/g, 'Math.sin');
    processed = processed.replace(/\bcos\b/g, 'Math.cos'); 
    processed = processed.replace(/\btan\b/g, 'Math.tan');
    processed = processed.replace(/\babs\b/g, 'Math.abs');
    processed = processed.replace(/\bfloor\b/g, 'Math.floor');
    processed = processed.replace(/\bceil\b/g, 'Math.ceil');
    processed = processed.replace(/\bsqrt\b/g, 'Math.sqrt');
    processed = processed.replace(/\bpow\b/g, 'Math.pow');
    processed = processed.replace(/\bmin\b/g, 'Math.min');
    processed = processed.replace(/\bmax\b/g, 'Math.max');
    processed = processed.replace(/\bpi\b/g, 'Math.PI');
    processed = processed.replace(/\bPI\b/g, 'Math.PI');
    
    console.log('Evaluating:', processed);
    const result = eval(processed);
    return isFinite(result) ? result : 0;
  } catch (e) {
    console.warn('Expression evaluation error:', e);
    return 0;
  }
}
  // Render saturate
  renderSaturate(ctx, node) {
    const inputs = this.getConnectedInputs(node);
    const input = inputs.input || 0.5;
    const result = Math.max(0, Math.min(1, input));
    
    // Gradient showing saturation
    for (let x = 0; x < this.size; x++) {
      const testValue = (x / this.size) * 2 - 0.5;
      const saturated = Math.max(0, Math.min(1, testValue));
      const color = Math.floor(saturated * 255);
      ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
      ctx.fillRect(x, 0, 1, this.size);
    }
    
    // Input/output indicators
    const inputX = Math.floor((input + 0.5) * this.size / 2);
    const outputX = Math.floor(result * this.size);
    
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(inputX, this.size - 4, 1, 4);
    
    ctx.fillStyle = '#44ff44';
    ctx.fillRect(outputX, 0, 1, 4);
  }

  // Render output
  renderOutput(ctx, node) {
    const inputs = this.getConnectedInputs(node);
    const value = inputs.input || inputs.color || inputs.value || 0;
    
    if (typeof value === 'number') {
      const intensity = Math.max(0, Math.min(1, value));
      const color = Math.floor(intensity * 255);
      ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
      ctx.fillRect(0, 0, this.size, this.size);
    } else {
      this.renderGeneric(ctx, node);
    }
  }

  // Render generic node
  renderGeneric(ctx, node) {
    const hash = this.hashString(node.kind);
    const hue = hash % 360;
    
    ctx.fillStyle = `hsl(${hue}, 60%, 25%)`;
    ctx.fillRect(0, 0, this.size, this.size);
    
    ctx.fillStyle = `hsl(${hue}, 80%, 70%)`;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const label = node.kind.substring(0, 4);
    ctx.fillText(label, this.size/2, this.size/2);
  }

  // Render error state
  renderError(ctx, node) {
    ctx.fillStyle = '#2d1b1b';
    ctx.fillRect(0, 0, this.size, this.size);
    
    ctx.fillStyle = '#ff4444';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ERR', this.size/2, this.size/2);
  }

  // Helper methods
  getCanvas(nodeId) {
    if (!this.canvasCache.has(nodeId)) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = this.size;
      this.canvasCache.set(nodeId, canvas);
    }
    return this.canvasCache.get(nodeId);
  }

  getParameter(node, name) {
  return node[name] || node.props?.[name] || 0;
  }

// Replace both computeNodeValue and getConnectedInputs methods in PreviewSystem.js:

computeNodeValue(node, visited = new Set()) {
  // Prevent infinite recursion
  if (visited.has(node.id)) {
    console.warn(`Circular dependency detected for node ${node.kind} (${node.id})`);
    return 0;
  }
  visited.add(node.id);

  let result;
  
  switch (node.kind.toLowerCase()) {
    case 'constfloat':
    case 'float':
      result = this.getParameter(node, 'value') || 0;
      console.log(`computeNodeValue(${node.kind}[${node.id}]): ${result} (from parameter)`);
      break;
      
    case 'time':
      result = (Date.now() / 1000) % 1;
      console.log(`computeNodeValue(${node.kind}[${node.id}]): ${result} (time)`);
      break;
      
    case 'uv':
      result = 0.5;
      console.log(`computeNodeValue(${node.kind}[${node.id}]): ${result} (uv)`);
      break;
      
    case 'circle':
    case 'circlefield':
      result = this.getParameter(node, 'radius') || 0.5;
      console.log(`computeNodeValue(${node.kind}[${node.id}]): ${result} (circle)`);
      break;
      
    case 'multiply': {
      const inputs = this.getConnectedInputs(node, visited);
      const a = inputs.a !== undefined ? inputs.a : 1;
      const b = inputs.b !== undefined ? inputs.b : 1;
      result = a * b;
      console.log(`computeNodeValue MULTIPLY[${node.id}]: ${a} × ${b} = ${result}`);
      break;
    }
    
    case 'add': {
      const inputs = this.getConnectedInputs(node, visited);
      const a = inputs.a !== undefined ? inputs.a : 0;
      const b = inputs.b !== undefined ? inputs.b : 0;
      result = a + b;
      console.log(`computeNodeValue ADD[${node.id}]: ${a} + ${b} = ${result}`);
      break;
    }
    
    case 'divide': {
      const inputs = this.getConnectedInputs(node, visited);
      const a = inputs.a !== undefined ? inputs.a : 1;
      const b = inputs.b !== undefined ? inputs.b : 1;
      result = b !== 0 ? a / b : 0;
      console.log(`computeNodeValue DIVIDE[${node.id}]: ${a} ÷ ${b} = ${result}`);
      break;
    }
    
    case 'subtract': {
      const inputs = this.getConnectedInputs(node, visited);
      const a = inputs.a !== undefined ? inputs.a : 0;
      const b = inputs.b !== undefined ? inputs.b : 0;
      result = a - b;
      console.log(`computeNodeValue SUBTRACT[${node.id}]: ${a} - ${b} = ${result}`);
      break;
    }
    
    // Keep all your other cases here...
    case 'expr': {
      const inputs = this.getConnectedInputs(node, visited);
      const expr = this.getParameter(node, 'expr') || node.expr || 'a';
      const a = inputs.a || 0;
      const b = inputs.b || 0;
      const variables = {
        a: a,
        b: b,
        t: (Date.now() / 1000) % (Math.PI * 2),
        u_time: (Date.now() / 1000),
        pi: Math.PI,
        PI: Math.PI
      };
      result = this.evaluateExpression(expr, variables);
      console.log(`computeNodeValue EXPR[${node.id}]: ${result}`);
      break;
    }
    
    case 'saturate': {
      const inputs = this.getConnectedInputs(node, visited);
      const input = inputs.input || inputs.a || 0;
      result = Math.max(0, Math.min(1, input));
      console.log(`computeNodeValue SATURATE[${node.id}]: ${result}`);
      break;
    }
    
    default:
      result = 0;
      console.log(`computeNodeValue UNKNOWN[${node.id}] ${node.kind}: ${result}`);
  }
  
  visited.delete(node.id); // Remove from visited set when done
  return result;
}

getConnectedInputs(node, visited = new Set()) {
  const inputs = {};
  
  if (!this.editor.graph?.connections) return inputs;
  
  console.log(`\n=== Getting inputs for ${node.kind} (${node.id}) ===`);
  
  // Find connections to this node
  for (const conn of this.editor.graph.connections) {
    if (conn.to.nodeId === node.id) {
      const sourceNode = this.editor.graph.nodes.find(n => n.id === conn.from.nodeId);
      if (sourceNode) {
        // Pass the visited set to prevent circular dependencies
        const value = this.computeNodeValue(sourceNode, visited);
        const pinIndex = conn.to.pin;
        
        console.log(`Connection: ${sourceNode.kind}[${sourceNode.id}](${value}) -> ${node.kind}.pin[${pinIndex}]`);
        
        // Map pin index directly to expected input names
        let inputName;
        
        if (pinIndex === 0) {
          inputName = 'a';
        } else if (pinIndex === 1) {
          inputName = 'b'; 
        } else if (pinIndex === 2) {
          inputName = 'c';
        } else {
          inputName = `input${pinIndex}`;
        }
        
        inputs[inputName] = value;
        console.log(`  Mapped to: ${inputName} = ${value}`);
        
        // Add compatibility aliases
        if (pinIndex === 0) {
          inputs.input = value;
          inputs.value = value;
        }
      }
    }
  }
  
  console.log(`Final inputs for ${node.kind}[${node.id}]:`, inputs);
  return inputs;
}

  evaluateExpression(expr, vars) {
    // Simple expression evaluator
    try {
      let processed = expr;
      for (const [name, value] of Object.entries(vars)) {
        processed = processed.replace(new RegExp(`\\b${name}\\b`, 'g'), value);
      }
      processed = processed.replace(/sin/g, 'Math.sin');
      processed = processed.replace(/cos/g, 'Math.cos');
      processed = processed.replace(/pi/g, 'Math.PI');
      
      return eval(processed);
    } catch (e) {
      return 0;
    }
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
  }

  clearCache() {
    this.canvasCache.clear();
  }
}

// Integration code for Editor.js
export class PreviewIntegration {
  // Add this to PreviewIntegration class in PreviewSystem.js
updateParameterPanel() {
  // If parameter panel is open, refresh it to show current connected values
  if (window.parameterPanel && window.parameterPanel.currentNode) {
    const node = window.parameterPanel.currentNode;
    // Find all parameter inputs and update their values
    const inputs = window.parameterPanel.panel?.querySelectorAll('.param-input');
    inputs?.forEach(input => {
      const paramName = input.dataset.paramName;
      if (paramName) {
        const currentValue = window.parameterPanel._getNodeParameterValue(node, paramName, 0);
        if (input.value !== String(currentValue)) {
          input.value = String(currentValue);
        }
      }
    });
  }
}
  constructor(editor) {
    this.editor = editor;
    this.previewSystem = new PreviewSystem(editor);
    
    
    // Generate initial previews
    setTimeout(() => {
      if (this.editor.isPreviewEnabled) {
        this.updateAllPreviews();
      }
    }, 100);
    
    // Auto-update time-based nodes
    setInterval(() => {
      if (this.editor.isPreviewEnabled) {
        this.updateTimeNodes();
      }
    }, 100);
  }
  
  updateAllPreviews() {
    this.previewSystem.updateAllPreviews();
  }
  
  generateNodePreview(node) {
    this.previewSystem.generateNodePreview(node);
  }
  
  updateTimeNodes() {
    if (!this.editor.graph?.nodes) return;
    
    const timeNodes = this.editor.graph.nodes.filter(n => 
      n.kind.toLowerCase() === 'time'
    );
    
    if (timeNodes.length > 0) {
      timeNodes.forEach(node => this.previewSystem.generateNodePreview(node));
      this.editor.draw();
    }
  }
  
  onParameterChange(node) {
    this.generateNodePreview(node);
    // Update dependent nodes
    this.updateDependentNodes(node);
  }
  
  updateDependentNodes(changedNode) {
    if (!this.editor.graph?.connections) return;
    
    // Find nodes that depend on this one
    const dependents = this.editor.graph.connections
      .filter(conn => conn.from.nodeId === changedNode.id)
      .map(conn => conn.to.nodeId);
    
    // Update their previews
    dependents.forEach(nodeId => {
      const node = this.editor.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        this.generateNodePreview(node);
      }
    });
    
    this.editor.draw();
    this.updateParameterPanel();

  }
}

// Usage instructions:
// 1. Add to Editor.js constructor:
//    this.previewIntegration = new PreviewIntegration(this);
//
// 2. Add to ParameterPanel.js _updateNodeParameter:
//    if (window.editor?.previewIntegration) {
//      window.editor.previewIntegration.onParameterChange(node);
//    }
//
// 3. Renderer.js _renderNodeThumbnail already works with node.__thumb