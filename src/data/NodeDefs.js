let _nextId = 1;
// src/data/NodeDefs.js
export const NodeDefs = {
  OutputFinal: { 
    label: 'Output', cat: 'Output', inputs: 1, 
    pinsIn: ['color'], pinsOut: [],
    params: [] 
  },
  // Add these to your NodeDefs.js object
Random: {
  inputs: 1,
  outputs: 1,
  params: [
    { name: 'seed', label: 'Seed', type: 'float', default: 1.0 },
    { name: 'scale', label: 'Scale', type: 'float', default: 1.0 }
  ],
  create: (id) => ({
    id: id,
    type: 'Random',
    kind: 'Random',
    x: 0, y: 0, w: 160, h: 80,
    inputs: [null],
    outputs: [],
    props: {
      seed: 1.0,
      scale: 1.0
    }
  })
},

ValueNoise: {
  inputs: 1,
  outputs: 1,
  params: [
    { name: 'scale', label: 'Scale', type: 'float', default: 5.0 },
    { name: 'amplitude', label: 'Amplitude', type: 'float', default: 1.0 },
    { name: 'offset', label: 'Offset', type: 'float', default: 0.0 },
    { name: 'power', label: 'Power', type: 'float', default: 1.0 }
  ],
  create: (id) => ({
    id: id,
    type: 'ValueNoise',
    kind: 'ValueNoise',
    x: 0, y: 0, w: 180, h: 100,
    inputs: [null],
    outputs: [],
    props: {
      scale: 5.0,
      amplitude: 1.0,
      offset: 0.0,
      power: 1.0
    }
  })
},

FBMNoise: {
  inputs: 1,
  outputs: 1,
  params: [
    { name: 'scale', label: 'Scale', type: 'float', default: 3.0 },
    { name: 'octaves', label: 'Octaves', type: 'int', default: 4 },
    { name: 'persistence', label: 'Persistence', type: 'float', default: 0.5 },
    { name: 'lacunarity', label: 'Lacunarity', type: 'float', default: 2.0 },
    { name: 'amplitude', label: 'Amplitude', type: 'float', default: 1.0 },
    { name: 'offset', label: 'Offset', type: 'float', default: 0.0 },
    { name: 'gain', label: 'Gain', type: 'float', default: 0.5 },
    { name: 'warp', label: 'Warp', type: 'float', default: 0.0 }
  ],
  create: (id) => ({
    id: id,
    type: 'FBMNoise',
    kind: 'FBMNoise',
    x: 0, y: 0, w: 200, h: 140,
    inputs: [null],
    outputs: [],
    props: {
      scale: 3.0,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      amplitude: 1.0,
      offset: 0.0,
      gain: 0.5,
      warp: 0.0
    }
  })
},

SimplexNoise: {
  inputs: 1,
  outputs: 1,
  params: [
    { name: 'scale', label: 'Scale', type: 'float', default: 4.0 },
    { name: 'amplitude', label: 'Amplitude', type: 'float', default: 1.0 },
    { name: 'offset', label: 'Offset', type: 'float', default: 0.0 },
    { name: 'ridge', label: 'Ridge Mode', type: 'bool', default: false },
    { name: 'turbulence', label: 'Turbulence', type: 'bool', default: false }
  ],
  create: (id) => ({
    id: id,
    type: 'SimplexNoise',
    kind: 'SimplexNoise',
    x: 0, y: 0, w: 180, h: 100,
    inputs: [null],
    outputs: [],
    props: {
      scale: 4.0,
      amplitude: 1.0,
      offset: 0.0,
      ridge: false,
      turbulence: false
    }
  })
},

VoronoiNoise: {
  inputs: 1,
  outputs: 1,
  params: [
    { name: 'scale', label: 'Scale', type: 'float', default: 8.0 },
    { name: 'randomness', label: 'Randomness', type: 'float', default: 1.0 },
    { name: 'minkowskiP', label: 'Distance Type', type: 'float', default: 2.0 },
    { name: 'smoothness', label: 'Smoothness', type: 'float', default: 0.0 },
    { name: 'cellType', label: 'Cell Type', type: 'int', default: 0 },
    { name: 'outputType', label: 'Output Type', type: 'int', default: 0 }
  ],
  create: (id) => ({
    id: id,
    type: 'VoronoiNoise',
    kind: 'VoronoiNoise',
    x: 0, y: 0, w: 200, h: 120,
    inputs: [null],
    outputs: [],
    props: {
      scale: 8.0,
      randomness: 1.0,
      minkowskiP: 2.0,
      smoothness: 0.0,
      cellType: 0,
      outputType: 0
    }
  })
},

RidgedNoise: {
  inputs: 1,
  outputs: 1,
  params: [
    { name: 'scale', label: 'Scale', type: 'float', default: 4.0 },
    { name: 'octaves', label: 'Octaves', type: 'int', default: 6 },
    { name: 'lacunarity', label: 'Lacunarity', type: 'float', default: 2.0 },
    { name: 'gain', label: 'Gain', type: 'float', default: 0.5 },
    { name: 'amplitude', label: 'Amplitude', type: 'float', default: 1.0 },
    { name: 'offset', label: 'Offset', type: 'float', default: 1.0 },
    { name: 'threshold', label: 'Threshold', type: 'float', default: 0.0 }
  ],
  create: (id) => ({
    id: id,
    type: 'RidgedNoise',
    kind: 'RidgedNoise',
    x: 0, y: 0, w: 200, h: 120,
    inputs: [null],
    outputs: [],
    props: {
      scale: 4.0,
      octaves: 6,
      lacunarity: 2.0,
      gain: 0.5,
      amplitude: 1.0,
      offset: 1.0,
      threshold: 0.0
    }
  })
},

WarpNoise: {
  inputs: 1,
  outputs: 1,
  params: [
    { name: 'scale', label: 'Scale', type: 'float', default: 3.0 },
    { name: 'warpScale', label: 'Warp Scale', type: 'float', default: 2.0 },
    { name: 'warpStrength', label: 'Warp Strength', type: 'float', default: 0.1 },
    { name: 'octaves', label: 'Octaves', type: 'int', default: 3 },
    { name: 'amplitude', label: 'Amplitude', type: 'float', default: 1.0 }
  ],
  create: (id) => ({
    id: id,
    type: 'WarpNoise',
    kind: 'WarpNoise',
    x: 0, y: 0, w: 200, h: 120,
    inputs: [null],
    outputs: [],
    props: {
      scale: 3.0,
      warpScale: 2.0,
      warpStrength: 0.1,
      octaves: 3,
      amplitude: 1.0
    }
  })
}
,
  ConstFloat: { 
    label: 'Float', cat: 'Input', inputs: 0, 
    pinsIn: [], pinsOut: [{ label: 'v', type: 'f32' }], 
    params: [
      { name: 'value', type: 'float', default: 0.0, label: 'Value' }
    ]
  },
  ConstVec2: { 
    label: 'Vec2', cat: 'Input', inputs: 0, 
    pinsIn: [], pinsOut: [{ label: 'v', type: 'vec2' }], 
    params: [
      { name: 'x', type: 'float', default: 0.0, label: 'X' },
      { name: 'y', type: 'float', default: 0.0, label: 'Y' }
    ]
  },
  UV: { 
    label: 'UV', cat: 'Input', inputs: 0, 
    pinsIn: [], pinsOut: [{ label: 'uv', type: 'vec2' }],
    params: []
  },
  Time: { 
    label: 'Time', cat: 'Input', inputs: 0, 
    pinsIn: [], pinsOut: [{ label: 't', type: 'f32' }],
    params: []
  },
  CircleField: { 
    label: 'Circle', cat: 'Field', inputs: 2, 
    pinsIn: ['R','E'], pinsOut: [{ label: 'f', type: 'f32' }],
    params: [
      { name: 'radius', type: 'float', default: 0.25, label: 'Radius' },
      { name: 'epsilon', type: 'float', default: 0.01, label: 'Epsilon' }
    ]
  },
  Multiply: { 
    label: 'Multiply', cat: 'Math', inputs: 2, 
    pinsIn: ['A','B'], pinsOut: [{ label: 'v', type: 'vec3' }],
    params: []
  },
  Add: { 
    label: 'Add', cat: 'Math', inputs: 2, 
    pinsIn: ['A','B'], pinsOut: [{ label: 'v', type: 'vec3' }],
    params: []
  },
  Expr: { 
    label: 'Expr', cat: 'Utility', inputs: 2, 
    pinsIn: ['a','b'], pinsOut: [{ label: 'f', type: 'f32' }], 
    params: [
      { name: 'expr', type: 'expression', default: 'a', label: 'Expression' }
    ]
  },
  Saturate: { 
    label: 'Saturate', cat: 'Math', inputs: 1, 
    pinsIn: ['In'], pinsOut: [{ label: 'v', type: 'vec3' }],
    params: []
  },
//  Math
// Add these math nodes to your NodeDefs.js

// Basic Math Functions
Sin: { 
  label: 'Sin', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Cos: { 
  label: 'Cos', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Tan: { 
  label: 'Tan', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Floor: { 
  label: 'Floor', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Fract: { 
  label: 'Fract', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Abs: { 
  label: 'Abs', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Sqrt: { 
  label: 'Sqrt', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Pow: { 
  label: 'Power', cat: 'Math', inputs: 2, 
  pinsIn: ['Base', 'Exp'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Min: { 
  label: 'Min', cat: 'Math', inputs: 2, 
  pinsIn: ['A', 'B'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Max: { 
  label: 'Max', cat: 'Math', inputs: 2, 
  pinsIn: ['A', 'B'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Clamp: { 
  label: 'Clamp', cat: 'Math', inputs: 3, 
  pinsIn: ['Value', 'Min', 'Max'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Smoothstep: { 
  label: 'Smoothstep', cat: 'Math', inputs: 3, 
  pinsIn: ['Edge0', 'Edge1', 'X'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Step: { 
  label: 'Step', cat: 'Math', inputs: 2, 
  pinsIn: ['Edge', 'X'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Subtract: { 
  label: 'Subtract', cat: 'Math', inputs: 2, 
  pinsIn: ['A', 'B'], pinsOut: [{ label: 'out', type: 'vec3' }], 
  params: [] 
},
Divide: { 
  label: 'Divide', cat: 'Math', inputs: 2, 
  pinsIn: ['A', 'B'], pinsOut: [{ label: 'out', type: 'vec3' }], 
  params: [] 
},

// Vector Math
Length: { 
  label: 'Length', cat: 'Math', inputs: 1, 
  pinsIn: ['Vec'], pinsOut: [{ label: 'len', type: 'f32' }], 
  params: [] 
},
Distance: { 
  label: 'Distance', cat: 'Math', inputs: 2, 
  pinsIn: ['A', 'B'], pinsOut: [{ label: 'dist', type: 'f32' }], 
  params: [] 
},
Dot: { 
  label: 'Dot', cat: 'Math', inputs: 2, 
  pinsIn: ['A', 'B'], pinsOut: [{ label: 'dot', type: 'f32' }], 
  params: [] 
},
Normalize: { 
  label: 'Normalize', cat: 'Math', inputs: 1, 
  pinsIn: ['Vec'], pinsOut: [{ label: 'norm', type: 'vec3' }], 
  params: [] 
},

// Advanced Math
Mix: { 
  label: 'Mix', cat: 'Math', inputs: 3, 
  pinsIn: ['A', 'B', 'T'], pinsOut: [{ label: 'out', type: 'vec3' }], 
  params: [] 
},
Sign: { 
  label: 'Sign', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},
Mod: { 
  label: 'Mod', cat: 'Math', inputs: 2, 
  pinsIn: ['A', 'B'], pinsOut: [{ label: 'out', type: 'f32' }], 
  params: [] 
},

// Vector
ConstVec3: { 
  label: 'Vec3', cat: 'Input', inputs: 0, 
  pinsIn: [], pinsOut: [{ label: 'v', type: 'vec3' }], 
  params: [
    { name: 'x', type: 'float', default: 0.0, label: 'X' },
    { name: 'y', type: 'float', default: 0.0, label: 'Y' },
    { name: 'z', type: 'float', default: 0.0, label: 'Z' }
  ]
},
Split3: { 
  label: 'Split3', cat: 'Utility', inputs: 1, 
  pinsIn: ['In'], pinsOut: [
    { label: 'x', type: 'f32' }, 
    { label: 'y', type: 'f32' }, 
    { label: 'z', type: 'f32' }
  ], 
  params: [] 
},
Combine3: { 
  label: 'Combine3', cat: 'Utility', inputs: 3, 
  pinsIn: ['X', 'Y', 'Z'], pinsOut: [{ label: 'v', type: 'vec3' }], 
  params: [] 
},

// Interpolation
Mix: { 
  label: 'Mix', cat: 'Math', inputs: 3, 
  pinsIn: ['A', 'B', 'T'], pinsOut: [{ label: 'v', type: 'vec3' }], 
  params: [] 
},
Step: { 
  label: 'Step', cat: 'Math', inputs: 2, 
  pinsIn: ['Edge', 'In'], pinsOut: [{ label: 'v', type: 'f32' }], 
  params: [] 
}
};

export function makeNode(kind, x = 0, y = 0) {
  const def = NodeDefs[kind];
  if (!def) throw new Error(`Unknown node kind: ${kind}`);
  
  const node = {
    id: String(_nextId++),
    kind,
    x, y, w: 180, h: Math.max(60, 40 + (def.inputs||0)*18),
    inputs: new Array(def.inputs).fill(null),
    params: {},
    expr: def.params?.find(p => p.name === 'expr') ? 'a' : undefined,
    value: def.params?.find(p => p.name === 'value')?.default ?? undefined
  };
  
  // Initialize all parameter defaults
  if (def.params) {
    for (const param of def.params) {
      if (param.name === 'value') {
        node.value = param.default;
      } else if (param.name === 'x') {
        node.x = param.default;
      } else if (param.name === 'y') {
        node.y = param.default;
      } else if (param.name === 'expr') {
        node.expr = param.default;
      } else {
        if (!node.props) node.props = {};
        node.props[param.name] = param.default;
      }
    }
  }

  return node;
}