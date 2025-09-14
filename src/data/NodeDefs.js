let _nextId = 1;
// src/data/NodeDefs.js
export const NodeDefs = {
  OutputFinal: { 
    label: 'Output', cat: 'Output', inputs: 1, 
    pinsIn: ['color'], pinsOut: [],
    params: [] 
  },
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
// Basic Math
Sin: { 
  label: 'Sin', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'v', type: 'f32' }], 
  params: [] 
},
Cos: { 
  label: 'Cos', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'v', type: 'f32' }], 
  params: [] 
},
Floor: { 
  label: 'Floor', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'v', type: 'f32' }], 
  params: [] 
},
Fract: { 
  label: 'Fract', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'v', type: 'f32' }], 
  params: [] 
},
Abs: { 
  label: 'Abs', cat: 'Math', inputs: 1, 
  pinsIn: ['In'], pinsOut: [{ label: 'v', type: 'f32' }], 
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