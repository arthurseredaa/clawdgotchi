export const H = 8
export const POP_MS = 2600

// Clawd stands at a fixed left edge; the grid is as wide as his stage needs plus room on the right for effects.
const LEFT = 2
const EFFECTS = 3
const widthForBody = (bw) => LEFT + bw + 1 + EFFECTS

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

export const POP_WIDTH = widthForBody(16)
// Each subagent baby takes a 5-pixel body plus room to sway without touching its neighbour.
export const BABY_SLOT = 7

function baseWidth(scene) {
  if (scene.popT != null && scene.popT < POP_MS) return POP_WIDTH
  return widthForBody(STAGES[scene.stage].bw)
}

export function widthOf(scene) {
  return baseWidth(scene) + (scene.babies || 0) * BABY_SLOT
}

function blank(w) {
  return Array.from({ length: H }, () => Array(w).fill(null))
}

function put(g, x, y, c) {
  x = Math.round(x)
  y = Math.round(y)
  if (y >= 0 && y < H && x >= 0 && x < g[0].length) g[y][x] = c
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
  const legLeft = LEFT
  const sq = Math.max(0, Math.min(o.squash || 0, o.leg - 1))
  const top = ground - o.leg + 1 - o.bh + sq
  const left = LEFT - Math.round((o.bw - legBw) / 2) + (o.dx || 0)
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
  const x = geo.right + 2
  const y = geo.top - ph
  for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]]) put(g, x + dx, y + dy, COLORS.z)
}

function drawCrumbs(g, geo, t) {
  const target = geo.right + 2
  const edge = g[0].length - 1
  ;[COLORS.crumb, COLORS.sweat, COLORS.crumb2].forEach((col, i) => {
    const p = ((t + i * 3) % 9) / 9
    put(g, edge - p * (edge - target), geo.top + i, col)
  })
}

// A baby is a 5x3 body (solid crown, eyes on the middle row) on two 1-pixel legs;
// while the parent works, babies sway in turn.
function drawBaby(g, x0, i, scene, t) {
  const ground = H - 1
  const color = COLORS.base
  const dx = scene.mode === 'work' && Math.floor((t + i * 2) / 2) % 2 ? 1 : 0
  put(g, x0 + 1, ground, color)
  put(g, x0 + 3, ground, color)
  for (let r = ground - 3; r < ground; r++) for (let c = 0; c < 5; c++) put(g, x0 + c + dx, r, color)
  if ((t + i * 7) % 30 >= 2) {
    put(g, x0 + 1 + dx, ground - 2, COLORS.eye)
    put(g, x0 + 3 + dx, ground - 2, COLORS.eye)
  }
}

function drawPop(g, pt, t) {
  const s4 = STAGES[4]
  const cx = LEFT + s4.bw / 2
  const eggX = LEFT + STAGES[0].bw / 2
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
      const l = Math.round(eggX - w / 2) + dx
      for (let c = 0; c < w; c++) put(g, l + c, top + r, COLORS.egg)
    })
    put(g, eggX - 1 + dx, top + 1, COLORS.base)
    put(g, eggX + 1 + dx, top + 3, COLORS.base)
    if (pt > 2000) for (let k = 0; k < 5; k++) put(g, eggX - 2 + k + dx, top + 2 + (k % 2), COLORS.eggCrack)
    return
  }
  drawClawd(g, { ...STAGES[0], squash: pt < 2450 ? 1 : 0 })
  put(g, 0, H - 1, COLORS.egg)
  put(g, LEFT + STAGES[0].bw + 2, H - 1, COLORS.egg)
  put(g, LEFT + STAGES[0].bw + 3, H - 1, COLORS.egg)
}

// Clawd lives in the right corner: flip the grid so he hugs the right edge and effects appear on his left.
export function mirror(grid) {
  return grid.map((row) => [...row].reverse())
}

export function frame(scene, t) {
  const g = blank(widthOf(scene))
  const babiesFrom = baseWidth(scene)
  for (let i = 0; i < (scene.babies || 0); i++) drawBaby(g, babiesFrom + i * BABY_SLOT, i, scene, t)
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
  if (m === 'sleep' || m === 'sleepy') {
    o.eyes = 'closed'
    o.squash = Math.floor(t / 8) % 2
  }
  if (m === 'eat') {
    o.legBw = o.bw
    o.bw += (Math.floor(t / 2) % 2) * 2
    o.squash = Math.floor(t / 2) % 2
  }
  o.blink = m !== 'sleep' && m !== 'sleepy' && s.eyes === 'dot' && t % 24 < 2 && t > 0
  const geo = drawClawd(g, o)
  if (m === 'sleep') drawZ(g, geo, t)
  if (m === 'eat') drawCrumbs(g, geo, t)
  if (s.eyes === 'squint' && m !== 'sleep') put(g, geo.right + 2, geo.top + (Math.floor(t / 2) % 4), COLORS.sweat)
  return g
}
