import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFormula, checkConservation, balance, formatFormula, formatEquation } from '../js/equation.js';

test('parseFormula 支持括号、结晶水、电荷', () => {
  assert.deepEqual(parseFormula('Ca(OH)2'), { atoms: { Ca: 1, O: 2, H: 2 }, charge: 0 });
  assert.deepEqual(parseFormula('CuSO4·5H2O').atoms, { Cu: 1, S: 1, O: 9, H: 10 });
  assert.deepEqual(parseFormula('SO4^2-'), { atoms: { S: 1, O: 4 }, charge: -2 });
  assert.equal(parseFormula('H^+').charge, 1);
  assert.deepEqual(parseFormula('H2SO4_conc').atoms, { H: 2, S: 1, O: 4 });
});

test('checkConservation 和 balance', () => {
  const eq = {
    reactants: [{ formula: 'BaCl2', n: 1 }, { formula: 'H2SO4', n: 1 }],
    products: [{ formula: 'BaSO4', n: 1 }, { formula: 'HCl', n: 2 }],
  };
  assert.equal(checkConservation(eq).ok, true);
  assert.deepEqual(balance(['Fe', 'O2'], ['Fe3O4']), [3, 2, 1]);
  assert.deepEqual(balance(['Ba^2+', 'SO4^2-'], ['BaSO4']), [1, 1, 1]);
});

test('格式化', () => {
  assert.equal(formatFormula('SO4^2-'), 'SO₄²⁻');
  assert.equal(formatFormula('Ca(OH)2'), 'Ca(OH)₂');
  assert.equal(formatFormula('CuSO4·5H2O'), 'CuSO₄·5H₂O');
  assert.equal(formatEquation({
    reactants: [{ formula: 'BaCl2', n: 1 }, { formula: 'H2SO4', n: 1 }],
    products: [{ formula: 'BaSO4', n: 1, mark: '↓' }, { formula: 'HCl', n: 2 }],
    condition: '',
  }), 'BaCl₂ + H₂SO₄ = BaSO₄↓ + 2HCl');
});
