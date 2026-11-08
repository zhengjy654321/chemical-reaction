// 渲染（C 负责）。render(app, root, handlers) 只读状态，不改状态。骨架是最简版本。
import { formatFormula, formatEquation } from './equation.js';
import { DATA } from './data.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function liquidColor(b) {
  for (const id of Object.keys(b.ions)) if (DATA.IONS[id]?.css) return DATA.IONS[id].css;
  return '#e0f2fe';
}

function contents(b) {
  const rows = [];
  for (const [id, n] of Object.entries(b.ions)) rows.push(`${formatFormula(id)} ${n.toFixed(3)}`);
  for (const [id, n] of Object.entries(b.dissolved)) rows.push(`${formatFormula(id)}(aq) ${n.toFixed(3)}`);
  for (const [id, n] of Object.entries(b.solids)) rows.push(`${formatFormula(id)}(s) ${n.toFixed(3)}`);
  for (const [id, n] of Object.entries(b.gases)) rows.push(`${formatFormula(id)}↑ ${n.toFixed(3)}`);
  return rows.map(r => `<li>${esc(r)}</li>`).join('');
}

export function render(app, root, handlers) {
  const shelf = Object.values(DATA.SUBSTANCES).filter(s => s.shelf);
  root.innerHTML = `
    <section class="beakers">
      ${app.beakers.map(b => `
        <div class="beaker ${b.id === app.selected ? 'selected' : ''}" data-id="${b.id}">
          <strong>${esc(b.label)}${b.heated ? ' 🔥' : ''}</strong>
          <div class="liquid" style="background:${liquidColor(b)}"></div>
          <ul>${contents(b)}</ul>
        </div>`).join('')}
    </section>
    <section class="controls">
      <select id="reagent">${shelf.map(s => `<option value="${s.id}">${esc(s.name)} ${formatFormula(s.formula)}</option>`).join('')}</select>
      <button data-act="add">加入选中烧杯</button>
      <button data-act="heat">加热/停止</button>
      <button data-act="pour">倒入下一个烧杯</button>
      <button data-act="filter">过滤</button>
      <button data-act="new">新烧杯</button>
    </section>
    <section class="log">
      ${app.log.slice().reverse().map(e => `
        <div class="entry">
          ${e.equation ? `<div class="eq">${esc(formatEquation(e.equation))}</div>` : ''}
          ${e.ionic ? `<div class="eq">离子方程式：${esc(formatEquation(e.ionic))}</div>` : ''}
          <div class="obs">${esc(e.observations.join('；'))}</div>
        </div>`).join('') || '<div class="obs">还没有发生反应</div>'}
    </section>`;
  root.querySelectorAll('.beaker').forEach(el => el.onclick = () => handlers.select(el.dataset.id));
  root.querySelectorAll('button[data-act]').forEach(el => el.onclick = () =>
    handlers[el.dataset.act](root.querySelector('#reagent').value));
}
