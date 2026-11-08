# 接口约定（CONTRACT）

本文件是数据（A）、引擎（B）、界面（C）三个线程共同遵守的约定。**要改约定，先找协调者**，不要在自己的 PR 里悄悄改别人依赖的格式。

纯静态网站：原生 ES 模块，无构建步骤，GitHub Pages 直接从 `main` 根目录发布。测试用 Node 自带的 `node --test`（`npm test`）。

## 1. 目录与归属

| 路径 | 归属 | 内容 |
|---|---|---|
| `data/substances.js` | A | 物质表 `SUBSTANCES`、离子表 `IONS` |
| `data/solubility.js` | A | 难溶/微溶物表 `INSOLUBLE` |
| `data/reactions.js` | A | 特殊反应表 `REACTIONS` |
| `tests/data.test.js` | A | 数据自检 |
| `js/equation.js` | B | 化学式解析、配平、守恒检查、格式化 |
| `js/state.js` | B | 烧杯状态的纯函数操作（加料、倾倒、过滤） |
| `js/engine/*` | B | 反应规则与 `react()` |
| `tests/engine.test.js`, `tests/equation.test.js` | B | 引擎测试 |
| `index.html`, `css/*`, `js/main.js`, `js/render.js` | C | 界面 |
| `CONTRACT.md`, `README.md`, `package.json`, `js/data.js`, `tests/textbook.test.js` | 协调者 | 约定与整体测试 |

每个线程只改自己的文件。需要别人改的，告诉协调者。

## 2. 标识符写法

- **物质 id**：就是化学式，如 `BaCl2`、`Ca(OH)2`、`CuSO4·5H2O`。同一化学式的不同形态加后缀：`H2SO4_conc`（浓硫酸）、`HNO3_conc`。
- **离子 id**：化学式 + `^` + 电荷，如 `H^+`、`Ba^2+`、`SO4^2-`、`NH4^+`、`Fe^3+`。
- 所有数量单位都是 **mol**。

## 3. 数据格式（A 负责填，B 和 C 读取）

### 3.1 物质 `SUBSTANCES`（`data/substances.js`）

```js
export const SUBSTANCES = {
  BaCl2: {
    id: 'BaCl2',
    formula: 'BaCl2',          // 用于显示和守恒检查（不含 _conc 之类后缀）
    name: '氯化钡',
    category: 'salt',          // acid | base | salt | oxide | metal | nonmetal | organic | other
    state: 's',                // 常温下纯净物状态：s | l | g
    color: '白色',              // 中文颜色描述，用于生成现象
    css: '#ffffff',            // 界面绘制用颜色（溶液/固体/气体）
    ions: { 'Ba^2+': 1, 'Cl^-': 2 }, // 溶于水时完全电离出的离子；不电离或难溶则省略
    soluble: true,             // 能否溶于水（溶于水但不电离的分子，如 H2O2、C2H5OH、CH3COOH，也写 true 且省略 ions）
    shelf: true,               // 是否出现在界面试剂架上（产物如 BaSO4 可设 false）
    shelfForm: 'aq',           // 试剂架上的形态：'aq' 溶液 | 's' 固体 | 'l' 液体 | 'g' 气体
    note: '',                  // 可选：俗名、注意事项
  },
};
```

### 3.2 离子 `IONS`（`data/substances.js`）

```js
export const IONS = {
  'Cu^2+': { id: 'Cu^2+', formula: 'Cu', charge: 2, name: '铜离子', color: '蓝色', css: '#3b82f6' },
};
```
无色离子 `color: '无色'`，`css: null`。

### 3.3 难溶/微溶物 `INSOLUBLE`（`data/solubility.js`）

只列**不溶或微溶**的阴阳离子组合；没列出的组合视为可溶。

```js
export const INSOLUBLE = [
  { cation: 'Ba^2+', anion: 'SO4^2-', product: 'BaSO4' },
  { cation: 'Ca^2+', anion: 'OH^-',  product: 'Ca(OH)2', slight: true },
];
```
计量比由电荷推出（Ba²⁺:SO₄²⁻ = 1:1，Ag⁺:SO₄²⁻ = 2:1），`product` 必须是 `SUBSTANCES` 里的物质。会水解或分解的组合（如 Ag⁺+OH⁻→Ag₂O，Al³⁺+CO₃²⁻ 双水解）不放这里，写进特殊反应表。

每行可带 `ksp`（25℃ 溶度积）。引擎用它做真实的沉淀计算：
- 离子浓度 = 物质的量 / 烧杯里水的体积（L）；离子积 Q = c(阳离子)^m · c(阴离子)^n。
- Q > Ksp 才沉淀，沉淀到 Q = Ksp 为止；剩下的离子浓度小于 1e-5 mol/L（或不到原来的 0.1%）时按"沉淀完全"处理。
- 几种沉淀能同时生成时，溶解度（由 Ksp 算出）最小的先沉淀；固体遇到能生成溶解度小 3 倍以上的物质的离子时发生沉淀转化。
- 固体沉淀所在溶液 Q < Ksp（如加水）时会溶解一部分或全部。
- 没有 `ksp` 的行：难溶的直接完全沉淀，微溶的按约 0.02 mol/L 的溶解上限处理。

### 3.4 特殊反应 `REACTIONS`（`data/reactions.js`）

规则推不出来的反应（燃烧、分解、催化、浓酸、双水解等）都写在这里。

```js
export const REACTIONS = [
  {
    id: 'h2o2-mno2',
    name: '过氧化氢在二氧化锰催化下分解',
    match:   { H2O2: 2 },              // 烧杯里必须同时有的物质/离子 id 及化学计量数
    produce: { H2O: 2, O2: 1 },        // 生成的物质/离子 id 及化学计量数
    condition: 'none',                 // none | heat | ignite | electrolysis | light（光照，react 的 ctx.light）
    intensity: 0,                      // 可选：1 剧烈 | 2 爆鸣 | 3 爆炸（炸碎容器）；引擎原样放进 event.intensity，界面据此播放特效
    conditionText: '高温',              // 可选：显示用的条件文字（'高温' '放电' '光照' 等），有就替代 condition 的默认文字；有催化剂时显示为 'MnO2、高温'
    catalyst: 'MnO2',                  // 可选：必须存在但不消耗
    display: null,                     // 可选：{ reactants: {...}, products: {...} }，用于显示分子方程式（match 里用了离子时填）
    observations: ['产生大量气泡'],
    priority: 0,                       // 可选：数字大的先判断（如浓硫酸优先于一般酸）
  },
];
```
- `match`/`produce` 里溶于水的强电解质**写离子**（如 `'Cu^2+': 1`），这样才能和烧杯里的离子对上；此时用 `display` 写成分子方程式给界面显示。
- 每条反应都必须原子守恒、电荷守恒（`tests/data.test.js` 会检查 `match→produce` 和 `display`）。

## 4. 烧杯状态（B 实现，C 读取）

烧杯是纯 JSON 对象，所有操作都返回新对象，不修改旧对象。

```js
const beaker = {
  id: 'b1',
  label: '烧杯 1',
  heated: false,             // 是否正在加热
  ions:     { 'Ba^2+': 0.01, 'Cl^-': 0.02 },  // 溶液中的离子
  dissolved:{ H2O2: 0.01 },                   // 溶液中不电离的溶质分子
  liquids:  { H2O: 2.78 },                     // 液体（含溶剂水）
  solids:   { BaSO4: 0.01 },                   // 固体（沉淀、金属、粉末）
  gases:    { },                               // 气体：用户通入的 + 本次反应生成正在逸出的
  escaping: { },                               // 可选，引擎维护：gases 里属于"本次反应生成、正在逸出"的部分
};
```
**气体规则**：`react()` 开始时，先从 `gases` 去掉上一次记在 `escaping` 里的量（已经逸出）；剩下的（用户用 `addSubstance` 通入、还没反应完的气体，如 CO₂、H₂、O₂）作为反应物参加反应。本次 `react()` 里生成的气体不再参加本次反应（防止 Ca(HCO₃)₂ 分解出的 CO₂ 又把它溶回去），结束时与剩余气体一起放在 `gases` 里，生成的部分同时记进 `escaping`。界面画"冒气泡"可以用 `escaping`，画"瓶里还有气体"用 `gases`。
数量小于 `1e-9` mol 视为 0 并删除。没有水（H₂O < 0.05 mol）时，反应生成的可溶固体（如干试管里 KClO₃ 分解得到的 KCl）留在 `solids`，不拆成离子。

### `js/state.js`（B）

```js
createBeaker(id, label, waterMl = 50) -> beaker
addSubstance(beaker, substanceId, moles, data, options = {}) -> beaker
  // options.volumeMl：以溶液加入时这份溶液的体积（mL），按水加进烧杯，用来算离子浓度。
  //   界面自己算好 moles（= 浓度 × 体积），固体和气体不传或传 0。不传时和以前一样只加溶质。
  // 按 SUBSTANCES 的 ions/soluble/state 放入对应位置。
  // options.form === 's'，或烧杯里没有水（H2O < 0.05 mol，约 1 mL）时，常温为固体的试剂留在 solids（不溶解电离），以便加热分解（KClO3、KMnO4、NaHCO3、NH4Cl…）。
pour(from, to, fraction = 1) -> { from, to }               // 按比例转移 ions/dissolved/liquids/solids
filter(beaker) -> { filtrate, residue }                    // filtrate 去掉 solids；residue 是 solids 对象
collectGas(beaker, data, jarId, jarLabel) -> { from, jar, gases: [{ id, n, methods }] } | null
  // 把烧杯里的气体收集到新的集气瓶（无水容器）；methods 是可用的收集方法，第一项推荐（排水法/向上排空气法/向下排空气法）
collectMethods(id, data) -> ['排水法', '向上排空气法' ...]
// pour 也会把容器里存着的气体（不含刚生成、正在逸出的 escaping 部分）倒进目标容器，所以集气瓶可以"通入"别的烧杯
isEmpty(beaker) -> boolean
```
`data` 是 `{ SUBSTANCES, IONS, INSOLUBLE, REACTIONS }`，由 `js/data.js` 汇总导出。

## 5. 引擎 API（B 实现，C 调用）

```js
import { react } from './js/engine/index.js';
const { beaker, events } = react(beaker, { heated: false, ignite: false, data });
```
- 纯函数，反复应用规则直到没有反应（上限 50 轮）。
- `events` 按发生顺序排列，每个事件：

```js
{
  kind: 'precipitation',  // precipitation | neutralization | gas | displacement | special | heating
  equation: Equation|null, // 分子方程式（能确定时）
  ionic: Equation|null,    // 离子方程式（离子反应时）
  observations: ['产生白色沉淀'],
  extent: 0.01,            // 反应进度 mol
}
```
- 离子反应（沉淀、中和、放气、置换）都同时给出 `equation`（完整分子方程式，如 `BaCl₂ + H₂SO₄ = BaSO₄↓ + 2HCl`）和 `ionic`。分子方程式里的"配对离子"按溶液里现有的离子猜（优先数量多、且不生成沉淀的），溶液里缺配对离子时 `equation` 为 `null`。

规则模块（`js/engine/*.js`）统一签名：`(beaker, ctx) => null | { beaker, event }`，每次只执行一步。顺序由 `js/engine/index.js` 的 `RULES` 决定：special → precipitation → acidbase → displacement → heating。

### Equation 对象（`js/equation.js`）

```js
{
  reactants: [{ formula: 'BaCl2', n: 1 }],
  products:  [{ formula: 'BaSO4', n: 1, mark: '↓' }],  // mark: '↓' | '↑' | ''
  condition: '',                                       // '' | '加热' | '点燃' | 'MnO2' | '通电' | '高温' ...
}
```
`formula` 用化学式（离子写成 `Ba^2+`），不带 `_conc` 后缀；浓度写 `note: '浓'`。

`js/equation.js` 导出：
```js
parseFormula('Ca(OH)2')     -> { atoms: { Ca: 1, O: 2, H: 2 }, charge: 0 }
checkConservation(eq)       -> { ok, atoms: {元素: 差值}, charge: 差值 }
balance(reactants, products)-> 系数数组或 null（最小整数比）
formatFormula('SO4^2-')     -> 'SO₄²⁻'
formatEquation(eq)          -> 'BaCl₂ + H₂SO₄ = BaSO₄↓ + 2HCl'
```

## 6. 界面（C）

- `js/main.js`：持有应用状态 `{ beakers: [...], log: [...] }`，处理用户操作，调用 `state.js` 和 `react()`，把 `events` 追加进 `log`。
- `js/render.js`：`render(app, root, handlers)` 把状态画成 DOM，只读数据，不改状态。
- 界面只依赖本文件第 4、5 节列出的函数和字段，不直接读引擎内部。
- 必须能在手机竖屏使用。

## 7. 样例（双方对着同一批例子写）

骨架里已有可运行的样例：BaCl₂ + H₂SO₄ → BaSO₄↓（沉淀规则），H₂O₂ 在 MnO₂ 催化下分解（特殊反应）。`npm test` 必须一直是绿的。
