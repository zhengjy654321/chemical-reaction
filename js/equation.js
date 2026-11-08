// 化学式解析、守恒检查、配平、格式化（B 负责）。约定见 CONTRACT.md 第 5 节。

// 解析化学式，支持括号、结晶水（· 或 *）和电荷后缀（^2+、^-）。
export function parseFormula(formula) {
  let f = String(formula).replace(/_\w+$/, '');
  let charge = 0;
  const m = f.match(/\^(\d*)([+-])$/);
  if (m) {
    charge = (m[1] ? Number(m[1]) : 1) * (m[2] === '+' ? 1 : -1);
    f = f.slice(0, m.index);
  }
  const atoms = {};
  for (const part of f.split(/[·*]/)) {
    const pm = part.match(/^(\d+)(.*)$/);
    const mult = pm ? Number(pm[1]) : 1;
    const body = pm ? pm[2] : part;
    const [a, end] = parseGroup(body, 0);
    if (end !== body.length) throw new Error(`无法解析化学式: ${formula}`);
    for (const [el, n] of Object.entries(a)) atoms[el] = (atoms[el] || 0) + n * mult;
  }
  return { atoms, charge };
}

function parseGroup(s, i) {
  const atoms = {};
  const add = (el, n) => { atoms[el] = (atoms[el] || 0) + n; };
  while (i < s.length && s[i] !== ')') {
    let sub;
    if (s[i] === '(') {
      const [inner, j] = parseGroup(s, i + 1);
      if (s[j] !== ')') throw new Error(`括号不匹配: ${s}`);
      i = j + 1;
      sub = inner;
    } else {
      const em = s.slice(i).match(/^[A-Z][a-z]?/);
      if (!em) break;
      i += em[0].length;
      sub = { [em[0]]: 1 };
    }
    const nm = s.slice(i).match(/^\d+/);
    const n = nm ? Number(nm[0]) : 1;
    if (nm) i += nm[0].length;
    for (const [el, k] of Object.entries(sub)) add(el, k * n);
  }
  return [atoms, i];
}

function sumSide(terms) {
  const atoms = {};
  let charge = 0;
  for (const t of terms) {
    const p = parseFormula(t.formula);
    for (const [el, n] of Object.entries(p.atoms)) atoms[el] = (atoms[el] || 0) + n * t.n;
    charge += p.charge * t.n;
  }
  return { atoms, charge };
}

export function checkConservation(eq) {
  const l = sumSide(eq.reactants);
  const r = sumSide(eq.products);
  const atoms = {};
  for (const el of new Set([...Object.keys(l.atoms), ...Object.keys(r.atoms)])) {
    const d = (r.atoms[el] || 0) - (l.atoms[el] || 0);
    if (d !== 0) atoms[el] = d;
  }
  const charge = r.charge - l.charge;
  return { ok: Object.keys(atoms).length === 0 && charge === 0, atoms, charge };
}

// 暴力搜索最小整数系数（系数 1..max）。物质多于 6 种时 B 可换成矩阵法。
export function balance(reactants, products, max = 12) {
  const all = [...reactants, ...products];
  const parsed = all.map(parseFormula);
  const k = all.length;
  const coefs = new Array(k).fill(1);
  const els = [...new Set(parsed.flatMap(p => Object.keys(p.atoms)))];
  const ok = () => {
    let ch = 0;
    for (let i = 0; i < k; i++) ch += (i < reactants.length ? -1 : 1) * coefs[i] * parsed[i].charge;
    if (ch !== 0) return false;
    return els.every(el => {
      let s = 0;
      for (let i = 0; i < k; i++) s += (i < reactants.length ? -1 : 1) * coefs[i] * (parsed[i].atoms[el] || 0);
      return s === 0;
    });
  };
  for (;;) {
    if (ok()) return coefs.slice();
    let i = 0;
    while (i < k && coefs[i] === max) { coefs[i] = 1; i++; }
    if (i === k) return null;
    coefs[i]++;
  }
}

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };

export function formatFormula(formula) {
  let f = String(formula).replace(/_\w+$/, '');
  let sup = '';
  const m = f.match(/\^(\d*[+-])$/);
  if (m) { sup = [...m[1]].map(c => SUP[c]).join(''); f = f.slice(0, m.index); }
  // 结晶水前的系数不下标：CuSO4·5H2O
  f = f.replace(/([A-Za-z)])(\d+)/g, (_, a, d) => a + [...d].map(c => SUB[c]).join(''));
  return f + sup;
}

function formatTerm(t) {
  const n = t.n === 1 ? '' : String(t.n);
  const note = t.note ? `(${t.note})` : '';
  return n + formatFormula(t.formula) + note + (t.mark || '');
}

export function formatEquation(eq) {
  const l = eq.reactants.map(formatTerm).join(' + ');
  const r = eq.products.map(formatTerm).join(' + ');
  const cond = /^[A-Z]/.test(eq.condition || '') ? formatFormula(eq.condition) : eq.condition;
  const arrow = cond ? ` =${cond}= ` : ' = ';
  return l + arrow + r;
}
