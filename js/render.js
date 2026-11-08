// 渲染（C 负责）。render(app, root, handlers) 只读状态，不改状态。
import { formatFormula, formatEquation } from './equation.js';
import { DATA } from './data.js';
import { MODES, CONCS, DROP_ML, modeOf, molesOf, toPos, fmtAmt } from './amount.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const CATEGORIES = [
  ['all', '全部'], ['acid', '酸'], ['base', '碱'], ['salt', '盐'], ['oxide', '氧化物'],
  ['metal', '金属'], ['nonmetal', '非金属'], ['organic', '有机物'], ['gas', '气体'], ['other', '其他'],
];
const FORM_LABEL = { aq: '溶液', s: '固体', l: '液体', g: '气体' };

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
// 几何（viewBox 0 0 120 172）：杯口 y=24，杯底 y=137，内壁 x 25..95；150 mL 对应液高 92。
const IN_L = 25, IN_R = 95, IN_BOT = 137, FULL_H = 92, FULL_ML = 150;
const prevSolid = new Map(); // 上次渲染时各烧杯的固体总量，用来判断"刚生成沉淀"

// 所有烧杯共用的渐变和裁剪，只输出一次。
export const SVG_DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <clipPath id="bk-clip"><path d="M${IN_L} 27 L${IN_L} 130 Q${IN_L} ${IN_BOT} 32 ${IN_BOT} L88 ${IN_BOT} Q${IN_R} ${IN_BOT} ${IN_R} 130 L${IN_R} 27 Z"/></clipPath>
    <linearGradient id="bk-glass" x1="0" x2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".22"/>
      <stop offset=".12" stop-color="#fff" stop-opacity=".05"/>
      <stop offset=".75" stop-color="#fff" stop-opacity=".02"/>
      <stop offset=".92" stop-color="#fff" stop-opacity=".14"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".04"/>
    </linearGradient>
    <linearGradient id="bk-depth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".28"/>
      <stop offset=".18" stop-color="#fff" stop-opacity=".02"/>
      <stop offset="1" stop-color="#000" stop-opacity=".32"/>
    </linearGradient>
    <linearGradient id="bk-side" x1="0" x2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".25"/>
      <stop offset=".2" stop-color="#000" stop-opacity="0"/>
      <stop offset=".8" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".3"/>
    </linearGradient>
    <linearGradient id="bk-sed" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".25"/>
      <stop offset="1" stop-color="#000" stop-opacity=".35"/>
    </linearGradient>
    <radialGradient id="bk-flame-o" cx=".5" cy=".85" r=".7">
      <stop offset="0" stop-color="#fde68a"/><stop offset=".55" stop-color="#fb923c"/><stop offset="1" stop-color="#ea580c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bk-flame-i" cx=".5" cy=".8" r=".6">
      <stop offset="0" stop-color="#e0f2fe"/><stop offset=".6" stop-color="#60a5fa"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
  </defs>
</svg>`;

// 固定的伪随机，保证同一个烧杯每次画出来的颗粒位置一样。
function rnd(seed) {
  let x = 0;
  for (const c of String(seed)) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

function beakerSvg(b) {
  const ml = volumeMl(b);
  const hasLiquid = ml > 0.5 || Object.keys(b.ions).length || Object.keys(b.dissolved).length;
  const liqH = hasLiquid ? Math.min(FULL_H, Math.max(10, ml / FULL_ML * FULL_H)) : 0;
  const top = IN_BOT - liqH;
  const solidN = Object.values(b.solids).reduce((a, n) => a + n, 0);
  const solH = solidN > 0 ? Math.min(26, 3 + Math.sqrt(solidN) * 55) : 0;
  const color = solutionColor(b);
  const sColor = solidN > 0 ? solidColor(b) : null;
  const gases = Object.keys(b.gases).length > 0;
  const R = rnd(b.id);

  const prev = prevSolid.get(b.id);
  prevSolid.set(b.id, solidN);
  const settling = hasLiquid && solidN > 0 && prev !== undefined && solidN > prev + 1e-9;

  let liquid = '';
  if (hasLiquid) {
    const fill = color || '#8ecbff';
    const op = color ? 0.82 : 0.22;
    liquid = `
      <rect x="0" y="${top}" width="120" height="${liqH + 2}" fill="${fill}" opacity="${op}"/>
      ${solidN > 0 ? `<rect x="0" y="${top}" width="120" height="${liqH + 2}" fill="${sColor}" opacity="${settling ? 0.35 : 0.1}" class="${settling ? 'turbid' : ''}"/>` : ''}
      <rect x="0" y="${top}" width="120" height="${liqH + 2}" fill="url(#bk-depth)"/>
      <rect x="0" y="${top}" width="120" height="${liqH + 2}" fill="url(#bk-side)"/>
      <ellipse cx="60" cy="${top}" rx="35" ry="2.6" fill="${fill}" opacity="${color ? 0.95 : 0.4}"/>
      <ellipse cx="60" cy="${top - 0.4}" rx="33" ry="1.6" fill="#fff" opacity=".35" class="surface"/>`;
  }

  let sediment = '';
  if (solH) {
    const y0 = IN_BOT - solH;
    const grains = Array.from({ length: 26 }, () => {
      const x = IN_L + 3 + R() * 64, y = IN_BOT - 1 - R() * (solH - 1);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.5 + R() * 0.9).toFixed(2)}" fill="${R() > .5 ? '#fff' : '#000'}" opacity="${(0.12 + R() * 0.15).toFixed(2)}"/>`;
    }).join('');
    sediment = `<g class="${settling ? 'sed-grow' : ''}">
      <path d="M0 ${IN_BOT + 2} L0 ${y0 + solH * 0.35} Q60 ${y0 - solH * 0.45} 120 ${y0 + solH * 0.35} L120 ${IN_BOT + 2} Z" fill="${sColor}"/>
      <path d="M0 ${IN_BOT + 2} L0 ${y0 + solH * 0.35} Q60 ${y0 - solH * 0.45} 120 ${y0 + solH * 0.35} L120 ${IN_BOT + 2} Z" fill="url(#bk-sed)" stroke="rgba(255,255,255,.35)" stroke-width=".6"/>
      ${grains}</g>`;
  }

  // 刚生成的沉淀：絮状颗粒从液体中缓缓沉到杯底
  const flakes = settling ? Array.from({ length: 34 }, () => {
    const x = IN_L + 3 + R() * 64, y = top + 4 + R() * Math.max(4, liqH - solH - 8);
    const d = Math.max(2, IN_BOT - solH * 0.5 - y);
    return `<circle class="flake" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.7 + R() * 1.3).toFixed(2)}" fill="${sColor}"
      style="--d:${d.toFixed(1)}px;animation-delay:${(R() * 0.9).toFixed(2)}s;animation-duration:${(1.8 + R() * 1.4).toFixed(2)}s"/>`;
  }).join('') : '';

  const bubbles = gases && hasLiquid ? Array.from({ length: 12 }, () => {
    const x = IN_L + 6 + R() * 58, r = 0.8 + R() * 1.8;
    const rise = Math.max(6, IN_BOT - 4 - top);
    return `<circle class="bubble" cx="${x.toFixed(1)}" cy="${IN_BOT - 3}" r="${r.toFixed(2)}"
      style="--rise:-${rise.toFixed(1)}px;animation-delay:${(R() * 2).toFixed(2)}s;animation-duration:${(1.2 + R() * 1.2).toFixed(2)}s"/>`;
  }).join('') : '';

  // 无液体时（空试管里放的固体）：颗粒堆
  const ticks = [[50, 'short'], [100, 'long'], [150, 'long']].map(([v]) => {
    const y = IN_BOT - v / FULL_ML * FULL_H;
    return `<line x1="${IN_L + 1}" x2="${IN_L + 9}" y1="${y}" y2="${y}" class="tick"/>
      <text x="${IN_L + 11}" y="${y + 2.2}" class="tick-num">${v}</text>`;
  }).join('') + [25, 75, 125].map(v => {
    const y = IN_BOT - v / FULL_ML * FULL_H;
    return `<line x1="${IN_L + 1}" x2="${IN_L + 5}" y1="${y}" y2="${y}" class="tick minor"/>`;
  }).join('');

  const steam = b.heated && hasLiquid ? [40, 60, 80].map((x, i) =>
    `<path class="steam" style="animation-delay:${i * 0.7}s" d="M${x} 22 q-5 -6 0 -11 q5 -5 0 -11" />`).join('') : '';

  const flame = b.heated ? `
    <g class="flame">
      <path d="M60 140 C47 152 50 166 60 170 C70 166 73 152 60 140Z" fill="url(#bk-flame-o)"/>
      <path d="M60 151 C54 158 55 166 60 169 C65 166 66 158 60 151Z" fill="url(#bk-flame-i)"/>
    </g>
    <ellipse cx="60" cy="139" rx="30" ry="3" fill="#fb923c" opacity=".35" class="glow"/>` : '';

  return `
  <svg viewBox="0 0 120 172" class="beaker-svg" aria-hidden="true">
    ${steam}
    <!-- 三脚架和石棉网 -->
    <g class="stand">
      <path d="M22 141 L12 172 M98 141 L108 172 M60 141 L60 150" />
    </g>
    ${flame}
    <rect x="10" y="138.5" width="100" height="3" rx="1" class="gauze"/>
    <!-- 杯体背面 -->
    <path d="M24 24 L24 130 Q24 138 32 138 L88 138 Q96 138 96 130 L96 24 Z" fill="url(#bk-glass)"/>
    <g clip-path="url(#bk-clip)">
      ${liquid}
      ${sediment}
      ${flakes}
      ${bubbles}
    </g>
    ${ticks}
    <!-- 杯壁、杯口、高光 -->
    <path d="M19 21 Q21 24 24 25 L24 130 Q24 138 32 138 L88 138 Q96 138 96 130 L96 25 Q99 24 101 21" class="glass"/>
    <ellipse cx="60" cy="24" rx="37" ry="2.2" class="rim"/>
    <path d="M29 34 L29 122" class="shine"/>
    <path d="M90 40 L90 110" class="shine thin"/>
  </svg>`;
}

function gasTag(b) {
  const ids = Object.keys(b.gases);
  if (!ids.length) return '';
  return `<div class="gas-tag">${ids.map(id => `<span>${formatFormula(id)}</span>`).join('')}<i>↑</i></div>`;
}

function contents(b) {
  const rows = [];
  for (const [id, n] of Object.entries(b.liquids)) rows.push(id === 'H2O'
    ? ['water', '水', `${(n * 18).toFixed(0)} mL`]
    : ['liq', `${formatFormula(id)}<small>(l)</small>`, fmtMol(n)]);
  for (const [id, n] of Object.entries(b.ions)) rows.push(['ion', formatFormula(id), fmtMol(n)]);
  for (const [id, n] of Object.entries(b.dissolved)) rows.push(['aq', `${formatFormula(id)}<small>(aq)</small>`, fmtMol(n)]);
  for (const [id, n] of Object.entries(b.solids)) rows.push(['solid', `${formatFormula(id)}<small>(s)</small>`, fmtMol(n),
    DATA.SUBSTANCES[id]?.css || '#9ca3af']);
  for (const [id] of Object.entries(b.gases)) rows.push(['gas', `${formatFormula(id)}<small>(g)</small>`, '↑']);
  if (!rows.length) return '<li class="muted empty">空</li>';
  return rows.map(([k, f, amt, css]) => `<li class="c-${k}">${css ? `<i class="dot" style="background:${css}"></i>` : ''}<span class="f">${f}</span><span class="amt">${amt}</span></li>`).join('');
}

// ---------- 各区块 ----------
function beakersHtml(app) {
  return app.beakers.map(b => `
    <div class="beaker ${b.id === app.selected ? 'selected' : ''} ${b.heated ? 'is-hot' : ''}" data-act="select" data-arg="${b.id}">
      <div class="beaker-head"><strong>${esc(b.label)}</strong>${b.heated ? '<span class="tag hot">加热中</span>' : ''}</div>
      <div class="beaker-stage">${gasTag(b)}${beakerSvg(b)}</div>
      <ul class="contents">${contents(b)}</ul>
    </div>`).join('') + `
    <div class="beaker add-card">
      <button data-act="newBeaker" data-arg="water"><span class="plus">＋</span><span>新烧杯<small>装 50 mL 水</small></span></button>
      <button data-act="newBeaker" data-arg="empty"><span class="plus">＋</span><span>空试管<small>用来放固体</small></span></button>
    </div>`;
}

function shelfHtml(app) {
  const ui = app.ui;
  const all = Object.values(DATA.SUBSTANCES).filter(s => s.shelf);
  const inCat = (s, k) => k === 'all' || s.category === k || (k === 'gas' && (s.shelfForm === 'g' || s.state === 'g'));
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

const ICON = {
  heat: '<svg viewBox="0 0 24 24"><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/></svg>',
  ignite: '<svg viewBox="0 0 24 24"><path d="M5 19 15 9M15 9l2-4 2 2-4 2M7 21l-4-4"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M3 4h18l-7 9v6l-4 2v-8z"/></svg>',
  clear: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  remove: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pour: '<svg viewBox="0 0 24 24"><path d="M4 6h10l-1 12H5zM14 9c3 0 5 2 6 6"/></svg>',
  collect: '<svg viewBox="0 0 24 24"><path d="M8 3h8M9 3v4l-4 6v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6l-4-6V3"/><circle cx="11" cy="15" r="1.2"/><circle cx="14" cy="12" r="1"/></svg>',
};

function actionsHtml(app) {
  const b = app.beakers.find(x => x.id === app.selected);
  if (!b) return '<div class="muted">先点选或新建一个烧杯</div>';
  const r = DATA.SUBSTANCES[app.ui.reagent];
  const others = app.beakers.filter(x => x.id !== b.id);
  const solidMode = !!r && canBeSolid(r) && app.ui.form === 's';
  return `
    <div class="target">
      <div class="t-beaker"><span class="k">当前容器</span><b>${esc(b.label)}</b></div>
      <div class="t-reagent">${r
        ? `<span class="k">试剂</span><span class="swatch" style="background:${r.css || 'transparent'}"></span><b>${esc(reagentLabel(r))}</b><span class="formula">${formatFormula(r.formula)}</span>`
        : '<span class="k">试剂</span><span class="muted">在下方试剂架中选择</span>'}</div>
    </div>
    ${r && canBeSolid(r) ? `<div class="seg form-row">
      <button class="${app.ui.form !== 's' ? 'on' : ''}" data-act="form" data-arg="aq">溶液</button>
      <button class="${app.ui.form === 's' ? 'on' : ''}" data-act="form" data-arg="s">固体</button></div>` : ''}
    ${r ? amountHtml(app, r, solidMode) : '<div class="amount-ph muted">选好试剂后，用滑动条精确设置加入量</div>'}
    <div class="tools">
      <button data-act="heat" class="${b.heated ? 'hot' : ''}">${ICON.heat}<span>${b.heated ? '停止加热' : '加热'}</span></button>
      <button data-act="ignite">${ICON.ignite}<span>点燃</span></button>
      <button data-act="filter">${ICON.filter}<span>过滤</span></button>
      <button data-act="collect" ${Object.keys(b.gases).length ? '' : 'disabled'} title="把刚产生的气体收集到集气瓶">${ICON.collect}<span>收集气体</span></button>
      <button data-act="clear">${ICON.clear}<span>清空</span></button>
      <button data-act="remove" class="danger">${ICON.remove}<span>移除</span></button>
    </div>
    <div class="pour-row">
      <span class="k">${ICON.pour}倒入</span>
      <select id="pourTo" ${others.length ? '' : 'disabled'}>
        ${others.map(o => `<option value="${o.id}" ${o.id === app.ui.pourTo ? 'selected' : ''}>${esc(o.label)}</option>`).join('') || '<option>（没有其他烧杯）</option>'}
      </select>
      <button data-act="pour" data-arg="1" ${others.length ? '' : 'disabled'}>全部</button>
      <button data-act="pour" data-arg="0.5" ${others.length ? '' : 'disabled'}>一半</button>
    </div>`;
}

// 加入量：滑动条 + 常用值 + 浓度
export function amountState(app, r, solidMode) {
  const mode = modeOf(r, solidMode);
  const m = MODES[mode];
  const amt = app.ui.amt || {};
  const value = Math.min(m.max, Math.max(m.min, Number(amt[mode]) || m.def));
  const conc = CONCS.includes(Number(amt.conc)) ? Number(amt.conc) : 1;
  return { mode, m, value, conc, moles: molesOf(r, mode, value, conc) };
}
export function amountReadout(st) {
  const extra = st.mode === 'aq' ? ` × ${st.conc} mol/L` : '';
  return `<b>${st.value}</b> ${st.m.unit}<span class="x">${extra}</span><span class="eqv">≈ ${fmtAmt(st.moles)}</span>`;
}
function amountHtml(app, r, solidMode) {
  const st = amountState(app, r, solidMode);
  const { mode, m } = st;
  return `
    <div class="amount" data-mode="${mode}">
      <div class="amount-top"><span class="k">${m.label}</span><span class="readout" id="amtOut">${amountReadout(st)}</span></div>
      <input id="amt" type="range" min="0" max="1000" step="1" value="${toPos(m, st.value)}" aria-label="${m.label}">
      <div class="presets">${m.presets.map(v => `<button class="chip ${v === st.value ? 'on' : ''}" data-act="amtPreset" data-arg="${v}">${v} ${m.unit}</button>`).join('')}</div>
      ${mode === 'aq' ? `<div class="conc"><span class="k">浓度</span><div class="seg">${CONCS.map(c => `<button class="${c === st.conc ? 'on' : ''}" data-act="conc" data-arg="${c}">${c}</button>`).join('')}</div><span class="k">mol/L</span></div>` : ''}
      <div class="amount-go">
        ${mode === 'aq' || mode === 'l' ? `<button data-act="drop">滴加 1 滴<small>${DROP_ML} mL</small></button>` : ''}
        <button class="primary" data-act="addAmount">加入<small id="amtBtn">${st.value} ${m.unit}</small></button>
      </div>
    </div>`;
}

// 方程式排版：反应条件写在等号上方（教材写法）
function termHtml(t) {
  const n = t.n === 1 ? '' : `<span class="coef">${t.n}</span>`;
  const note = t.note ? `<small>(${esc(t.note)})</small>` : '';
  const mark = t.mark ? `<span class="mark">${esc(t.mark)}</span>` : '';
  return `<span class="term">${n}${esc(formatFormula(t.formula))}${note}${mark}</span>`;
}
function equationHtml(eq) {
  if (!eq?.reactants || !eq?.products) return esc(formatEquation(eq));
  const side = ts => ts.map(termHtml).join('<span class="plus">+</span>');
  const cond = eq.condition ? (/^[A-Z]/.test(eq.condition) ? formatFormula(eq.condition) : eq.condition) : '';
  const arrow = `<span class="eqsign${cond ? ' has-cond' : ''}">${cond ? `<span class="cond">${esc(cond)}</span>` : ''}<span class="bar"></span></span>`;
  return side(eq.reactants) + arrow + side(eq.products);
}

function logHtml(app) {
  if (!app.log.length) return `<div class="empty-log">
    <div class="el-icon">⚗</div>
    <div>还没有操作</div>
    <div class="muted">选一个试剂，点"滴加 1 滴"或"适量"加入烧杯，方程式和现象会显示在这里。</div></div>`;
  return app.log.slice().reverse().map(entry => {
    const evs = entry.events || [];
    const hasEq = evs.some(e => e.equation || e.ionic);
    return `
    <div class="entry ${hasEq ? 'has-eq' : 'plain'}">
      <div class="op">${esc(entry.title)}</div>
      ${evs.map(e => `
        <div class="ev">
          ${e.equation ? `<div class="eq">${equationHtml(e.equation)}</div>` : ''}
          ${e.ionic ? `<div class="eq ionic"><span class="lbl">离子方程式</span>${equationHtml(e.ionic)}</div>` : ''}
          ${e.observations?.length ? `<div class="obs"><span class="lbl obs-l">现象</span>${esc(e.observations.join('；'))}</div>` : ''}
        </div>`).join('')}
      ${entry.note ? `<div class="note">${esc(entry.note)}</div>` : ''}
    </div>`;
  }).join('');
}

export function render(app, root, handlers) {
  const keepScroll = root.querySelector('.shelf-list')?.scrollTop || 0;
  root.innerHTML = `${SVG_DEFS}
    <section class="bench">
      <div class="sec-head"><h2>实验台</h2><span class="muted">点选烧杯后再加试剂</span></div>
      <div class="beakers">${beakersHtml(app)}</div>
    </section>
    <section class="panel">
      <div class="card actions">${actionsHtml(app)}</div>
      <div class="card shelf"><div class="sec-head"><h2>试剂架</h2></div>${shelfHtml(app)}</div>
    </section>
    <section class="card log">
      <div class="log-head"><h2>方程式与现象</h2><button data-act="clearLog" class="small">清空记录</button><button data-act="reset" class="small danger">重置实验台</button></div>
      <div class="entries">${logHtml(app)}</div>
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
  const amt = root.querySelector('#amt');
  if (amt) amt.oninput = () => handlers.amtSlide(Number(amt.value));
  const search = root.querySelector('#search');
  if (search) search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    handlers.search(search.value);
    root.querySelectorAll('.reagent').forEach(btn => { btn.hidden = !!q && !btn.dataset.key.includes(q); });
  };
}
