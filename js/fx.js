// 反应特效（界面用）：闪光、冲击波、火花、玻璃碎片、烟雾、震动，以及用 Web Audio 现场合成的声音（不用音频文件）。
// level：1 剧烈，2 爆鸣，3 爆炸（炸碎烧杯）。

// 不同反应的火光颜色
const COLORS = {
  'k-h2o': '#c084fc', 'na-h2o': '#facc15', 'h2-cl2': '#f8fafc', 'h2-cl2-light': '#f8fafc',
  'h2-o2': '#93c5fd', 'ch4-o2': '#60a5fa', 'co-o2': '#3b82f6', 'al-fe2o3': '#fb923c',
  'mg-o2': '#ffffff', 'fe-o2': '#fbbf24', 'kclo3-p': '#fde68a', 'black-powder': '#f97316',
};
export const colorFor = id => COLORS[id] || '#fb923c';

let muted = false;
export function setMuted(m) { muted = !!m; }

// ---------------- 声音 ----------------
let ac = null, master = null;
function audio() {
  if (muted) return null;
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch { return null; }
}

const bufCache = new Map();
function noiseBuffer(a, sec) {
  const key = Math.round(sec * 100);
  if (bufCache.has(key)) return bufCache.get(key);
  const n = Math.max(1, Math.floor(a.sampleRate * sec));
  const b = a.createBuffer(1, n, a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  bufCache.set(key, b);
  return b;
}

function env(a, t0, dur, gain, attack = 0.004) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(master);
  return g;
}

function noise(a, t0, dur, { type = 'lowpass', freq = 1000, q = 0.7, gain = 0.5, sweepTo } = {}) {
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, dur);
  const f = a.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  src.connect(f); f.connect(env(a, t0, dur, gain));
  src.start(t0); src.stop(t0 + dur + 0.05);
}

function tone(a, t0, dur, f0, f1, gain, type = 'sine') {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  o.connect(env(a, t0, dur, gain, 0.003));
  o.start(t0); o.stop(t0 + dur + 0.05);
}

// 玻璃碎裂：一串清脆的高频"叮"和碎响
function glass(a, t0) {
  noise(a, t0, 0.18, { type: 'highpass', freq: 3000, gain: 0.5 });
  for (let i = 0; i < 16; i++) {
    const t = t0 + 0.04 + Math.random() * 0.9;
    const f = 2200 + Math.random() * 4500;
    tone(a, t, 0.12 + Math.random() * 0.25, f, f * 0.97, 0.05 + Math.random() * 0.06);
    if (i % 3 === 0) noise(a, t, 0.05, { type: 'bandpass', freq: 5000, q: 2, gain: 0.25 });
  }
}

export function sound(level, reactionId) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  if (level >= 3) {
    tone(a, t, 0.9, 120, 28, 1.0);                                        // 低沉的"轰"
    noise(a, t, 1.8, { type: 'lowpass', freq: 2400, sweepTo: 180, gain: 0.95 }); // 爆炸的轰鸣尾音
    noise(a, t, 0.12, { type: 'highpass', freq: 1500, gain: 0.8 });           // 起爆的"啪"
    glass(a, t + 0.05);
  } else if (level === 2) {
    noise(a, t, 0.22, { type: 'highpass', freq: 700, gain: 0.85 });           // 尖锐的爆鸣
    tone(a, t, 0.18, 420, 90, 0.6);
    if (reactionId === 'k-h2o') noise(a, t + 0.05, 1.4, { type: 'bandpass', freq: 4500, q: 0.8, gain: 0.18 });
    if (reactionId === 'al-fe2o3') crackle(a, t, 2.2, 0.35);
  } else {
    noise(a, t, 1.4, { type: 'bandpass', freq: 4000, q: 0.7, gain: 0.16 });   // 嘶嘶声
    crackle(a, t, 1.5, 0.25);
  }
}

function crackle(a, t0, dur, gain) {
  for (let i = 0; i < dur * 28; i++) {
    noise(a, t0 + Math.random() * dur, 0.015 + Math.random() * 0.03,
      { type: 'bandpass', freq: 1500 + Math.random() * 4000, q: 1.5, gain: gain * (0.4 + Math.random() * 0.6) });
  }
}

// ---------------- 画面 ----------------
const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);

function dot(layer, x, y, cls, style = {}) {
  const d = document.createElement('div');
  d.className = cls;
  Object.assign(d.style, { left: x + 'px', top: y + 'px', ...style });
  layer.appendChild(d);
  return d;
}

// 抛物线轨迹的关键帧（带重力下落）
function arc(dx, dy, fall, rot, steps = 6) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const x = dx * k, y = dy * k + fall * k * k;
    out.push({ transform: `translate(${x}px, ${y}px) rotate(${rot * k}deg)`, opacity: k < 0.75 ? 1 : 1 - (k - 0.75) * 4 });
  }
  return out;
}

function sparks(layer, x, y, n, color, power) {
  for (let i = 0; i < n; i++) {
    const ang = rand(-Math.PI * 0.95, -Math.PI * 0.05);
    const v = rand(0.4, 1) * power;
    const s = dot(layer, x + rand(-14, 14), y + rand(-6, 6), 'fx-spark', { background: i % 3 ? color : '#fff7d6', boxShadow: `0 0 6px 2px ${color}` });
    s.animate(arc(Math.cos(ang) * v, Math.sin(ang) * v, power * 0.9, 0), { duration: rand(600, 1300), easing: 'linear', fill: 'forwards' });
  }
}

function shards(layer, rect) {
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height * 0.55;
  for (let i = 0; i < 22; i++) {
    const w = rand(8, 26), h = rand(10, 30);
    const x = rect.left + rect.width * rand(0.18, 0.82), y = rect.top + rect.height * rand(0.15, 0.8);
    const pts = Array.from({ length: 3 + (i % 2) }, () => `${rand(0, 100).toFixed(0)}% ${rand(0, 100).toFixed(0)}%`).join(',');
    const s = dot(layer, x - w / 2, y - h / 2, 'fx-shard', { width: w + 'px', height: h + 'px', clipPath: `polygon(${pts})` });
    const dx = (x - cx) * rand(3, 7) + rand(-60, 60), dy = -rand(120, 320);
    s.animate(arc(dx, dy, rand(500, 800), rand(-900, 900), 8), { duration: rand(1100, 1700), easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
  }
}

function smoke(layer, x, y, n, dark) {
  for (let i = 0; i < n; i++) {
    const r = rand(30, 60);
    const s = dot(layer, x - r + rand(-20, 20), y - r, 'fx-smoke', { width: r * 2 + 'px', height: r * 2 + 'px', background: dark ? 'rgba(60,60,66,.55)' : 'rgba(220,225,235,.45)' });
    s.animate([
      { transform: 'translate(0,0) scale(.3)', opacity: 0 },
      { transform: `translate(${rand(-30, 30)}px, -40px) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${rand(-60, 60)}px, -${rand(120, 200)}px) scale(2)`, opacity: 0 },
    ], { duration: rand(1800, 2600), delay: rand(0, 300), easing: 'ease-out', fill: 'forwards' });
  }
}

function flames(layer, x, y, color) {
  for (let i = 0; i < 9; i++) {
    const s = dot(layer, x + rand(-28, 28) - 9, y - 10, 'fx-flame', { background: `radial-gradient(circle at 50% 70%, #fff7d6, ${color} 45%, transparent 70%)` });
    s.animate([
      { transform: 'translateY(0) scale(.4)', opacity: 0 },
      { transform: `translateY(-${rand(20, 40)}px) scale(1.2)`, opacity: 1, offset: 0.3 },
      { transform: `translateY(-${rand(60, 100)}px) scale(.3)`, opacity: 0 },
    ], { duration: rand(600, 1000), delay: rand(0, 900), easing: 'ease-out', fill: 'forwards' });
  }
}

function shake(el, cls, ms) {
  if (!el || reduce()) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// 安静燃烧：容器口上方一小簇持续一会儿的火焰，没有声音
export function calm(el, reactionId) {
  if (!el || !document.body.animate) return;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2, y = rect.top + rect.height * 0.12;
  const color = reactionId === 'co-o2' ? '#3b82f6' : '#7dd3fc';
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3600);
  for (let i = 0; i < 26; i++) {
    const s = dot(layer, x + rand(-6, 6) - 9, y, 'fx-flame', { background: `radial-gradient(circle at 50% 70%, #e0f2fe, ${color} 45%, transparent 70%)` });
    s.animate([
      { transform: 'translateY(0) scale(.5)', opacity: 0 },
      { transform: `translateY(-${rand(10, 18)}px) scale(1)`, opacity: 0.9, offset: 0.3 },
      { transform: `translateY(-${rand(30, 45)}px) scale(.3)`, opacity: 0 },
    ], { duration: rand(500, 800), delay: i * 110, easing: 'ease-out', fill: 'forwards' });
  }
}

// el：烧杯图所在的元素
export function play(level, el, reactionId) {
  if (!level) return;
  sound(level, reactionId);
  if (!el || !document.body.animate) return;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2, y = rect.top + rect.height * 0.45;
  const color = colorFor(reactionId);
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3200);

  if (level >= 2) {
    const big = level >= 3;
    const flash = dot(layer, 0, 0, 'fx-flash', { background: `radial-gradient(circle at ${x}px ${y}px, #fff ${big ? 8 : 3}%, ${color} ${big ? 22 : 12}%, transparent ${big ? 70 : 40}%)` });
    flash.animate([{ opacity: 0 }, { opacity: big ? 1 : 0.8, offset: 0.08 }, { opacity: 0 }], { duration: big ? 700 : 400, fill: 'forwards' });
    for (let i = 0; i < (big ? 3 : 2); i++) {
      const ring = dot(layer, x - 30, y - 30, 'fx-ring', { borderColor: i ? 'rgba(255,255,255,.6)' : color });
      ring.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: `scale(${big ? 9 : 4})`, opacity: 0 }],
        { duration: big ? 800 : 550, delay: i * 120, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' });
    }
    if (big) {
      const ball = dot(layer, x - 60, y - 60, 'fx-fireball', { background: `radial-gradient(circle, #fff 0%, #fde68a 25%, ${color} 50%, rgba(234,88,12,0) 72%)` });
      ball.animate([{ transform: 'scale(.1)', opacity: 1 }, { transform: 'scale(2.6)', opacity: 0.9, offset: 0.35 }, { transform: 'scale(3.2)', opacity: 0 }],
        { duration: 900, easing: 'ease-out', fill: 'forwards' });
      shards(layer, rect);
      smoke(layer, x, y, 8, reactionId === 'black-powder' || reactionId?.startsWith('kclo3'));
      shake(document.getElementById('app'), 'fx-shake-3', 700);
    } else {
      shake(document.getElementById('app'), 'fx-shake-2', 400);
      if (reactionId === 'k-h2o') flames(layer, x, y, color);
    }
    sparks(layer, x, y, big ? 46 : reactionId === 'al-fe2o3' ? 60 : 26, color, big ? 260 : 170);
    if (reactionId === 'al-fe2o3') smoke(layer, x, y, 4, false);
  } else {
    shake(el, 'fx-shake-1', 1300);
    sparks(layer, x, y, 30, color, 120);
    flames(layer, x, y, color);
    const glow = dot(layer, x - 60, y - 60, 'fx-fireball', { background: `radial-gradient(circle, ${color} 0%, transparent 65%)` });
    glow.animate([{ opacity: 0 }, { opacity: 0.8, offset: 0.2 }, { opacity: 0.5, offset: 0.6 }, { opacity: 0 }], { duration: 1500, fill: 'forwards' });
  }
}
