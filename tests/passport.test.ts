import { expect, test } from 'claude-code/testing'
import { fmtTokens, passportLines } from '../hooks/passport.mjs'

const now = new Date(2026, 9, 2, 14, 5).getTime()
const DAY = 86400000

test('token counts read like the status line', () => {
  expect(fmtTokens(980)).toBe('980')
  expect(fmtTokens(134400)).toBe('134.4k')
  expect(fmtTokens(4200000)).toBe('4.2M')
})

test('passport lines', () => {
  const lines = passportLines({ born: now - 3 * DAY - 1000, sessions: 12, eaten: 4200000, pops: 7, babies: 23 }, now)
  expect(lines).toEqual(['Age: 3 days', 'Sessions: 12', 'Ate: 4.2M tokens', 'Popped: 7 times', 'Babies: 23'])
})

test('singulars', () => {
  const lines = passportLines({ born: now - DAY - 1000, sessions: 1, eaten: 1, pops: 1, babies: 1 }, now)
  expect(lines.slice(0, 5)).toEqual(['Age: 1 day', 'Sessions: 1', 'Ate: 1 token', 'Popped: once', 'Babies: 1'])
})

test('a newborn and empty stats', () => {
  const lines = passportLines({}, now)
  expect(lines[0]).toBe('Age: born today')
  expect(lines.slice(1, 5)).toEqual(['Sessions: 0', 'Ate: 0 tokens', 'Popped: never', 'Babies: 0'])
})
