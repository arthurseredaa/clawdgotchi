# Clawdgotchi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мод Claude Code, що малює над промптом піксельного Clawd, який товстішає з заповненням контексту й лускає на `/compact`; пакет готовий до публікації на GitHub.

**Architecture:** Один хук-модуль `hooks/clawdgotchi.mjs` — єдине місце з `$`. Він слухає події сесії, тримає дані в `$.state` і раз на 125 мс перемальовує спрайт через `$.ui.blit`. Уся логіка винесена в чисті модулі без `$`: `sprite.mjs` (піксельні кадри), `cells.mjs` (кадр → base64 для `Raster`), `band.mjs` (текст смуги), `scene.mjs` (який режим анімації зараз).

**Tech Stack:** Claude Code mods (ES modules, `.mjs`), test kit `claude-code/testing`, `claude plugin validate|test`, herdr для живої перевірки.

**Spec:** `~/Projects/clawdgotchi/docs/spec.md`. Макети: https://claude.ai/artifact/4aQb6jaD1FHqjwmPbhkxn1. Еталонний код спрайта з макета: `/private/tmp/claude-501/-Users-arthursereda/34f7c507-2a87-4cc0-a2b3-c8297773df93/scratchpad/core.js`. У цьому плані він уже перенесений, з кольорами-числами.

## Context

Arthur хоче open-source мод «Clawdgotchi», тамагочі контексту. Дизайн затверджено на макетах, специфікацію написано. Жива перевірка 2026-10-02 на v2.1.284 показала: смуга дає `maxRows = 13`, `Raster` займає рівно 4 рядки, `$.ui.blit` з `requestId: 'above-prompt'` анімує без помилок, смуга лишається на місці, поки Клод працює. Arthur сам створить публічний репозиторій і зробить пуш. Я працюю тільки в `~/Projects/clawdgotchi`.

## Global Constraints

- Робоча папка: `/Users/arthursereda/Projects/clawdgotchi`. Жодних git-операцій (init, commit, push): репозиторій створює Arthur.
- `~/.claude/settings.json` не змінювати. Перевірку встановлення з маркетплейсу робити тільки з тимчасовим `CLAUDE_CONFIG_DIR`.
- Кожен запуск тестів: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test` з кореня проєкту.
- Назва плагіна і маркетплейсу: `clawdgotchi`. GitHub: `arthurseredaa/clawdgotchi`. Ліцензія MIT.
- Смуга: спрайт 20×8 пікселів = `Raster` 20 колонок × 4 рядки, плюс до 4 рядків тексту.
- Тексти інтерфейсу точно такі: стадії `Легкий`, `Ситий`, `Наїдений`, `Роздутий`, `Ось-ось лусне`; заголовок `Clawd · <стадія>`; цифри `62% · 124.6k / 200k`; приріст `▲ +12.4k за останній хід` або `▼ −150k за останній хід` (мінус U+2212).
- Межі стадій: 0–24, 25–49, 50–74, 75–89, 90+.
- Фізика: ноги завжди на нижньому ряду і на тих самих колонках, рухається тільки тіло.
- Правила статичного аналізу модів: `$` є тільки в `hooks/clawdgotchi.mjs`. Кожен виклик пишеться повністю (`$.ui.blit(...)`), без `const ui = $.ui`. Назви подій — рядкові літерали. `$` можна передавати лише у функції верхнього рівня цього ж файлу або в імпортовані `read`/`update` з `claude-code`. Ключі `atom` — рядкові літерали.

## Відхилення від специфікації (на затвердження разом із планом)

1. **Яйце чекає справжнього кінця стиснення.** Компактування — це запит до моделі, воно триває секунди або десятки секунд. Тому після вибуху (1.3 с) яйце хитається, доки `usage()` не покаже, що токенів стало менше. Тоді воно тріскає і Clawd вилуплюється (ще 0.6 с). Запобіжник — 90 с. Специфікація описувала фіксовані 2.6 с, і тоді Clawd повертався б товстим, поки стиснення ще йде.
2. **Порожні половинки клітинок** малюються символами `▄` або пробілом, а не `▀` з кольором за замовчуванням. Інакше порожній верхній піксель зафарбувався б кольором тексту терміналу (білим).
3. **Додатковий чистий модуль `hooks/scene.mjs`** вибирає режим і час анімації. Так пріоритети режимів можна тестувати без `$`.
4. **README англійською** для GitHub-аудиторії. Інтерфейс мода лишається українським.

## Review Focus

1. **Порожні пікселі не повинні світитися білим.** Половинка без кольору має бути прозорою (колір терміналу). Тест у Task 3: `cellOf(null, x)` дає `▄`, а `cellOf(null, null)` — пробіл.
2. **`usage()` падає або ще не відповів.** Смуга не малює Clawd і не ламає вміст інших модів. Тест у Task 6: стаб `session.usage` повертає `deny`, у смузі є тільки вміст рушія.
3. **`$.ui.blit` недоступний.** Мод переходить на `$.ui.invalidate` і більше не викликає `blit`. Тест у Task 6: стаб `ui.blit` повертає `deny`, викликається рівно один раз.
4. **Вікно 1M і відсоток понад 100.** Цифри мають вигляд `1M`, стадія 4, шкала не виходить за 20 символів. Тест у Task 2.
5. **Вузький термінал.** При `bodyColumns: 30` спрайт лишається, текст обрізається. Тест у Task 6.

---

### Task 1: Каркас пакета і звірка API з типами цієї версії

**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json`, `hooks/clawdgotchi.mjs` (тимчасова заглушка), `types/index.d.ts`, `.gitignore`, `docs/plan.md` (копія цього плану), `docs/api-notes.md`

**Interfaces:**
- Produces: `docs/api-notes.md` з перевіреними сигнатурами. Якщо тут щось розходиться з кодом Task 6, Task 6 підлаштовується під нотатки.

- [ ] **Step 1: Скопіювати план у проєкт**

```bash
mkdir -p ~/Projects/clawdgotchi/docs && cp /Users/arthursereda/.claude/plans/zesty-gliding-bubble.md ~/Projects/clawdgotchi/docs/plan.md
```

- [ ] **Step 2: Створити маніфест** `.claude-plugin/plugin.json`

```json
{
  "name": "clawdgotchi",
  "displayName": "Clawdgotchi",
  "version": "0.1.0",
  "description": "A pixel Clawd above your prompt that grows with your context window and pops on /compact.",
  "author": { "name": "Arthur Sereda", "url": "https://github.com/arthurseredaa" },
  "homepage": "https://github.com/arthurseredaa/clawdgotchi",
  "repository": "https://github.com/arthurseredaa/clawdgotchi",
  "license": "MIT",
  "keywords": ["mod", "context-window", "tamagotchi", "pixel-art"],
  "types": "./types/index.d.ts"
}
```

- [ ] **Step 3: Створити** `.claude-plugin/marketplace.json`

```json
{
  "name": "clawdgotchi",
  "owner": { "name": "Arthur Sereda" },
  "plugins": [{ "name": "clawdgotchi", "source": "./" }]
}
```

- [ ] **Step 4: Створити** `hooks/hooks.json`, `types/index.d.ts`, `.gitignore` і заглушку модуля

`hooks/hooks.json`:
```json
{ "modules": ["./clawdgotchi.mjs"] }
```

`types/index.d.ts`:
```ts
export type ClawdReading = { tokens: number; window: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    clawdgotchi: { reading: ClawdReading | null; delta: number | null }
  }
}
```

`.gitignore`:
```
.claude-plugin/types/
tsconfig.json
.DS_Store
```

`hooks/clawdgotchi.mjs` (заглушка, Task 6 замінить її повністю):
```js
export function register(on) {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => next(e))
}
```

- [ ] **Step 5: Валідація**

Run: `cd ~/Projects/clawdgotchi && claude plugin validate .`
Expected: `✔ Validation passed`. Попередження про `types` без використання `$.state` на цьому кроці допустиме.

- [ ] **Step 6: Згенерувати типи, один раз завантаживши мод у herdr**

```bash
cd ~/Projects/clawdgotchi
NEW=$(herdr pane split --pane "$HERDR_PANE_ID" --direction right --ratio 0.5 --cwd "$PWD" --env CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 --no-focus | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['pane']['pane_id'])")
herdr pane run "$NEW" "claude --plugin-dir ."
herdr pane wait-output "$NEW" --regex 'trust this folder|❯' --timeout 30000
herdr pane read "$NEW" --source visible --lines 40
```

Якщо з'явилося питання про довіру до папки: `herdr pane send-keys "$NEW" down enter` (пункт «Yes, I trust this folder»). Потім дочекатися промпту, відправити `/exit` (`herdr pane send-text "$NEW" "/exit"` і `herdr pane send-keys "$NEW" enter`) і закрити панель: `herdr pane close "$NEW"`.

Expected: існує `.claude-plugin/types/claude-code/index.d.ts`.

- [ ] **Step 7: Звірити API і записати** `docs/api-notes.md`

```bash
T=.claude-plugin/types/claude-code/index.d.ts
grep -n "blit\|every(\|now(\|usage(\|'session.compact'\|'session.measure'\|'classic.SessionStart'\|'turn.start'\|'prompt.submit'\|AbovePrompt\|\.catch\|percent" $T | head -80
grep -rn "mount\|find(\|compact\|measure\|classic" .claude-plugin/types/claude-code/testing* 2>/dev/null | head -40
```

Записати відповіді на ці питання:
1. Сигнатура `$.ui.blit` і чи `requestId` смуги — `'above-prompt'`.
2. `$.clock.every(ms, fn)` повертає об'єкт з `cancel()`? `$.clock.now()` асинхронний?
3. `context.percent` — це 0–100 чи 0–1? Якщо 0–1, у Task 6 у `refresh` множити на 100.
4. Вхід і результат `session.compact` (поле `skip`), `session.measure`, `classic.SessionStart` (`source`).
5. Що повертає `next(e)` у `ui.render` для `AbovePrompt`, коли інших модів немає (`null`, `undefined`, engine ref).
6. Чи приймає `Text.color` рядок `'#d97757'`.
7. Сигнатура обробника `.catch(...)`.
8. Як у test kit викликати `session.compact`, `session.measure`, `classic.SessionStart` (`$.session.compact(...)`, `$.classic.SessionStart(...)`) і чи `ui.find({ key })` знаходить `Raster`.

Expected: файл `docs/api-notes.md` з вісьмома пунктами «питання → відповідь з рядком у d.ts».

---

### Task 2: Текст смуги (`band.mjs`)

**Files:**
- Create: `hooks/band.mjs`
- Test: `tests/band.test.ts`

**Interfaces:**
- Consumes: `STAGES`, `stageOf` з `hooks/sprite.mjs` (Task 4). Щоб Task 2 можна було робити першим, створити `sprite.mjs` зі `STAGES` і `stageOf` з Task 4 Step 3 уже тут. Task 4 допише решту файлу.
- Produces: `fmtTokens(n: number): string`, `clampPercent(p: number): number`, `hex(n: number): string`, `titleLine(r): string`, `statsLine(r): string`, `barCounts(percent): { filled: number, empty: number }`, `deltaLine(delta: number | null): string | null`, `desktopLine(r): string`, `BAR = 20`. Тут `r` — це `{ tokens, window, percent }`.

- [ ] **Step 1: Написати тест** `tests/band.test.ts`

```ts
import { expect, test } from 'claude-code/testing'
import { fmtTokens, statsLine, barCounts, deltaLine, titleLine, desktopLine, hex } from '../hooks/band.mjs'

const r = (tokens: number, window = 200000) => ({ tokens, window, percent: (tokens / window) * 100 })

test('fmtTokens', () => {
  expect(fmtTokens(980)).toBe('980')
  expect(fmtTokens(134400)).toBe('134.4k')
  expect(fmtTokens(200000)).toBe('200k')
  expect(fmtTokens(1000000)).toBe('1M')
  expect(fmtTokens(1500000)).toBe('1.5M')
})

test('stats and title', () => {
  expect(statsLine(r(124600))).toBe('62% · 124.6k / 200k')
  expect(titleLine(r(124600))).toBe('Clawd · Наїдений')
  expect(titleLine(r(10000))).toBe('Clawd · Легкий')
  expect(titleLine(r(190000))).toBe('Clawd · Ось-ось лусне')
  expect(desktopLine(r(124600))).toBe('Clawd · Наїдений · 62% · 124.6k / 200k')
})

test('1M window and percent above 100', () => {
  expect(statsLine(r(500000, 1000000))).toBe('50% · 500k / 1M')
  expect(titleLine({ tokens: 260000, window: 200000, percent: 130 })).toBe('Clawd · Ось-ось лусне')
  expect(statsLine({ tokens: 260000, window: 200000, percent: 130 })).toBe('100% · 260k / 200k')
})

test('bar', () => {
  expect(barCounts(0)).toEqual({ filled: 0, empty: 20 })
  expect(barCounts(50)).toEqual({ filled: 10, empty: 10 })
  expect(barCounts(100)).toEqual({ filled: 20, empty: 0 })
  expect(barCounts(130)).toEqual({ filled: 20, empty: 0 })
  expect(barCounts(NaN)).toEqual({ filled: 0, empty: 20 })
})

test('delta line', () => {
  expect(deltaLine(null)).toBe(null)
  expect(deltaLine(12400)).toBe('▲ +12.4k за останній хід')
  expect(deltaLine(0)).toBe('▲ +0 за останній хід')
  expect(deltaLine(-150000)).toBe('▼ −150k за останній хід')
})

test('hex', () => {
  expect(hex(0xd97757)).toBe('#d97757')
  expect(hex(0x0000ff)).toBe('#0000ff')
})
```

- [ ] **Step 2: Запустити, переконатися, що падає**

Run: `cd ~/Projects/clawdgotchi && CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test`
Expected: FAIL для `tests/band.test.ts`, «the file did not load» (немає `hooks/band.mjs`).

- [ ] **Step 3: Реалізувати** `hooks/band.mjs`

```js
import { STAGES, stageOf } from './sprite.mjs'

export const BAR = 20

export function fmtTokens(n) {
  const a = Math.abs(n)
  if (a >= 1e6) return `${+(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${+(a / 1e3).toFixed(1)}k`
  return String(Math.round(a))
}

export function clampPercent(p) {
  return Math.min(100, Math.max(0, Number.isFinite(p) ? p : 0))
}

export function hex(n) {
  return '#' + n.toString(16).padStart(6, '0')
}

export function titleLine(r) {
  return `Clawd · ${STAGES[stageOf(r.percent)].name}`
}

export function statsLine(r) {
  return `${Math.round(clampPercent(r.percent))}% · ${fmtTokens(r.tokens)} / ${fmtTokens(r.window)}`
}

export function barCounts(percent) {
  const filled = Math.round(clampPercent(percent) / 5)
  return { filled, empty: BAR - filled }
}

export function deltaLine(delta) {
  if (delta == null) return null
  return delta >= 0 ? `▲ +${fmtTokens(delta)} за останній хід` : `▼ −${fmtTokens(delta)} за останній хід`
}

export function desktopLine(r) {
  return `${titleLine(r)} · ${statsLine(r)}`
}
```

- [ ] **Step 4: Запустити тести**

Run: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test`
Expected: усі тести `band.test.ts` PASS.

---

### Task 3: Кодування клітинок (`cells.mjs`)

**Files:**
- Create: `hooks/cells.mjs`
- Test: `tests/cells.test.ts`

**Interfaces:**
- Consumes: сітку `grid: (number | null)[][]` висотою 8 і шириною 20 (з Task 4, але тест будує сітку сам).
- Produces: `DEFAULT_COLOR = 0x01000000`, `cellOf(top, bottom): [number, number, number]`, `toCells(grid): string` (base64 з `rows/2 × cols × 3` чисел uint32).

- [ ] **Step 1: Написати тест** `tests/cells.test.ts`

```ts
import { expect, test } from 'claude-code/testing'
import { DEFAULT_COLOR, cellOf, toCells } from '../hooks/cells.mjs'

const decode = (b64: string) => {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
  return Array.from(new Uint32Array(bytes.buffer))
}
const empty = () => Array.from({ length: 8 }, () => Array(20).fill(null))

test('cellOf picks the glyph so empty halves stay transparent', () => {
  expect(cellOf(null, null)).toEqual([0x20, DEFAULT_COLOR, DEFAULT_COLOR])
  expect(cellOf(0xff0000, null)).toEqual([0x2580, 0xff0000, DEFAULT_COLOR])
  expect(cellOf(null, 0x0000ff)).toEqual([0x2584, 0x0000ff, DEFAULT_COLOR])
  expect(cellOf(0x111111, 0x222222)).toEqual([0x2580, 0x111111, 0x222222])
})

test('toCells packs 8x20 pixels into 4x20 cells', () => {
  const g = empty()
  g[0][0] = 0xaaaaaa
  g[1][0] = 0xbbbbbb
  g[7][19] = 0xcccccc
  const n = decode(toCells(g))
  expect(n.length).toBe(4 * 20 * 3)
  expect(n.slice(0, 3)).toEqual([0x2580, 0xaaaaaa, 0xbbbbbb])
  expect(n.slice(-3)).toEqual([0x2584, 0xcccccc, DEFAULT_COLOR])
  expect(n[3]).toBe(0x20)
})
```

- [ ] **Step 2: Запустити, переконатися, що падає**

Run: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test`
Expected: FAIL у `cells.test.ts` (немає модуля).

- [ ] **Step 3: Реалізувати** `hooks/cells.mjs`

```js
export const DEFAULT_COLOR = 0x01000000

const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const SPACE = 0x20

export function cellOf(top, bottom) {
  if (top == null && bottom == null) return [SPACE, DEFAULT_COLOR, DEFAULT_COLOR]
  if (top == null) return [LOWER_HALF, bottom, DEFAULT_COLOR]
  if (bottom == null) return [UPPER_HALF, top, DEFAULT_COLOR]
  return [UPPER_HALF, top, bottom]
}

export function toCells(grid) {
  const nums = []
  for (let r = 0; r + 1 < grid.length; r += 2) {
    for (let c = 0; c < grid[r].length; c++) nums.push(...cellOf(grid[r][c], grid[r + 1][c]))
  }
  return toBase64(new Uint8Array(Uint32Array.from(nums).buffer))
}

function toBase64(bytes) {
  if (typeof bytes.toBase64 === 'function') return bytes.toBase64()
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
```

- [ ] **Step 4: Запустити тести**

Run: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test`
Expected: `cells.test.ts` PASS.

---

### Task 4: Спрайт і анімації (`sprite.mjs`)

**Files:**
- Create/complete: `hooks/sprite.mjs` (у Task 2 тут уже є `STAGES` і `stageOf`)
- Test: `tests/sprite.test.ts`

**Interfaces:**
- Produces: `W = 20`, `H = 8`, `POP_MS = 2600`, `COLORS`, `STAGES` (масив `{ name, bw, bh, leg, round, color, eyes }`), `stageOf(percent): 0..4`, `frame(scene, t): (number | null)[][]`, де `scene = { stage: 0..4, mode: 'idle' | 'work' | 'sleep' | 'eat', popT: number | null }`, а `t` — номер кадру (ціле, 125 мс на кадр).
- Таймлайн `popT` (мс): 0–500 тремтіння (з 380 спалах білим), 500–1300 вибух, 1300–2300 яйце (з 1600 хитається, з 2000 тріщина), 2300–2600 вилуплення стадії 0. При `popT >= POP_MS` малюється звичайний кадр стадії.

- [ ] **Step 1: Написати тест** `tests/sprite.test.ts`

```ts
import { expect, test } from 'claude-code/testing'
import { W, H, STAGES, COLORS, stageOf, frame } from '../hooks/sprite.mjs'

const MODES = ['idle', 'work', 'sleep', 'eat'] as const
const mask = (row: (number | null)[]) => row.map((c) => (c == null ? 0 : 1)).join('')
const legCols = (grid: (number | null)[][]) => grid[H - 1].flatMap((c, i) => (c == null ? [] : [i]))

test('stage boundaries', () => {
  const cases: [number, number][] = [[0, 0], [24, 0], [25, 1], [49, 1], [50, 2], [74, 2], [75, 3], [89, 3], [90, 4], [100, 4], [130, 4], [NaN, 0]]
  for (const [p, s] of cases) expect(stageOf(p)).toBe(s)
})

test('every frame is 8 rows of 20 columns', () => {
  for (let stage = 0; stage < 5; stage++) for (const mode of MODES) for (let t = 0; t < 24; t++) {
    const g = frame({ stage, mode, popT: null }, t)
    expect(g.length).toBe(H)
    for (const row of g) expect(row.length).toBe(W)
  }
})

test('legs stay planted in every mode and frame', () => {
  for (let stage = 0; stage < 5; stage++) {
    const ref = mask(frame({ stage, mode: 'idle', popT: null }, 0)[H - 1])
    for (const mode of MODES) for (let t = 0; t < 48; t++) {
      expect(mask(frame({ stage, mode, popT: null }, t)[H - 1])).toBe(ref)
    }
  }
  expect(legCols(frame({ stage: 0, mode: 'idle', popT: null }, 0))).toEqual([6, 8, 11, 13])
})

test('eyes are drawn when not blinking', () => {
  const g = frame({ stage: 0, mode: 'idle', popT: null }, 5)
  expect(g.flat().includes(COLORS.eye)).toBe(true)
})

test('stage color is used for the body', () => {
  for (let stage = 0; stage < 4; stage++) {
    const g = frame({ stage, mode: 'idle', popT: null }, 0)
    expect(g.flat().includes(STAGES[stage].color)).toBe(true)
  }
})

test('pop sequence draws every phase and ends hatched as stage 0', () => {
  for (const popT of [100, 450, 900, 1500, 1800, 2100, 2500]) {
    expect(frame({ stage: 4, mode: 'idle', popT }, 3).flat().some((c) => c != null)).toBe(true)
  }
  expect(frame({ stage: 4, mode: 'idle', popT: 450 }, 3).flat().includes(COLORS.white)).toBe(true)
  expect(frame({ stage: 4, mode: 'idle', popT: 1800 }, 3).flat().includes(COLORS.egg)).toBe(true)
  const hatched = legCols(frame({ stage: 4, mode: 'idle', popT: 2500 }, 3))
  for (const c of [6, 8, 11, 13]) expect(hatched.includes(c)).toBe(true)
})
```

- [ ] **Step 2: Запустити, переконатися, що падає**

Run: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test`
Expected: FAIL у `sprite.test.ts` (`frame`, `W`, `COLORS` не експортовані).

- [ ] **Step 3: Реалізувати** `hooks/sprite.mjs` (повний файл)

```js
export const W = 20
export const H = 8
export const POP_MS = 2600

export const COLORS = {
  base: 0xd97757,
  eye: 0x141216,
  white: 0xf6f1eb,
  cheek: 0xf59a9a,
  sweat: 0x6fb7ff,
  crack: 0x6e2416,
  alarm: 0xffd45e,
  z: 0xbdb7cc,
  crumb: 0xf5c26b,
  crumb2: 0x9be38f,
  egg: 0xefe6d8,
  eggCrack: 0x7e6e5b,
  flash: 0xff8a5c,
}

export const STAGES = [
  { name: 'Легкий', bw: 10, bh: 5, leg: 2, round: 0, color: 0xd97757, eyes: 'dot' },
  { name: 'Ситий', bw: 12, bh: 5, leg: 2, round: 0, color: 0xdb7253, eyes: 'happy' },
  { name: 'Наїдений', bw: 12, bh: 6, leg: 2, round: 1, color: 0xde6a4c, eyes: 'squint' },
  { name: 'Роздутий', bw: 14, bh: 6, leg: 1, round: 1, color: 0xe25c40, eyes: 'wide' },
  { name: 'Ось-ось лусне', bw: 16, bh: 7, leg: 1, round: 2, color: 0xe8452e, eyes: 'x' },
]

export function stageOf(percent) {
  const p = Number.isFinite(percent) ? percent : 0
  return p >= 90 ? 4 : p >= 75 ? 3 : p >= 50 ? 2 : p >= 25 ? 1 : 0
}

function blank() {
  return Array.from({ length: H }, () => Array(W).fill(null))
}

function put(g, x, y, c) {
  x = Math.round(x)
  y = Math.round(y)
  if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c
}

function cut(r, c, o) {
  if (!o.round) return false
  const rr = Math.min(r, o.bh - 1 - r)
  const cc = Math.min(c, o.bw - 1 - c)
  if (o.round === 1) return rr === 0 && cc === 0
  return (rr === 0 && cc <= 1) || (rr === 1 && cc === 0)
}

function drawEye(g, x, y, o, side) {
  const k = COLORS.eye
  const inward = -side
  if (o.blink || o.eyes === 'closed') {
    put(g, x, y + 1, k)
    put(g, x + inward, y + 1, k)
    return
  }
  switch (o.eyes) {
    case 'dot':
      put(g, x, y, k); put(g, x, y + 1, k)
      break
    case 'happy':
      put(g, x - 1, y + 1, k); put(g, x, y, k); put(g, x + 1, y + 1, k)
      break
    case 'squint':
      put(g, x, y + 1, k); put(g, x + inward, y + 1, k)
      break
    case 'wide':
      put(g, x, y, COLORS.white); put(g, x + inward, y, k)
      put(g, x, y + 1, k); put(g, x + inward, y + 1, k)
      put(g, x + side, y + 2, COLORS.cheek); put(g, x, y + 2, COLORS.cheek)
      break
    case 'x':
      put(g, x - 1, y, k); put(g, x + 1, y, k); put(g, x, y + 1, k)
      put(g, x - 1, y + 2, k); put(g, x + 1, y + 2, k)
      break
  }
}

// Legs stay on the ground row at columns derived from the stage's base width; only the body moves.
function drawClawd(g, o) {
  const ground = H - 1
  const legBw = o.legBw || o.bw
  const legLeft = Math.round(W / 2 - legBw / 2)
  const sq = Math.max(0, Math.min(o.squash || 0, o.leg - 1))
  const top = ground - o.leg + 1 - o.bh + sq
  const left = Math.round(W / 2 - o.bw / 2) + (o.dx || 0)
  for (const lc of [1, 3, legBw - 4, legBw - 2]) {
    for (let y = top + o.bh; y <= ground; y++) put(g, legLeft + lc, y, o.color)
  }
  for (let r = 0; r < o.bh; r++) {
    for (let c = 0; c < o.bw; c++) if (!cut(r, c, o)) put(g, left + c, top + r, o.color)
  }
  const ar = top + o.bh - 3
  for (let r = 0; r < 2; r++) {
    put(g, left - 1, ar + r - (o.armL || 0), o.color)
    put(g, left + o.bw, ar + r - (o.armR || 0), o.color)
  }
  const ex = Math.round(o.bw / 6)
  const ey = top + Math.round((o.bh * 2) / 7)
  drawEye(g, left + ex, ey, o, -1)
  drawEye(g, left + o.bw - 1 - ex, ey, o, 1)
  if (o.cracks) {
    const pts = [[7, 0], [8, 1], [7, 2], [4, o.bh - 2], [5, o.bh - 1], [o.bw - 5, o.bh - 2], [o.bw - 6, o.bh - 1]]
    for (const [c, r] of pts) put(g, left + c, top + r, COLORS.crack)
  }
  return { left, top, right: left + o.bw - 1 }
}

function drawZ(g, geo, t) {
  const ph = Math.floor(t / 4) % 4
  const x = geo.right + 3 + (ph % 2)
  const y = geo.top + 2 - ph
  for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]]) put(g, x + dx, y + dy, COLORS.z)
}

function drawCrumbs(g, geo, t) {
  const target = geo.right + 2
  ;[COLORS.crumb, COLORS.sweat, COLORS.crumb2].forEach((col, i) => {
    const p = ((t + i * 3) % 9) / 9
    put(g, W - 1 - p * (W - 1 - target), geo.top + i, col)
  })
}

function drawPop(g, pt, t) {
  const s4 = STAGES[4]
  const cx = W / 2
  if (pt < 500) {
    drawClawd(g, { ...s4, dx: t % 2 ? 1 : -1, cracks: true, color: pt > 380 ? COLORS.white : s4.color })
    return
  }
  if (pt < 1300) {
    const p = (pt - 500) / 800
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.2
      const v = 0.55 + ((i * 37) % 10) / 20
      const x = cx + Math.cos(a) * v * p * 11
      const y = 4 + Math.sin(a) * v * p * 5 + p * p * 3
      if (p < 0.8 || i % 2) put(g, x, y, [s4.color, COLORS.flash, COLORS.alarm, COLORS.base][i % 4])
    }
    if (p < 0.2) for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) put(g, cx + dx, 4 + dy, COLORS.white)
    return
  }
  if (pt < 2300) {
    const rows = [3, 5, 5, 5, 3]
    const top = H - 5
    const dx = pt > 1600 ? [0, 1, 0, -1][t % 4] : 0
    rows.forEach((w, r) => {
      const l = Math.round(cx - w / 2) + dx
      for (let c = 0; c < w; c++) put(g, l + c, top + r, COLORS.egg)
    })
    put(g, cx - 1 + dx, top + 1, COLORS.base)
    put(g, cx + 1 + dx, top + 3, COLORS.base)
    if (pt > 2000) for (let k = 0; k < 5; k++) put(g, cx - 2 + k + dx, top + 2 + (k % 2), COLORS.eggCrack)
    return
  }
  drawClawd(g, { ...STAGES[0], squash: pt < 2450 ? 1 : 0 })
  put(g, 2, H - 1, COLORS.egg)
  put(g, 3, H - 1, COLORS.egg)
  put(g, W - 3, H - 1, COLORS.egg)
}

export function frame(scene, t) {
  const g = blank()
  if (scene.popT != null && scene.popT < POP_MS) {
    drawPop(g, scene.popT, t)
    return g
  }
  const s = STAGES[scene.stage]
  const m = scene.mode
  const o = { ...s, dx: 0, squash: 0 }
  if (m === 'idle') {
    if (scene.stage <= 1) o.squash = Math.floor(t / 4) % 2
    else if (scene.stage === 2) o.squash = Math.floor(t / 6) % 2
    else if (scene.stage === 3) o.dx = [0, 1, 0, -1][Math.floor(t / 3) % 4]
    else o.dx = [1, -1, 0, 1, -1, 1, 0, -1][t % 8]
  }
  if (scene.stage === 4) {
    o.cracks = true
    if (Math.floor(t / 2) % 2) o.color = COLORS.flash
  }
  if (m === 'work') {
    const w = Math.floor(t / 2) % 2
    o.dx = w ? 1 : 0
    o.armL = w
    o.armR = 1 - w
  }
  if (m === 'sleep') {
    o.eyes = 'closed'
    o.squash = Math.floor(t / 8) % 2
  }
  if (m === 'eat') {
    o.legBw = o.bw
    o.bw += (Math.floor(t / 2) % 2) * 2
    o.squash = Math.floor(t / 2) % 2
  }
  o.blink = m !== 'sleep' && s.eyes === 'dot' && t % 24 < 2 && t > 0
  const geo = drawClawd(g, o)
  if (m === 'sleep') drawZ(g, geo, t)
  if (m === 'eat') drawCrumbs(g, geo, t)
  if (s.eyes === 'squint' && m !== 'sleep') put(g, geo.right + 2, geo.top + (Math.floor(t / 2) % 4), COLORS.sweat)
  return g
}
```

- [ ] **Step 4: Запустити тести**

Run: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test`
Expected: `sprite.test.ts`, `band.test.ts`, `cells.test.ts` PASS. Якщо падає «legs stay planted» для стадії 4: це спалах змінює колір ніг, а маска має порівнювати тільки наявність пікселя. Тест так і написаний, тож помилка в `drawClawd`, у колонках ніг.

---

### Task 5: Вибір режиму (`scene.mjs`)

**Files:**
- Create: `hooks/scene.mjs`
- Test: `tests/scene.test.ts`

**Interfaces:**
- Consumes: `stageOf`, `POP_MS` з `sprite.mjs`.
- Produces: `EAT_MS = 1600`, `SLEEP_MS = 300000`, `HATCH_FROM = 2000`, `EGG_LOOP_FROM = 1600`, `EGG_LOOP_MS = 400`, `MAX_EGG_MS = 90000`, `popTime(popStart, hatchStart, now): number | null`, `resolveScene(s, now): { stage, mode, popT }`. Тут `s = { percent, working, eatUntil, popStart, hatchStart, lastActivity }`.

- [ ] **Step 1: Написати тест** `tests/scene.test.ts`

```ts
import { expect, test } from 'claude-code/testing'
import { resolveScene, popTime, SLEEP_MS } from '../hooks/scene.mjs'

const base = { percent: 10, working: false, eatUntil: 0, popStart: null, hatchStart: null, lastActivity: 0 }

test('idle by default with stage from percent', () => {
  expect(resolveScene(base, 1000)).toEqual({ stage: 0, mode: 'idle', popT: null })
  expect(resolveScene({ ...base, percent: 80 }, 1000).stage).toBe(3)
})

test('priority: pop > eat > work > sleep > idle', () => {
  expect(resolveScene({ ...base, working: true }, 1000).mode).toBe('work')
  expect(resolveScene({ ...base, working: true, eatUntil: 2000 }, 1000).mode).toBe('eat')
  expect(resolveScene({ ...base, eatUntil: 2000, popStart: 900 }, 1000)).toEqual({ stage: 0, mode: 'idle', popT: 100 })
  expect(resolveScene(base, SLEEP_MS).mode).toBe('sleep')
  expect(resolveScene({ ...base, working: true }, SLEEP_MS).mode).toBe('work')
})

test('egg loops until compaction is seen, then hatches', () => {
  expect(popTime(null, null, 500)).toBe(null)
  expect(popTime(0, null, 500)).toBe(500)
  expect(popTime(0, null, 1700)).toBe(1700)
  const looping = popTime(0, null, 20000)!
  expect(looping >= 1600 && looping < 2000).toBe(true)
  expect(popTime(0, 5000, 5100)).toBe(2100)
  expect(popTime(0, 5000, 5700)).toBe(null)
})
```

- [ ] **Step 2: Запустити, переконатися, що падає**

Run: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test`
Expected: FAIL у `scene.test.ts`.

- [ ] **Step 3: Реалізувати** `hooks/scene.mjs`

```js
import { POP_MS, stageOf } from './sprite.mjs'

export const EAT_MS = 1600
export const SLEEP_MS = 5 * 60 * 1000
export const EGG_LOOP_FROM = 1600
export const EGG_LOOP_MS = 400
export const HATCH_FROM = 2000
export const MAX_EGG_MS = 90 * 1000

export function popTime(popStart, hatchStart, now) {
  if (popStart == null) return null
  if (hatchStart != null) {
    const p = HATCH_FROM + (now - hatchStart)
    return p < POP_MS ? p : null
  }
  const elapsed = now - popStart
  if (elapsed < EGG_LOOP_FROM) return elapsed
  return EGG_LOOP_FROM + ((elapsed - EGG_LOOP_FROM) % EGG_LOOP_MS)
}

export function resolveScene(s, now) {
  const stage = stageOf(s.percent)
  const popT = popTime(s.popStart, s.hatchStart, now)
  if (popT != null) return { stage, mode: 'idle', popT }
  if (now < s.eatUntil) return { stage, mode: 'eat', popT: null }
  if (s.working) return { stage, mode: 'work', popT: null }
  if (now - s.lastActivity >= SLEEP_MS) return { stage, mode: 'sleep', popT: null }
  return { stage, mode: 'idle', popT: null }
}
```

- [ ] **Step 4: Запустити тести**

Run: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test`
Expected: усі чотири файли тестів PASS.

---

### Task 6: Хуки мода (`clawdgotchi.mjs`)

**Files:**
- Replace: `hooks/clawdgotchi.mjs`
- Test: `tests/clawdgotchi.test.ts`

**Interfaces:**
- Consumes: `W`, `H`, `STAGES`, `stageOf`, `frame`, `POP_MS` з `sprite.mjs`; `toCells` з `cells.mjs`; `titleLine`, `statsLine`, `barCounts`, `deltaLine`, `desktopLine`, `hex` з `band.mjs`; `resolveScene`, `EAT_MS`, `HATCH_FROM`, `MAX_EGG_MS` з `scene.mjs`; `atom`, `read`, `update` з `claude-code`.
- Produces: мод, що реагує на `session.start`, `classic.SessionStart`, `turn.start`, `prompt.submit`, `turn.complete`, `session.measure`, `session.compact` і малює `ui.render` для `AbovePrompt`.
- Перед кодом звіритися з `docs/api-notes.md`: для `percent` 0–1 у `refresh` множити на 100, а виклики test kit називати так, як записано в нотатках.

- [ ] **Step 1: Написати тест** `tests/clawdgotchi.test.ts`

```ts
import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'clawdgotchi',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  surface: 'terminal',
  viewport: { columns: 100, rows: 30 },
  props: { hasSurvey: false, isWorking: false, maxRows: 13, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const

const DONE = { turnId: 't1', answer: 'ok', durationMs: 1, isAborted: false, usage: null }
const START = { surface: 'terminal', isInteractive: true, cwd: '/work' }

function stubs(on: any, usage: { tokens: number }) {
  on('session.usage', () => ({
    value: { startedAt: 0, cost: 0, rateLimits: [], context: { tokens: usage.tokens, window: 200000, percent: usage.tokens / 2000 } },
  }))
  on('session.start', () => ({}))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine'] }))
}

test('band shows stage, numbers and delta after a turn', async ($, on) => {
  mock.clock(on)
  const usage = { tokens: 112200 }
  stubs(on, usage)
  on('ui.blit', () => ({ value: undefined }))
  await $.session.start(START)
  await $.turn.start({ turnId: 't1' })
  usage.tokens = 124600
  await $.turn.complete(DONE)
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ key: 'clawd' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Clawd · Наїдений' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '62% · 124.6k / 200k' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '▲ +12.4k за останній хід' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('no reading yet: draws only what the engine draws', async ($, on) => {
  mock.clock(on)
  on('session.usage', () => ({ deny: 'offline' }))
  on('session.start', () => ({}))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine'] }))
  await $.session.start(START)
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ key: 'clawd' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('desktop gets one text line and no raster', async ($, on) => {
  mock.clock(on)
  stubs(on, { tokens: 124600 })
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'clawd' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Clawd · Наїдений · 62% · 124.6k / 200k' })).toBeDefined()
  await ui.unmount()
})

test('narrow terminal keeps the sprite', async ($, on) => {
  mock.clock(on)
  stubs(on, { tokens: 124600 })
  on('ui.blit', () => ({ value: undefined }))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 30 } })
  expect(await ui.find({ key: 'clawd' })).toBeDefined()
  await ui.unmount()
})

test('animation falls back to invalidate when blit is refused', async ($, on) => {
  const clock = mock.clock(on)
  stubs(on, { tokens: 50000 })
  let blits = 0
  on('ui.blit', () => {
    blits += 1
    return { deny: 'no blit here' }
  })
  await $.session.start(START)
  const ui = await $.ui.mount(BAND)
  await clock.advance(1000)
  expect(blits).toBe(1)
  expect(await ui.find({ key: 'clawd' })).toBeDefined()
  await ui.unmount()
})

test('compaction pops, hatches small and shows a negative delta', async ($, on) => {
  const clock = mock.clock(on)
  const usage = { tokens: 184000 }
  stubs(on, usage)
  on('ui.blit', () => ({ value: undefined }))
  on('session.compact', () => ({}))
  await $.session.start(START)
  await $.session.compact({ trigger: 'manual' })
  await clock.advance(800)
  usage.tokens = 34000
  await clock.advance(2000)
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'Clawd · Легкий' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '▼ −150k за останній хід' })).toBeDefined()
  await ui.unmount()
})

test('after /clear the band reads usage again', async ($, on) => {
  mock.clock(on)
  stubs(on, { tokens: 20000 })
  on('classic.SessionStart', () => ({}))
  await $.classic.SessionStart({ source: 'clear' })
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'Clawd · Легкий' })).toBeDefined()
  await ui.unmount()
})
```

Імена `$.session.compact(...)` і `$.classic.SessionStart(...)`, а також поля входу `session.compact` взяти з `docs/api-notes.md` (Task 1, пункт 8). Якщо вони інші, підставити справжні.

- [ ] **Step 2: Запустити, переконатися, що падає**

Run: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test`
Expected: FAIL у `clawdgotchi.test.ts` (заглушка нічого не малює).

- [ ] **Step 3: Реалізувати** `hooks/clawdgotchi.mjs` (повний файл)

```js
import { atom, read, update } from 'claude-code'
import { W, H, STAGES, POP_MS, stageOf, frame } from './sprite.mjs'
import { toCells } from './cells.mjs'
import { titleLine, statsLine, barCounts, deltaLine, desktopLine, hex } from './band.mjs'
import { resolveScene, EAT_MS, HATCH_FROM, MAX_EGG_MS } from './scene.mjs'

const reading = atom({ plugin: 'clawdgotchi', key: 'reading' }, null)
const delta = atom({ plugin: 'clawdgotchi', key: 'delta' }, null)

const SPRITE_KEY = 'clawd'
const TICK_MS = 125
const COLUMNS = W
const ROWS = H / 2

// Animation state: fine to lose on hot reload.
let t = 0
let timer = null
let working = false
let eatUntil = 0
let popStart = null
let hatchStart = null
let lastActivity = 0
let percent = 0
let lastTurnTokens = null
let preCompactTokens = null
let rasterShown = false
let bandRequestId = null
let useBlit = true

function sceneAt(now, pct) {
  return resolveScene({ percent: pct, working, eatUntil, popStart, hatchStart, lastActivity }, now)
}

async function refresh($) {
  let r
  try {
    const { context } = await $.session.usage()
    r = { tokens: context.tokens, window: context.window, percent: context.percent }
  } catch {
    return { r: null, compacted: false }
  }
  percent = r.percent
  await update($, reading, () => r)
  if (preCompactTokens != null && r.tokens < preCompactTokens) {
    const d = r.tokens - preCompactTokens
    await update($, delta, () => d)
    lastTurnTokens = r.tokens
    preCompactTokens = null
    hatchStart = await $.clock.now()
    return { r, compacted: true }
  }
  return { r, compacted: false }
}

async function tick($) {
  t += 1
  const now = await $.clock.now()
  if (popStart != null) {
    if (hatchStart == null && t % 8 === 0) await refresh($)
    if (hatchStart == null && now - popStart > MAX_EGG_MS) hatchStart = now
    if (hatchStart != null && now - hatchStart >= POP_MS - HATCH_FROM) {
      popStart = null
      hatchStart = null
    }
  }
  if (!rasterShown || bandRequestId == null) return
  if (useBlit) {
    try {
      await $.ui.blit({
        requestId: bandRequestId,
        key: SPRITE_KEY,
        columns: COLUMNS,
        rows: ROWS,
        cells: toCells(frame(sceneAt(now, percent), t)),
      })
      return
    } catch {
      useBlit = false
    }
  }
  $.ui.invalidate('ui.render')
}

async function resetSession($) {
  working = false
  eatUntil = 0
  popStart = null
  hatchStart = null
  preCompactTokens = null
  lastActivity = await $.clock.now()
  const { r } = await refresh($)
  lastTurnTokens = r ? r.tokens : null
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await resetSession($)
    if (!timer) timer = $.clock.every(TICK_MS, () => tick($))
    return next(e)
  })

  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await resetSession($)
    if (!timer) timer = $.clock.every(TICK_MS, () => tick($))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    working = true
    lastActivity = await $.clock.now()
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    lastActivity = await $.clock.now()
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    working = false
    const now = await $.clock.now()
    lastActivity = now
    const before = lastTurnTokens
    const { r, compacted } = await refresh($)
    if (r && !compacted) {
      if (before != null) {
        const d = r.tokens - before
        await update($, delta, () => d)
        if (d > 0) eatUntil = now + EAT_MS
      }
      lastTurnTokens = r.tokens
    }
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (result && result.skip) return result
    popStart = await $.clock.now()
    hatchStart = null
    const r = await read($, reading)
    preCompactTokens = r ? r.tokens : null
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, reading)
    const d = await read($, delta)
    const theirs = await next(e)
    if (!r) {
      rasterShown = false
      return theirs
    }
    const { Box, Text, Raster } = $.ui.resolve(e)
    const color = hex(STAGES[stageOf(r.percent)].color)
    let ours
    if (e.surface === 'terminal') {
      const now = await $.clock.now()
      const { filled, empty } = barCounts(r.percent)
      const dl = deltaLine(d)
      const bar = []
      if (filled > 0) bar.push(Text({ color, children: ['█'.repeat(filled)] }))
      if (empty > 0) bar.push(Text({ dimColor: true, children: ['░'.repeat(empty)] }))
      const lines = [
        Text({ bold: true, color, wrap: 'truncate', children: [titleLine(r)] }),
        Text({ dimColor: true, wrap: 'truncate', children: [statsLine(r)] }),
        Box({ flexDirection: 'row', children: bar }),
      ]
      if (dl) lines.push(Text({ dimColor: true, wrap: 'truncate', children: [dl] }))
      ours = Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Raster({ key: SPRITE_KEY, columns: COLUMNS, rows: ROWS, cells: toCells(frame(sceneAt(now, r.percent), t)) }),
          Box({ flexDirection: 'column', children: lines }),
        ],
      })
      bandRequestId = e.requestId
      rasterShown = true
    } else {
      ours = Text({ color, wrap: 'truncate', children: [desktopLine(r)] })
      rasterShown = false
    }
    return theirs ? Box({ flexDirection: 'column', children: [ours, theirs] }) : ours
  })
}
```

Якщо `docs/api-notes.md` показує, що `context.percent` — це частка 0–1, замінити в `refresh` на `percent: context.percent * 100`. Якщо `Text.color` не приймає hex, взяти найближчі назви (`'yellow'`, `'red'` тощо) і записати це в нотатки. Якщо `.catch` у типах є, додати до хука `ui.render`: `.catch(($, e, next) => next(e))`.

- [ ] **Step 4: Валідація і тести**

Run: `cd ~/Projects/clawdgotchi && claude plugin validate . && CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test`
Expected: `✔ Validation passed`. У `calls:` є `$.session.usage`, `$.ui.blit`, `$.ui.invalidate`, `$.clock.every`, `$.clock.now`, `$.ui.resolve`. У `state reads/writes:` є `clawdgotchi.reading` і `clawdgotchi.delta`. Усі тести PASS. Якщо тест падає з `no implementation for <name>`, додати стаб з таблиці «Look up what a stub returns» у документації test kit.

---

### Task 7: README, LICENSE і перевірка встановлення

**Files:**
- Create: `README.md`, `LICENSE`

- [ ] **Step 1: Створити** `LICENSE` (MIT)

```
MIT License

Copyright (c) 2026 Arthur Sereda

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Створити** `README.md`

````markdown
# Clawdgotchi

A pixel Clawd that lives above your Claude Code prompt and eats your context window.
The fuller the context, the fatter he gets. Near the limit he shakes and cracks.
Run `/compact` and he pops, turns into an egg, and hatches small again.

<!-- screenshots: docs/stages.png -->

| Context | Stage | What you see |
|---|---|---|
| 0–24% | Легкий (light) | the logo Clawd, blinking and breathing |
| 25–49% | Ситий (fed) | wider, happy `^ ^` eyes |
| 50–74% | Наїдений (stuffed) | taller, squinting, a drop of sweat |
| 75–89% | Роздутий (bloated) | round, red cheeks, swaying |
| 90%+ | Ось-ось лусне (about to pop) | cracks, `×` eyes, flashing and shaking |

He also walks in place while Claude works, munches tokens after each turn, and falls asleep after 5 idle minutes.
The interface text is in Ukrainian.

## Requirements

- Claude Code with mods. The docs list v2.1.287+; it was also tested on v2.1.284.
- Mods are in early access, so turn them on with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`,
  either in your shell or under `env` in `~/.claude/settings.json`.
- A terminal. The Claude desktop app shows a one-line text version instead of the sprite.

## Install

Inside a Claude Code session:

```
/plugin install clawdgotchi --marketplace arthurseredaa/clawdgotchi
```

Or from your shell:

```bash
claude plugin marketplace add arthurseredaa/clawdgotchi
claude plugin install clawdgotchi@clawdgotchi
```

Update with `claude plugin update clawdgotchi@clawdgotchi`.

## Develop

```bash
git clone https://github.com/arthurseredaa/clawdgotchi
cd clawdgotchi
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .   # hot-reloads on save
claude plugin validate .
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test
```

Code layout: `hooks/clawdgotchi.mjs` wires events and drawing; `sprite.mjs`, `cells.mjs`, `band.mjs`, `scene.mjs` are pure and unit-tested.

## Disclaimer

Unofficial fan project, not affiliated with or endorsed by Anthropic. Clawd is Anthropic's character.
No Anthropic logos are included.

## License

MIT
````

- [ ] **Step 3: Строга валідація**

Run: `cd ~/Projects/clawdgotchi && claude plugin validate --strict .`
Expected: `✔ Validation passed` без попереджень.

- [ ] **Step 4: Встановлення з локального маркетплейсу в ізольованому конфігу**

```bash
TMPCFG=$(mktemp -d /private/tmp/claude-501/-Users-arthursereda/34f7c507-2a87-4cc0-a2b3-c8297773df93/scratchpad/cfg.XXXX)
CLAUDE_CONFIG_DIR=$TMPCFG claude plugin marketplace add ~/Projects/clawdgotchi
CLAUDE_CONFIG_DIR=$TMPCFG claude plugin install clawdgotchi@clawdgotchi
CLAUDE_CONFIG_DIR=$TMPCFG claude plugin list
rm -rf "$TMPCFG"
```

Expected: маркетплейс доданий, `clawdgotchi@clawdgotchi` встановлений і в списку. Справжній `~/.claude` не змінено.

---

### Task 8: Жива перевірка в herdr

**Files:** жодних змін, якщо все гаразд. Знахідки виправляються у файлах відповідних задач і перевіряються повторно.

- [ ] **Step 1: Запустити мод у сусідній панелі**

```bash
cd ~/Projects/clawdgotchi
NEW=$(herdr pane split --pane "$HERDR_PANE_ID" --direction right --ratio 0.5 --cwd "$PWD" --env CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 --no-focus | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['pane']['pane_id'])")
herdr pane run "$NEW" "claude --plugin-dir ."
herdr pane wait-output "$NEW" --match 'Clawd ·' --timeout 30000
herdr pane read "$NEW" --source visible --lines 40
```

Expected: над промптом 4 рядки спрайта і `Clawd · Легкий`, `N% · …k / 200k`, шкала. Колір перевірити через `herdr pane read "$NEW" --source visible --format ansi`: у рядках спрайта є `48;2;217;119;87` або близький, а порожні клітинки — пробіли без фону.

- [ ] **Step 2: Анімація, хід і приріст**

Знімки з паузою 0.4 с мають відрізнятися (як у зонді, порівнювати md5 рядків з `▀▄`). Потім `herdr pane send-text "$NEW" "Read README.md and summarize it in one line"` і `herdr pane send-keys "$NEW" enter`, `herdr agent wait "$NEW" --timeout 120000`.
Expected: під час ходу смуга на місці. Після ходу з'являється `▲ +…k за останній хід`.

- [ ] **Step 3: `/compact`**

`herdr pane send-text "$NEW" "/compact"`, `herdr pane send-keys "$NEW" enter`. Кілька знімків протягом стиснення, потім `herdr agent wait "$NEW" --timeout 180000`.
Expected: під час стиснення видно яйце. Після нього `Clawd · Легкий` і `▼ −…k за останній хід`.

- [ ] **Step 4: Прибрати**

`herdr pane close "$NEW"`. Перевірити, що в робочому просторі лишилася тільки моя панель: `herdr pane list --workspace "$HERDR_WORKSPACE_ID"`.

---

## Verification (end-to-end)

1. `claude plugin validate --strict .` → `✔ Validation passed`.
2. `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test` → усі тести 5 файлів PASS (band, cells, sprite, scene, clawdgotchi).
3. Встановлення з локального маркетплейсу в тимчасовому `CLAUDE_CONFIG_DIR` проходить.
4. Жива сесія в herdr: Clawd малюється й анімується, після ходу видно приріст, після `/compact` він вилуплюється маленьким з `▼`.

## Execution

Рекомендую **Native**: задачі йдуть ланцюжком і щільно залежать від інтерфейсів одна одної (sprite → band/scene → hooks), їх лише 8, а головний ризик — розбіжність API, яку краще ловити одній сесії з повним контекстом. Наприкінці — один незалежний рев'ювер на всю гілку. Якщо хочеш subagent-driven (окремий агент і рев'ю на кожну задачу), скажи при затвердженні.
