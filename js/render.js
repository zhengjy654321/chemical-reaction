// 渲染（C 负责）。render(app, root, handlers) 只读状态，不改状态。
import { formatFormula, formatEquation } from './equation.js';
import { DATA } from './data.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const CATEGORIES = [
  ['all', '全部'], ['acid', '酸'], ['base', '碱'], ['salt', '盐'], ['oxide', '氧化物'],
  ['metal', '金属'], ['nonmetal', '非金属'], ['organic', '有机物'], ['gas', '气体'], ['other', '其他'],
];
const FORM_LABEL = { aq: '溶液', s: '固体', l: '液体', g: '气体' };

export const AMOUNTS = [
  ['drop', '滴加 1 滴', 0.0005],
  ['little', '少量', 0.002],
  ['some', '适量', 0.01],
  ['excess', '过量', 0.05],
];

// ---------- 颜色 ----------
function hexToRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixColors(pairs) { // [[css, weight]]
  let r = 0, g = 0, b = 0, w = 0;
  for (const [css, wt] of pairs) {
    const c = hexToRgb(css);
    if (!c || wt <= 0) continue;
    r += c[0] * wt; g += c[1] * wt; b += c[2] * wt; w += wt;
  }
  if (!w) return null;
  return `rgb(${Math.round(r / w)},${Math.round(g / w)},${Math.round(b / w)})`;
}

function solutionColor(b) {
  const pairs = [];
  for (const [id, n] of Object.entries(b.ions)) {
    const ion = DATA.IONS[id];
    if (ion?.css) pairs.push([ion.css, n]);
  }
  for (const [id, n] of Object.entries(b.dissolved)) {
    const s = DATA.SUBSTANCES[id];
    if (s?.css) pairs.push([s.css, n]);
  }
  for (const [id, n] of Object.entries(b.liquids)) {
    if (id === 'H2O') continue;
    const s = DATA.SUBSTANCES[id];
    if (s?.css) pairs.push([s.css, n]);
  }
  return mixColors(pairs);
}

function solidColor(b) {
  const pairs = Object.entries(b.solids).map(([id, n]) => [DATA.SUBSTANCES[id]?.css || '#9ca3af', n]);
  return mixColors(pairs) || '#9ca3af';
}

// ---------- 名称 ----------
export function nameOf(id) {
  const s = DATA.SUBSTANCES[id] || DATA.IONS[id];
  return s?.name || id;
}
export function reagentLabel(s) {
  const form = FORM_LABEL[s.shelfForm] || '';
  if (s.shelfForm === 'aq' && /(酸|水|溶液)$/.test(s.name)) return s.name;
  if (s.shelfForm === 'g' && /气(体)?$/.test(s.name)) return s.name;
  return s.name + (form && s.shelfForm !== 'l' ? form : '');
}

// 能以固体形式加入的试剂（试剂架上默认是溶液，但常温是固体）
export const canBeSolid = s => s.state === 's' && s.shelfForm === 'aq';

const fmtMol = n => n >= 0.1 ? n.toFixed(2) + ' mol' : (n * 1000).toFixed(n < 0.001 ? 2 : 1) + ' mmol';

function volumeMl(b) {
  let v = 0;
  for (const [id, n] of Object.entries(b.liquids)) v += id === 'H2O' ? n * 18 : n * 50;
  return v;
}

// ---------- 烧杯图 ----------
function beakerSvg(b) {
  const ml = volumeMl(b);
  const hasLiquid = ml > 0.5 || Object.keys(b.ions).length || Object.keys(b.dissolved).length;
  const liqH = hasLiquid ? Math.min(88, Math.max(10, ml / 150 * 88)) : 0;
  const solidN = Object.values(b.solids).reduce((a, n) => a + n, 0);
  const solH = solidN > 0 ? Math.min(30, 4 + Math.sqrt(solidN) * 60) : 0;
  const color = solutionColor(b);
  const liqFill = color || '#dbeafe';
  const liqOpacity = color ? 0.75 : 0.55;
  const bottom = 108;
  const gases = Object.keys(b.gases).length > 0;
  const bubbles = gases && hasLiquid ? Array.from({ length: 7 }, (_, i) => {
    const x = 26 + (i * 37) % 50;
    const d = (i * 0.37) % 1.6;
    return `<circle class="bubble" cx="${x}" cy="${bottom - 4}" r="${1.5 + (i % 3)}" style="animation-delay:${d}s"/>`;
  }).join('') : '';
  const gasCloud = gases ? `<text x="50" y="9" text-anchor="middle" class="gas-label">${esc(Object.keys(b.gases).map(formatFormula).join(' ') + ' ↑')}</text>` : '';
  const flame = b.heated ? `
    <g class="flame">
      <path d="M50 113 C44 120 46 126 50 128 C54 126 56 120 50 113Z" fill="#f97316"/>
      <path d="M50 118 C47 122 48 126 50 127 C52 126 53 122 50 118Z" fill="#fde047"/>
    </g>` : '';
  const dots = solidN > 0 ? Array.from({ length: 10 }, (_, i) =>
    `<circle cx="${22 + (i * 23) % 56}" cy="${bottom - 1 - ((i * 7) % Math.max(2, solH - 2))}" r="1.3" fill="rgba(0,0,0,.18)"/>`).join('') : '';
  return `
  <svg viewBox="0 0 100 130" class="beaker-svg" aria-hidden="true">
    <defs><clipPath id="clip-${b.id}"><path d="M17 12 L17 103 Q17 110 24 110 L76 110 Q83 110 83 103 L83 12 Z"/></clipPath></defs>
    <g clip-path="url(#clip-${b.id})">
      ${hasLiquid ? `<rect x="0" y="${110 - liqH}" width="100" height="${liqH}" fill="${liqFill}" opacity="${liqOpacity}"/>` : ''}
      ${solH ? `<rect x="0" y="${110 - solH}" width="100" height="${solH}" fill="${solidColor(b)}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>${dots}` : ''}
      ${bubbles}
    </g>
    <path d="M12 10 L17 12 L17 103 Q17 110 24 110 L76 110 Q83 110 83 103 L83 12 L88 10" fill="none" class="glass"/>
    ${[30, 50, 70].map(y => `<line x1="17" x2="25" y1="${y}" y2="${y}" class="tick"/>`).join('')}
    ${gasCloud}
    ${flame}
  </svg>`;
}

function contents(b) {
  const rows = [];
  for (const [id, n] of Object.entries(b.liquids)) rows.push(id === 'H2O' ? `水 ${(n * 18).toFixed(0)} mL` : `${formatFormula(id)}(l) ${fmtMol(n)}`);
  for (const [id, n] of Object.entries(b.ions)) rows.push(`${formatFormula(id)} ${fmtMol(n)}`);
  for (const [id, n] of Object.entries(b.dissolved)) rows.push(`${formatFormula(id)}(aq) ${fmtMol(n)}`);
  for (const [id, n] of Object.entries(b.solids)) rows.push(`<b>${formatFormula(id)}</b>(s) ${fmtMol(n)}`);
  for (const [id] of Object.entries(b.gases)) rows.push(`${formatFormula(id)}(g)↑`);
  if (!rows.length) return '<li class="muted">空</li>';
  return rows.map(r => `<li>${r}</li>`).join('');
}

// ---------- 各区块 ----------
function beakersHtml(app) {
  return app.beakers.map(b => `
    <div class="beaker ${b.id === app.selected ? 'selected' : ''}" data-act="select" data-arg="${b.id}">
      <div class="beaker-head"><strong>${esc(b.label)}</strong>${b.heated ? '<span class="tag hot">加热中</span>' : ''}</div>
      ${beakerSvg(b)}
      <ul class="contents">${contents(b)}</ul>
    </div>`).join('') + `
    <div class="beaker add-card">
      <button data-act="newBeaker" data-arg="water">＋ 烧杯<br><small>50 mL 水</small></button>
      <button data-act="newBeaker" data-arg="empty">＋ 空试管<br><small>放固体</small></button>
    </div>`;
}

function shelfHtml(app) {
  const ui = app.ui;
  const all = Object.values(DATA.SUBSTANCES).filter(s => s.shelf);
  const inCat = (s, k) => k === 'all' || s.category === k || (k === 'gas' && s.shelfForm === 'g');
  const cats = CATEGORIES.filter(([k]) => all.some(s => inCat(s, k)));
  const q = (ui.search || '').trim().toLowerCase();
  const list = all.filter(s => inCat(s, ui.cat));
  return `
    <div class="chips">${cats.map(([k, t]) => `<button class="chip ${ui.cat === k ? 'on' : ''}" data-act="cat" data-arg="${k}">${t}</button>`).join('')}</div>
    <input id="search" type="search" placeholder="搜索名称或化学式" value="${esc(ui.search || '')}" autocomplete="off">
    <div class="shelf-list">
      ${list.map(s => {
        const key = (s.name + ' ' + s.formula + ' ' + s.id + ' ' + (s.note || '')).toLowerCase();
        const hide = q && !key.includes(q) ? ' hidden' : '';
        return `<button class="reagent ${ui.reagent === s.id ? 'on' : ''}" data-act="reagent" data-arg="${esc(s.id)}" data-key="${esc(key)}"${hide}>
          <span class="swatch" style="background:${s.css || 'transparent'}"></span>
          <span class="r-name">${esc(reagentLabel(s))}</span>
          <span class="r-formula">${formatFormula(s.formula)}${s.id.endsWith('_conc') ? '(浓)' : ''}</span>
        </button>`;
      }).join('') || '<div class="muted">没有试剂</div>'}
    </div>`;
}

function actionsHtml(app) {
  const b = app.beakers.find(x => x.id === app.selected);
  if (!b) return '<div class="muted">先点选或新建一个烧杯</div>';
  const r = DATA.SUBSTANCES[app.ui.reagent];
  const others = app.beakers.filter(x => x.id !== b.id);
  const solidMode = !!r && canBeSolid(r) && app.ui.form === 's';
  return `
    <div class="target">当前：<b>${esc(b.label)}</b>${r ? `　试剂：<b>${esc(reagentLabel(r))}</b> ${formatFormula(r.formula)}` : '　<span class="muted">（在下方选择试剂）</span>'}</div>
    ${r && canBeSolid(r) ? `<div class="row form-row"><span>形态</span>
      <button class="chip ${app.ui.form !== 's' ? 'on' : ''}" data-act="form" data-arg="aq">溶液</button>
      <button class="chip ${app.ui.form === 's' ? 'on' : ''}" data-act="form" data-arg="s">固体</button></div>` : ''}
    <div class="row">
      ${AMOUNTS.map(([k, t]) => `<button class="${k === 'drop' ? 'primary' : ''}" data-act="add" data-arg="${k}" ${r ? '' : 'disabled'}>${k === 'drop' && solidMode ? '一小粒' : t}</button>`).join('')}
    </div>
    <div class="row">
      <button data-act="heat" class="${b.heated ? 'hot' : ''}">${b.heated ? '停止加热' : '加热'}</button>
      <button data-act="ignite">点燃</button>
      <button data-act="filter">过滤</button>
      <button data-act="clear">清空</button>
      <button data-act="remove" class="danger">移除</button>
    </div>
    <div class="row">
      <span>倒入</span>
      <select id="pourTo" ${others.length ? '' : 'disabled'}>
        ${others.map(o => `<option value="${o.id}" ${o.id === app.ui.pourTo ? 'selected' : ''}>${esc(o.label)}</option>`).join('') || '<option>（没有其他烧杯）</option>'}
      </select>
      <button data-act="pour" data-arg="1" ${others.length ? '' : 'disabled'}>全部</button>
      <button data-act="pour" data-arg="0.5" ${others.length ? '' : 'disabled'}>一半</button>
    </div>`;
}

function logHtml(app) {
  if (!app.log.length) return '<div class="muted">还没有操作。选一个试剂，点“滴加”或“适量”加入烧杯。</div>';
  return app.log.slice().reverse().map(entry => `
    <div class="entry">
      <div class="op">${esc(entry.title)}</div>
      ${(entry.events || []).map(e => `
        <div class="ev">
          ${e.equation ? `<div class="eq">${esc(formatEquation(e.equation))}</div>` : ''}
          ${e.ionic ? `<div class="eq ionic"><span class="lbl">离子</span>${esc(formatEquation(e.ionic))}</div>` : ''}
          ${e.observations?.length ? `<div class="obs">现象：${esc(e.observations.join('；'))}</div>` : ''}
        </div>`).join('')}
      ${entry.note ? `<div class="obs">${esc(entry.note)}</div>` : ''}
    </div>`).join('');
}

export function render(app, root, handlers) {
  const keepScroll = root.querySelector('.shelf-list')?.scrollTop || 0;
  root.innerHTML = `
    <section class="bench">
      <div class="beakers">${beakersHtml(app)}</div>
    </section>
    <section class="panel">
      <div class="actions">${actionsHtml(app)}</div>
      <div class="shelf">${shelfHtml(app)}</div>
    </section>
    <section class="log">
      <div class="log-head"><h2>方程式与现象</h2><button data-act="clearLog" class="small">清空记录</button><button data-act="reset" class="small danger">重置实验台</button></div>
      ${logHtml(app)}
    </section>`;
  const list = root.querySelector('.shelf-list');
  if (list) list.scrollTop = keepScroll;

  root.onclick = ev => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled || !root.contains(el)) return;
    const fn = handlers[el.dataset.act];
    if (fn) fn(el.dataset.arg);
  };
  const pourTo = root.querySelector('#pourTo');
  if (pourTo) pourTo.onchange = () => handlers.pourTo(pourTo.value);
  const search = root.querySelector('#search');
  if (search) search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    handlers.search(search.value);
    root.querySelectorAll('.reagent').forEach(btn => { btn.hidden = !!q && !btn.dataset.key.includes(q); });
  };
}
