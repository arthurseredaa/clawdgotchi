import { expect, mock, test } from 'claude-code/testing'
import { COLORS, STAGES } from '../hooks/sprite.mjs'

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

const decode = (b64: string) => {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
  return Array.from(new Uint32Array(bytes.buffer))
}

async function sprite(ui: any) {
  const el = await ui.find({ key: 'clawd' })
  return { columns: el!.props.columns, cells: decode(el!.props.cells) }
}

function stubs(on: any, usage: { tokens?: number }) {
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      cost: 0,
      rateLimits: [],
      context: usage.tokens == null ? { window: 200000 } : { tokens: usage.tokens, window: 200000, percent: usage.tokens / 2000 },
    },
  }))
  on('session.start', () => ({ cwd: '/work' }))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine'] }))
}

test('band shows only Clawd, sized and colored for the stage', async ($, on) => {
  mock.clock(on)
  const usage = { tokens: 112200 }
  stubs(on, usage)
  on('ui.blit', () => ({ value: {} }))
  await $.session.start(START)
  await $.turn.start({ turnId: 't1' })
  usage.tokens = 124600
  await $.turn.complete(DONE)
  const ui = await $.ui.mount(BAND)
  const { columns, cells } = await sprite(ui)
  expect(columns).toBe(18)
  expect(cells.includes(STAGES[2].color)).toBe(true)
  const row = await ui.find({ key: 'clawd-row' })
  expect(row!.props.justifyContent).toBe('flex-end')
  expect(await ui.find({ type: 'Text', text: /%/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('fresh session without a response yet shows Clawd at 0%', async ($, on) => {
  mock.clock(on)
  stubs(on, {})
  await $.session.start(START)
  const ui = await $.ui.mount(BAND)
  const { columns, cells } = await sprite(ui)
  expect(columns).toBe(16)
  expect(cells.includes(STAGES[0].color)).toBe(true)
  await ui.unmount()
})

test('usage failing: draws only what the engine draws', async ($, on) => {
  mock.clock(on)
  on('session.usage', () => ({ deny: 'offline' }))
  on('session.start', () => ({ cwd: '/work' }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine'] }))
  await $.session.start(START)
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ key: 'clawd' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('yields the band to a survey', async ($, on) => {
  mock.clock(on)
  stubs(on, { tokens: 50000 })
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true } })
  expect(await ui.find({ key: 'clawd' })).toBeUndefined()
  await ui.unmount()
})

test('desktop has no Raster, so the mod leaves the band alone there', async ($, on) => {
  mock.clock(on)
  stubs(on, { tokens: 124600 })
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'clawd' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /%/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('narrow terminal keeps the sprite', async ($, on) => {
  mock.clock(on)
  stubs(on, { tokens: 124600 })
  on('ui.blit', () => ({ value: {} }))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 30 } })
  expect(await ui.find({ key: 'clawd' })).toBeDefined()
  await ui.unmount()
})

test('animation stops calling blit once it is refused', async ($, on) => {
  const clock = mock.clock(on)
  stubs(on, { tokens: 50000 })
  let blits = 0
  on('ui.blit', () => {
    blits += 1
    return { value: { deny: 'not mounted' } }
  })
  await $.session.start(START)
  const ui = await $.ui.mount(BAND)
  await clock.advance(1000)
  expect(blits).toBe(1)
  expect(await ui.find({ key: 'clawd' })).toBeDefined()
  await ui.unmount()
})

test('compaction: egg while it runs, then hatches small', async ($, on) => {
  const clock = mock.clock(on)
  const usage: { tokens?: number } = { tokens: 184000 }
  stubs(on, usage)
  on('ui.blit', () => ({ value: {} }))
  on('session.compact', async () => {
    await clock.sleep(5000)
    return { messages: [{ role: 'user', text: 'summary', toolUses: [] }], tokensBefore: 184000, tokensAfter: 34000 }
  })
  await $.session.start(START)
  const compacting = $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hello', toolUses: [] }] })
  await clock.advance(3000)
  let ui = await $.ui.mount(BAND)
  const cells = decode((await ui.find({ key: 'clawd' }))!.props.cells)
  expect(cells.includes(COLORS.egg)).toBe(true)
  await ui.unmount()
  usage.tokens = undefined
  await clock.advance(2500)
  await compacting
  await clock.advance(1000)
  ui = await $.ui.mount(BAND)
  const hatched = await sprite(ui)
  expect(hatched.columns).toBe(16)
  expect(hatched.cells.includes(STAGES[0].color)).toBe(true)
  expect(hatched.cells.includes(COLORS.egg)).toBe(false)
  await ui.unmount()
})

test('after /clear the band reads usage again', async ($, on) => {
  mock.clock(on)
  stubs(on, { tokens: 20000 })
  on('classic.SessionStart', () => ({}))
  await $.classic.SessionStart({ source: 'clear' })
  const ui = await $.ui.mount(BAND)
  expect((await sprite(ui)).cells.includes(STAGES[0].color)).toBe(true)
  await ui.unmount()
})

test('a subagent finishing does not end the main turn or feed Clawd', async ($, on) => {
  mock.clock(on)
  const usage = { tokens: 20000 }
  stubs(on, usage)
  on('ui.blit', () => ({ value: {} }))
  await $.session.start(START)
  await $.turn.start({ turnId: 't1' })
  usage.tokens = 60000
  await $.turn.complete({ ...DONE, turnId: 's1', agentId: 'agent-1' })
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, isWorking: true } })
  const work = decode((await ui.find({ key: 'clawd' }))!.props.cells)
  await ui.unmount()
  // Same scene, drawn from a fresh mount with the main turn finished, must differ: work mode sways the body.
  await $.turn.complete(DONE)
  const ui2 = await $.ui.mount(BAND)
  const after = decode((await ui2.find({ key: 'clawd' }))!.props.cells)
  await ui2.unmount()
  expect(work.join(',') !== after.join(',')).toBe(true)
})

test('after /clear Clawd starts empty even before the first reply', async ($, on) => {
  mock.clock(on)
  const usage: { tokens?: number } = { tokens: 180000 }
  stubs(on, usage)
  on('classic.SessionStart', () => ({}))
  await $.session.start(START)
  usage.tokens = undefined
  await $.classic.SessionStart({ source: 'clear' })
  const ui = await $.ui.mount(BAND)
  const { columns, cells } = await sprite(ui)
  expect(columns).toBe(16)
  expect(cells.includes(STAGES[0].color)).toBe(true)
  expect(cells.includes(STAGES[4].color)).toBe(false)
  await ui.unmount()
})

test('a failed compaction does not leave the egg on screen', async ($, on) => {
  const clock = mock.clock(on)
  stubs(on, { tokens: 184000 })
  on('ui.blit', () => ({ value: {} }))
  on('session.compact', () => {
    throw new Error('compaction failed')
  })
  await $.session.start(START)
  try {
    await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hello', toolUses: [] }] })
  } catch {}
  await clock.advance(3000)
  const ui = await $.ui.mount(BAND)
  const cells = decode((await ui.find({ key: 'clawd' }))!.props.cells)
  expect(cells.includes(COLORS.egg)).toBe(false)
  await ui.unmount()
})

function storeStub(on: any) {
  const saved = new Map<string, unknown>()
  on('store.get', ($: any, e: any) => ({ value: saved.get(e.key) }))
  on('store.set', ($: any, e: any) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  return saved
}



test('each running subagent stands beside Clawd as a baby', async ($, on) => {
  mock.clock(on)
  stubs(on, { tokens: 20000 })
  let n = 0
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a' + ++n }))
  await $.session.start(START)
  await $.agent.spawn({ prompt: 'one', description: 'one' })
  await $.agent.spawn({ prompt: 'two', description: 'two' })
  let ui = await $.ui.mount(BAND)
  expect((await sprite(ui)).columns).toBe(16 + 2 * 7)
  await ui.unmount()
  await $.turn.complete({ ...DONE, turnId: 's1', agentId: 'a1' })
  ui = await $.ui.mount(BAND)
  expect((await sprite(ui)).columns).toBe(16 + 7)
  await ui.unmount()
})

test('babies whose subagent is no longer running are swept away', async ($, on) => {
  const clock = mock.clock(on)
  stubs(on, { tokens: 20000 })
  on('ui.blit', () => ({ value: {} }))
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'lost' }))
  on('agent.list', () => ({ value: [{ id: 'lost', description: 'x', type: 'Explore', status: 'completed' }] }))
  await $.session.start(START)
  await $.agent.spawn({ prompt: 'x', description: 'x' })
  await clock.advance(3000)
  const ui = await $.ui.mount(BAND)
  expect((await sprite(ui)).columns).toBe(16)
  await ui.unmount()
})

test('/clawd opens a passport that remembers across sessions', async ($, on) => {
  mock.clock(on, { now: new Date(2026, 9, 2, 14, 5).getTime() })
  const usage = { tokens: 20000 }
  stubs(on, usage)
  const saved = storeStub(on)
  saved.set('sessions', 4)
  on('command.register', () => ({ value: undefined }))
  on('classic.SessionStart', () => ({}))
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'k1' }))
  let opened = ''
  on('ui.open', ($: any, e: any) => {
    opened = e.id
    return { value: { isPlaced: true } }
  })
  await $.session.start(START)
  await $.classic.SessionStart({ source: 'startup' })
  await $.turn.start({ turnId: 't1' })
  usage.tokens = 32400
  await $.turn.complete(DONE)
  await $.agent.spawn({ prompt: 'x', description: 'x' })
  await $.command.run({ command: 'clawd', args: '' })
  expect(opened).toBe('clawd')
  const pane = await $.ui.mount({
    plugin: 'clawdgotchi',
    component: 'Pane',
    requestId: 'clawd',
    surface: 'terminal',
    viewport: { columns: 100, rows: 30 },
    props: { title: 'Clawdgotchi', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 10 }, view: {} },
  })
  expect(await pane.find({ type: 'Text', text: 'Вік: народився сьогодні' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Сесій: 5' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'З’їв: 12.4k токенів' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Дітей: 1' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Годинник Clawd: 14:05' })).toBeDefined()
  await pane.unmount()
})

test('in the small hours Clawd sleeps even while Claude works', async ($, on) => {
  mock.clock(on, { now: new Date(2026, 9, 2, 3, 0).getTime() })
  stubs(on, { tokens: 20000 })
  await $.session.start(START)
  await $.turn.start({ turnId: 't1' })
  const ui = await $.ui.mount(BAND)
  expect((await sprite(ui)).cells.includes(COLORS.z)).toBe(true)
  await ui.unmount()
})

test('a band too short for the sprite draws nothing instead of a scrolled sliver', async ($, on) => {
  mock.clock(on)
  stubs(on, { tokens: 20000 })
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, maxRows: 3 } })
  expect(await ui.find({ key: 'clawd' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})
