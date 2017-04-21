var root = document.body;
const state = {
  func1: {func: 'x + a'},
  func2: {func: '1 - x'},
  blendFunc: {func: 'x'},
  env: {},
};

function saveState() {
  localStorage.setItem('funfunState', JSON.stringify(state));
}

function evaluateFnToPoly(fn, minX, maxX, steps, width, height) {
  var points = [];
  for (var step = 0; step <= steps; step++) {
    var p = (step / steps);
    var x = minX + (maxX - minX) * p;
    var y = fn(x);
    points.push(`${p * width},${(1.0 - y) * height}`);
  }
  return points;
}

function funcEditor(func, title) {
  let error = null;
  try {
    new Function(func.func);
  } catch (e) {
    error = e;
  }

  return m('div.func' + (error ? '.error' : ''), [
    m('h1', title),
    m('input', {
      value: func.func,
      oninput: (e) => {
        func.func = e.target.value;
        saveState();
      }
    }),
    (error ? m('div', error.toString()) : null),
  ]);
}

function symEditor(state, symbol) {
  const handleChange = (e) => {
    state.env[symbol] = parseFloat(e.target.value);
    saveState();
  };
  const value = state.env[symbol] || 0;
  return m('div.sym', {key: symbol}, [
    m('h2', symbol),
    m('div', [
      m('input', {type: 'number', value, oninput: handleChange}),
      m('input', {type: 'range', value, min: 0, max: 1, step: 0.001, oninput: handleChange}),
    ]),
  ]);
}

const reserved = new Set(['x', 'cos', 'sin', 'sqrt', 'alpha']);


function extractSymbols(symbols, func) {
  const symbolRe = /[a-z_]+/g;
  let match;
  while (match = symbolRe.exec(func)) {
    const sym = match[0];
    if (!reserved.has(sym)) {
      symbols.add(sym);
    }
  }
}

function constructFunction(symbols, state) {
  const finalFuncBody = `
const sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt;
const alpha = Math.min(1, Math.max(0, ${state.blendFunc.func}));
return (${state.func1.func}) * (1 - alpha) + (${state.func2.func}) * (alpha);
`.trim();
  const paramNameList = ['x'].concat(symbols);
  const extraParamValues = symbols.map((symbol) => state.env[symbol] || 0);
  const userFunc = new Function(paramNameList.join(','), finalFuncBody);
  const func = (x) => userFunc.apply(null, [x].concat(extraParamValues));
  func.body = finalFuncBody;
  const paramList = `x, ${symbols.map((p, i) => `${p} = ${extraParamValues[i]}`).join(', ')}`;
  func.full = `(${paramList}) => {\n  ${finalFuncBody.replace(/\n/g, '\n  ')}\n}`;
  return func;
}
var app = {
  view: function () {
    const symSet = new Set();
    [state.func1, state.func2, state.blendFunc].forEach((func) => extractSymbols(symSet, func.func));
    const symbols = Array.from(symSet).sort();
    let func, error, points = [];
    try {
      func = constructFunction(symbols, state);
    } catch (e) {
      error = e;
    }
    if (!error) {
      try {
        points = evaluateFnToPoly(func, 0, 1, 50, 800, 600);
      } catch (e) {
        error = e.toString();
      }
    }
    return m('main', [
        m('div#panel', [
          funcEditor(state.func1, 'f1'),
          funcEditor(state.func2, 'f2'),
          funcEditor(state.blendFunc, 'blend'),
          m('div', symbols.map((symbol) => symEditor(state, symbol))),
        ]),
        m('div#graph', [
          m(
            'svg',
            {width: 800, height: 600, style: 'border: 1px solid black'},
            [
              m('polyline', {fill: 'none', stroke: 'black', points})
            ]
          ),
          (error ? m('div', error.toString()) : null),
          (func ? m('pre', func.full) : null),
        ]),
      ]
    )
  }
};
try {
  Object.assign(state, JSON.parse(localStorage.getItem('funfunState') || '{}'));
} catch (e) {
  console.error('Unable to parse state', e);
}
m.mount(root, app);
