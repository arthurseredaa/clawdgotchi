import { expect, test } from 'claude-code/testing'
import { resolveScene, popTime, SLEEP_MS } from '../hooks/scene.mjs'

const base = { percent: 10, working: false, eatUntil: 0, popStart: null, hatchStart: null, lastActivity: 0 }

test('idle by default with stage from percent', () => {
  expect(resolveScene(base, 1000)).toEqual({ stage: 0, mode: 'idle', popT: null, babies: 0 })
  expect(resolveScene({ ...base, percent: 80 }, 1000).stage).toBe(3)
})

test('priority: pop > eat > work > sleep > idle', () => {
  expect(resolveScene({ ...base, working: true }, 1000).mode).toBe('work')
  expect(resolveScene({ ...base, working: true, eatUntil: 2000 }, 1000).mode).toBe('eat')
  expect(resolveScene({ ...base, eatUntil: 2000, popStart: 900 }, 1000)).toEqual({ stage: 0, mode: 'idle', popT: 100, babies: 0 })
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

test('a fast compaction still plays the whole burst before hatching', () => {
  expect(popTime(0, 100, 900)).toBe(900)
  expect(popTime(0, 100, 1700)).toBe(2100)
})

const at = (hour: number) => new Date(2026, 9, 2, hour, 30).getTime()
const day = { ...base, lastActivity: at(14), babies: 0, hour: 14 }
const night = (hour: number, extra = {}) => resolveScene({ ...day, hour, lastActivity: at(hour), ...extra }, at(hour))


test('night: sleepy late evening, asleep in the small hours even while working', () => {
  expect(night(23).mode).toBe('sleepy')
  expect(night(0).mode).toBe('sleepy')
  expect(night(1).mode).toBe('sleepy')
  expect(night(3, { working: true }).mode).toBe('sleep')
  expect(night(6, { working: true }).mode).toBe('work')
  expect(night(14).mode).toBe('idle')
})

test('no hour given means no night mode', () => {
  expect(resolveScene({ ...day, hour: undefined }, at(14)).mode).toBe('idle')
})

test('babies are capped at three', () => {
  expect(resolveScene({ ...day, babies: 2 }, at(14)).babies).toBe(2)
  expect(resolveScene({ ...day, babies: 7 }, at(14)).babies).toBe(3)
  expect(resolveScene(day, at(14)).babies).toBe(0)
})
