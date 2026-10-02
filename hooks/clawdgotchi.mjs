import { atom, read, update } from 'claude-code'
import { H, POP_MS, frame, widthOf, mirror } from './sprite.mjs'
import { toCells } from './cells.mjs'
import { resolveScene, EAT_MS, HATCH_FROM, MAX_EGG_MS } from './scene.mjs'
import { passportLines } from './passport.mjs'

const reading = atom({ plugin: 'clawdgotchi', key: 'reading' }, null)

const SPRITE_KEY = 'clawd'
const TICK_MS = 125
const COLLAPSE_COLUMNS = 4
const ROWS = H / 2
const PANE_ID = 'clawd'
const SWEEP_TICKS = 16
const STAT_KEYS = ['born', 'sessions', 'eaten', 'pops', 'babies']

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
let mountedColumns = null
let useBlit = true
const babies = new Set()

function sceneAt(now, pct) {
  const hour = new Date(now).getHours()
  return resolveScene({ percent: pct, working, eatUntil, popStart, hatchStart, lastActivity, babies: babies.size, hour }, now)
}

// The passport lives in $.store, shared by every session on the machine: read right before each write.
async function bump($, key, by) {
  try {
    const value = Number((await $.store.get(key)) ?? 0)
    await $.store.set(key, value + by)
  } catch {}
}

async function loadStats($) {
  const stats = {}
  for (const key of STAT_KEYS) {
    try {
      const value = await $.store.get(key)
      if (value != null) stats[key] = value
    } catch {}
  }
  return stats
}

async function sweepBabies($) {
  try {
    const running = new Set((await $.agent.list()).filter((a) => a.status === 'running' || a.status === 'pending').map((a) => a.id))
    for (const id of [...babies]) if (!running.has(id)) babies.delete(id)
  } catch {}
}

async function setReading($, r) {
  percent = r.percent
  await update($, reading, () => r)
}

// usage() leaves tokens out in a fresh window and right after a compaction:
// keep the last reading then, unless the window is new (start, /clear), which starts at zero.
async function refresh($, fresh = false) {
  let context
  try {
    context = (await $.session.usage()).context
  } catch {
    return { r: null, compacted: false }
  }
  if (context.tokens == null) {
    const prev = fresh ? null : await read($, reading)
    if (prev) return { r: prev, compacted: false }
    const r = { tokens: 0, window: context.window, percent: 0 }
    await setReading($, r)
    return { r, compacted: false }
  }
  const r = { tokens: context.tokens, window: context.window, percent: context.percent ?? (context.tokens / context.window) * 100 }
  await setReading($, r)
  if (preCompactTokens != null && r.tokens < preCompactTokens) {
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
  if (babies.size > 0 && t % SWEEP_TICKS === 0) await sweepBabies($)
  if (popStart != null) {
    if (hatchStart == null && preCompactTokens != null && t % 8 === 0) await refresh($)
    if (hatchStart == null && now - popStart > MAX_EGG_MS) hatchStart = now
    if (hatchStart != null && sceneAt(now, percent).popT == null && now - hatchStart >= POP_MS - HATCH_FROM) {
      popStart = null
      hatchStart = null
    }
  }
  if (!rasterShown || bandRequestId == null) return
  const scene = sceneAt(now, percent)
  // blit cannot resize a Raster: a stage change or the pop's wider grid needs a full redraw.
  if (widthOf(scene) !== mountedColumns) {
    $.ui.invalidate('ui.render')
    return
  }
  if (useBlit) {
    let res
    try {
      res = await $.ui.blit({
        requestId: bandRequestId,
        key: SPRITE_KEY,
        columns: mountedColumns,
        rows: ROWS,
        cells: toCells(mirror(frame(scene, t))),
      })
    } catch {
      res = { deny: 'blit threw' }
    }
    if (!(res && res.deny)) return
    useBlit = false
  }
  $.ui.invalidate('ui.render')
}

async function resetSession($) {
  working = false
  babies.clear()
  eatUntil = 0
  popStart = null
  hatchStart = null
  preCompactTokens = null
  lastActivity = await $.clock.now()
  const { r } = await refresh($, true)
  lastTurnTokens = r ? r.tokens : null
}

// Also redraw the band: after a hot reload or a plugin update it still shows the old module's drawing,
// and this instance's tick stays idle until its own ui.render has run.
async function startTimer($) {
  if (!timer) timer = $.clock.every(TICK_MS, () => tick($))
  $.ui.invalidate('ui.render')
}

async function setUp($) {
  try {
    if ((await $.store.get('born')) == null) await $.store.set('born', await $.clock.now())
  } catch {}
  try {
    await $.command.register({ name: 'clawd', description: 'Паспорт Clawd', immediate: true })
  } catch {}
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await resetSession($)
    await setUp($)
    await startTimer($)
    return next(e)
  })

  on('classic.SessionStart', { source: 'startup' }, async ($, e, next) => {
    await bump($, 'sessions', 1)
    return next(e)
  })

  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await resetSession($)
    await startTimer($)
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

  // Subagents show up as babies beside Clawd.
  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (result && result.agentId) {
      babies.add(result.agentId)
      await bump($, 'babies', 1)
    }
    return result
  })

  on('classic.SubagentStop', async ($, e, next) => {
    babies.delete(e.agent_id)
    return next(e)
  })

  on('command.run', { command: 'clawd' }, async ($) => {
    await $.ui.open({ id: PANE_ID, title: 'Clawdgotchi', focus: true, closeOnEscape: true })
    return {}
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e)
    const { Box, Text, Raster } = $.ui.resolve(e)
    const now = await $.clock.now()
    const lines = passportLines(await loadStats($), now).map((line) => Text({ wrap: 'truncate', children: [line] }))
    const info = Box({ flexDirection: 'column', children: lines })
    if (e.surface !== 'terminal') return info
    const scene = sceneAt(now, percent)
    const portrait = Raster({ key: 'clawd-portrait', columns: widthOf(scene), rows: ROWS, cells: toCells(frame(scene, t)) })
    return Box({ flexDirection: 'row', columnGap: 2, children: [portrait, info] })
  })

  on('turn.complete', async ($, e, next) => {
    // A subagent's turn ends while the main turn is still running; its baby leaves.
    if (e.agentId) {
      babies.delete(e.agentId)
      return next(e)
    }
    const result = await next(e)
    working = false
    const now = await $.clock.now()
    lastActivity = now
    const before = lastTurnTokens
    const { r, compacted } = await refresh($)
    if (r && !compacted) {
      if (before != null && r.tokens > before) {
        eatUntil = now + EAT_MS
        await bump($, 'eaten', r.tokens - before)
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

  // next(e) resolves once the compaction is done, so the egg wobbles for exactly as long as it runs.
  on('session.compact', { trigger: ['manual', 'auto', 'plugin'] }, async ($, e, next) => {
    if (e.agentId) return next(e)
    popStart = await $.clock.now()
    hatchStart = null
    const prev = await read($, reading)
    preCompactTokens = prev ? prev.tokens : null
    let result
    try {
      result = await next(e)
    } catch (err) {
      popStart = null
      hatchStart = null
      preCompactTokens = null
      throw err
    }
    if (!result || result.skip) {
      popStart = null
      preCompactTokens = null
      return result
    }
    if (result.tokensAfter != null && prev) {
      await setReading($, { tokens: result.tokensAfter, window: prev.window, percent: (result.tokensAfter / prev.window) * 100 })
      lastTurnTokens = result.tokensAfter
      preCompactTokens = null
      hatchStart = await $.clock.now()
    }
    await bump($, 'pops', 1)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const theirs = await next(e)
    // A band shorter than the sprite would show a scrolled sliver and a "↓ more" line.
    if (e.props.hasSurvey || e.props.maxRows < ROWS) {
      rasterShown = false
      return theirs
    }
    const r = await read($, reading)
    if (!r) {
      rasterShown = false
      return theirs
    }
    // Desktop has no Raster; the band stays as other mods draw it there.
    if (e.surface !== 'terminal') {
      rasterShown = false
      return theirs
    }
    const { Box, Raster } = $.ui.resolve(e)
    const now = await $.clock.now()
    const scene = sceneAt(now, r.percent)
    const columns = widthOf(scene)
    const ours = Box({
      key: 'clawd-row',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      // Leave room for the engine's [-] collapse control in the band's top-right corner.
      width: Math.max(columns, e.props.bodyColumns - COLLAPSE_COLUMNS),
      children: [Raster({ key: SPRITE_KEY, columns, rows: ROWS, cells: toCells(mirror(frame(scene, t))) })],
    })
    bandRequestId = e.requestId
    mountedColumns = columns
    rasterShown = true
    return theirs ? Box({ flexDirection: 'column', children: [ours, theirs] }) : ours
  }).catch(($, e, next) => next(e))
}
