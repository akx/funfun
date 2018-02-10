const state = {
  func1: { func: 'x + a' },
  func2: { func: '1 - x' },
  blendFunc: { func: 'x' },
  env: {},
};

function saveState() {
  localStorage.setItem('funfunState', JSON.stringify(state));
}

function evaluateFnToPoly(fn, minX, maxX, steps, width, height) {
  const points = [];
  for (let step = 0; step <= steps; step += 1) {
    const p = (step / steps);
    const x = minX + (maxX - minX) * p;
    const y = fn(x);
    if (Number.isFinite(y)) {
      points.push(`${p * width},${(1.0 - y) * height}`);
    }
  }
  return points;
}

function funcEditor(func, title) {
  let error = null;
  try {
    new Function(func.func); // eslint-disable-line no-new
  } catch (e) {
    error = e;
  }

  return m(`div.func${error ? '.error' : ''}`, [
    m('h1', title),
    m('input', {
      value: func.func,
      oninput: (e) => {
        func.func = e.target.value; // eslint-disable-line no-param-reassign
        saveState();
      },
    }),
    (error ? m('div', error.toString()) : null),
  ]);
}

function symEditor(state, symbol) {
  const handleChange = (e) => {
    state.env[symbol] = parseFloat(e.target.value); // eslint-disable-line no-param-reassign
    saveState();
  };
  const value = state.env[symbol] || 0;
  return m('div.sym', { key: symbol }, [
    m('h2', symbol),
    m('div', [
      m('input', { type: 'number', value, oninput: handleChange }),
      m('input', {
        type: 'range', value, min: 0, max: 1, step: 0.001, oninput: handleChange,
      }),
    ]),
  ]);
}

const shorthands = {
  cos: 'Math.cos',
  sin: 'Math.sin',
  sqrt: 'Math.sqrt',
  pi: 'Math.PI',
};

const reserved = new Set(Object.keys(shorthands).concat(['x', 'alpha']));

function extractSymbols(symbols, func) {
  const symbolRe = /[a-z_]+/ig;
  let match;
  while (match = symbolRe.exec(func)) { // eslint-disable-line no-cond-assign
    symbols.add(match[0]);
  }
}

function constructFunction(allSymbols, editableSymbols, state) {
  const shorthandDefinitions = allSymbols.filter(symbol => shorthands[symbol]).map(symbol => `${symbol} = ${shorthands[symbol]}`);
  const blendFunc = state.blendFunc.func;
  const f1 = state.func1.func;
  const f2 = state.func2.func;
  const finalFuncLines = [];
  if (shorthandDefinitions.length) {
    finalFuncLines.push(`const ${shorthandDefinitions.join(', ')};`);
  }
  let alphaLine = false;
  if (/^[-+*/.0-9]+$/.test(blendFunc)) {
    alphaLine = `const alpha = ${Math.min(1, Math.max(0, eval(blendFunc)))};`; // eslint-disable-line no-eval
  } else if (state.blendFunc.func) {
    alphaLine = `const alpha = Math.min(1, Math.max(0, ${state.blendFunc.func}));`;
  }
  if (f1 && f2 && alphaLine) {
    finalFuncLines.push(alphaLine);
    finalFuncLines.push(`return (${f1}) * (1 - alpha) + (${f2}) * (alpha);`);
  } else if (f1) {
    finalFuncLines.push(`return ${f1};`);
  } else if (f2) {
    finalFuncLines.push(`return ${f2};`);
  } else {
    finalFuncLines.push('return 0;');
  }
  const finalFuncBody = finalFuncLines.join('\n').trim();
  const argNameList = ['x'].concat(editableSymbols);
  const extraArgValues = editableSymbols.map(symbol => state.env[symbol] || 0);
  const symbolsWithValues = editableSymbols.map((p, i) => `${p} = ${extraArgValues[i]}`);
  const paramList = ['x'].concat(symbolsWithValues).join(', ');

  const userFunc = new Function(argNameList.join(','), finalFuncBody);
  const func = x => userFunc.apply(null, [x].concat(extraArgValues)); // eslint-disable-line prefer-spread
  func.body = finalFuncBody;
  func.full = `(${paramList}) => {\n  ${finalFuncBody.replace(/\n/g, '\n  ')}\n}`;
  return func;
}
const app = {
  view() {
    const symSet = new Set();
    [state.func1, state.func2, state.blendFunc].forEach(func => extractSymbols(symSet, func.func));
    const allSymbols = Array.from(symSet).sort();
    const editableSymbols = allSymbols.filter(symbol => !reserved.has(symbol));
    let func;
    let error;
    let points = [];
    try {
      func = constructFunction(allSymbols, editableSymbols, state);
    } catch (e) {
      error = e;
    }
    if (!error) {
      try {
        points = evaluateFnToPoly(func, 0, 1, 100, 800, 600);
      } catch (e) {
        error = e.toString();
      }
    }
    return m('main', [
      m('div#panel', [
        funcEditor(state.func1, 'f1'),
        funcEditor(state.func2, 'f2'),
        funcEditor(state.blendFunc, 'blend'),
        m('div', editableSymbols.map(symbol => symEditor(state, symbol))),
      ]),
      m('div#graph', [
        m(
          'svg',
          { width: 800, height: 600, style: 'border: 1px solid black' },
          [
            m('polyline', { fill: 'none', stroke: 'black', points }),
          ]
        ),
        (error ? m('div', error.toString()) : null),
        (func ? m('pre', func.full) : null),
      ]),
    ]);
  },
};

try {
  Object.assign(state, JSON.parse(localStorage.getItem('funfunState') || '{}'));
} catch (e) {
  console.error('Unable to parse state', e);
}

m.mount(document.body, app);
