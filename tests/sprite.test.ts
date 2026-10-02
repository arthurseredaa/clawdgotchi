import { expect, test } from 'claude-code/testing'
import { H, STAGES, COLORS, POP_WIDTH, BABY_SLOT, stageOf, frame, widthOf, mirror, glyphsOf, mirrorGlyphs } from '../hooks/sprite.mjs'

const MODES = ['idle', 'work', 'sleep', 'eat', 'sleepy'] as const
const mask = (row: (number | null)[]) => row.map((c) => (c == null ? 0 : 1)).join('')
const legCols = (grid: (number | null)[][]) => grid[H - 1].flatMap((c, i) => (c == null ? [] : [i]))

test('stage boundaries', () => {
  const cases: [number, number][] = [[0, 0], [24, 0], [25, 1], [49, 1], [50, 2], [74, 2], [75, 3], [89, 3], [90, 4], [100, 4], [130, 4], [NaN, 0]]
  for (const [p, s] of cases) expect(stageOf(p)).toBe(s)
})

test('grid is as narrow as the stage needs', () => {
  expect([0, 1, 2, 3, 4].map((stage) => widthOf({ stage, mode: 'idle', popT: null }))).toEqual([16, 18, 18, 20, 22])
  expect(widthOf({ stage: 0, mode: 'idle', popT: 900 })).toBe(POP_WIDTH)
  for (let stage = 0; stage < 5; stage++) for (const mode of MODES) for (let t = 0; t < 24; t++) {
    const scene = { stage, mode, popT: null }
    const g = frame(scene, t)
    expect(g.length).toBe(H)
    for (const row of g) expect(row.length).toBe(widthOf(scene))
  }
})

test('Clawd hugs the left edge so the text sits next to him', () => {
  for (let stage = 0; stage < 5; stage++) {
    const g = frame({ stage, mode: 'idle', popT: null }, 0)
    const firstCol = Math.min(...g.map((row) => row.findIndex((c) => c != null)).filter((i) => i >= 0))
    expect(firstCol <= 2).toBe(true)
  }
})

test('legs stay planted in every mode and frame', () => {
  for (let stage = 0; stage < 5; stage++) {
    const ref = mask(frame({ stage, mode: 'idle', popT: null }, 0)[H - 1])
    for (const mode of MODES) for (let t = 0; t < 48; t++) {
      expect(mask(frame({ stage, mode, popT: null }, t)[H - 1])).toBe(ref)
    }
  }
  expect(legCols(frame({ stage: 0, mode: 'idle', popT: null }, 0))).toEqual([3, 5, 8, 10])
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
  for (const c of [3, 5, 8, 10]) expect(hatched.includes(c)).toBe(true)
})

test('mirrored Clawd stands at the right edge with his feet fixed from it at every stage', () => {
  for (let stage = 0; stage < 5; stage++) {
    const g = mirror(frame({ stage, mode: 'idle', popT: null }, 0))
    const w = g[0].length
    const bw = STAGES[stage].bw
    const fromRight = legCols(g).map((c) => w - 1 - c).sort((a, b) => a - b)
    expect(fromRight).toEqual([3, 5, bw - 2, bw])
    const rightmost = Math.max(...g.map((row) => row.findLastIndex((c) => c != null)))
    expect(rightmost >= w - 3).toBe(true)
  }
})

const pixels = (g: (number | null)[][], color: number) =>
  g.flatMap((row, y) => row.flatMap((c, x) => (c === color ? [[x, y]] : [])))



test('sleepy: eyes half shut, no z', () => {
  const g = frame({ stage: 0, mode: 'sleepy', popT: null }, 5)
  const eyes = pixels(g, COLORS.eye)
  expect(eyes.length > 0).toBe(true)
  expect(new Set(eyes.map(([, y]) => y)).size).toBe(1)
  expect(pixels(g, COLORS.z).length).toBe(0)
})

test('babies stand to the side, each on its own feet, and widen the grid', () => {
  const alone = frame({ stage: 0, mode: 'idle', popT: null }, 0)
  const two = frame({ stage: 0, mode: 'idle', popT: null, babies: 2 }, 0)
  expect(BABY_SLOT).toBe(7)
  expect(widthOf({ stage: 0, mode: 'idle', popT: null, babies: 2 })).toBe(widthOf({ stage: 0, mode: 'idle', popT: null }) + 2 * BABY_SLOT)
  expect(two[0].length).toBe(alone[0].length + 2 * BABY_SLOT)
  expect(legCols(two).slice(0, 4)).toEqual(legCols(alone))
  expect(legCols(two).length).toBe(4 + 2 * 2)
  for (let t = 0; t < 24; t++) {
    expect(legCols(frame({ stage: 0, mode: 'work', popT: null, babies: 2 }, t))).toEqual(legCols(two))
  }
})

test('a baby has a whole head: a solid top row, eyes one row below', () => {
  const scene = { stage: 0, mode: 'idle', popT: null, babies: 1 }
  const g = frame(scene, 5)
  const x0 = widthOf({ stage: 0, mode: 'idle', popT: null })
  expect(g[H - 4].slice(x0, x0 + 5).every((c) => c === COLORS.base)).toBe(true)
  expect(g[H - 3][x0 + 1]).toBe(COLORS.eye)
  expect(g[H - 3][x0 + 3]).toBe(COLORS.eye)
  expect(g[H - 5].slice(x0, x0 + 5).every((c) => c == null)).toBe(true)
})

test('sleeping shows real z letters beside him, not a pixel blob', () => {
  const scene = { stage: 0, mode: 'sleep', popT: null }
  const w = widthOf(scene)
  const seen = new Set<string>()
  for (let t = 0; t < 32; t++) {
    expect(pixels(frame(scene, t), COLORS.z).length).toBe(0)
    for (const g of glyphsOf(scene, t)) {
      seen.add(g.ch)
      expect(g.row >= 0 && g.row < H / 2).toBe(true)
      expect(g.x >= w - 3 && g.x < w).toBe(true)
    }
  }
  expect([...seen].sort()).toEqual(['Z', 'z'])
  expect(glyphsOf(scene, 12).map((g) => g.ch)).toEqual(['z', 'z', 'Z'])
  expect(glyphsOf({ stage: 0, mode: 'idle', popT: null }, 12)).toEqual([])
  expect(glyphsOf({ stage: 0, mode: 'sleepy', popT: null }, 12)).toEqual([])
})

test('mirrored glyphs move to the other side', () => {
  expect(mirrorGlyphs([{ x: 14, row: 1, ch: 'z', color: 1 }], 16)).toEqual([{ x: 1, row: 1, ch: 'z', color: 1 }])
})

test('asleep, his body stays perfectly still', () => {
  for (let stage = 0; stage < 4; stage++) {
    const still = mask(frame({ stage, mode: 'sleep', popT: null }, 0).flat())
    for (let t = 1; t < 48; t++) expect(mask(frame({ stage, mode: 'sleep', popT: null }, t).flat())).toBe(still)
  }
})
