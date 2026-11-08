// 应用入口（C 负责）。持有状态，调用 state.js 和引擎。骨架是最简版本。
import { DATA } from './data.js';
import { createBeaker, addSubstance, pour, filter } from './state.js';
import { react } from './engine/index.js';
import { render } from './render.js';

const app = { beakers: [createBeaker('b1', '烧杯 1'), createBeaker('b2', '烧杯 2')], selected: 'b1', log: [] };
let counter = 2;
const root = document.getElementById('app');

const idx = () => app.beakers.findIndex(b => b.id === app.selected);

function run(i) {
  const b = app.beakers[i];
  const { beaker, events } = react(b, { data: DATA, heated: b.heated });
  app.beakers[i] = beaker;
  app.log.push(...events);
}

const handlers = {
  select(id) { app.selected = id; draw(); },
  add(id) { const i = idx(); app.beakers[i] = addSubstance(app.beakers[i], id, 0.01, DATA); run(i); draw(); },
  heat() { const i = idx(); app.beakers[i] = { ...app.beakers[i], heated: !app.beakers[i].heated }; run(i); draw(); },
  pour() {
    const i = idx(); const j = (i + 1) % app.beakers.length;
    if (i === j) return;
    const r = pour(app.beakers[i], app.beakers[j]);
    app.beakers[i] = r.from; app.beakers[j] = r.to; run(j); draw();
  },
  filter() {
    const i = idx();
    const { filtrate, residue } = filter(app.beakers[i]);
    app.beakers[i] = filtrate;
    if (Object.keys(residue).length) app.log.push({ equation: null, ionic: null, observations: ['过滤得到滤渣：' + Object.keys(residue).join('、')] });
    draw();
  },
  new() { counter++; app.beakers.push(createBeaker('b' + counter, '烧杯 ' + counter)); draw(); },
};

function draw() { render(app, root, handlers); }
draw();
