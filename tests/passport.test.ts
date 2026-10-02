import { expect, test } from 'claude-code/testing'
import { fmtTokens, plural, passportLines } from '../hooks/passport.mjs'

const now = new Date(2026, 9, 2, 14, 5).getTime()
const DAY = 86400000

test('token counts read like the status line', () => {
  expect(fmtTokens(980)).toBe('980')
  expect(fmtTokens(134400)).toBe('134.4k')
  expect(fmtTokens(4200000)).toBe('4.2M')
})

test('Ukrainian plurals', () => {
  expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => plural(n, 'раз', 'рази', 'разів'))).toEqual(['раз', 'рази', 'разів', 'разів', 'разів', 'раз', 'рази', 'разів', 'разів'])
})

test('passport lines', () => {
  const lines = passportLines({ born: now - 3 * DAY - 1000, sessions: 12, eaten: 4200000, pops: 7, babies: 23 }, now)
  expect(lines).toEqual(['Вік: 3 дні', 'Сесій: 12', 'З’їв: 4.2M токенів', 'Лускав: 7 разів', 'Дітей: 23', 'Годинник Clawd: 14:05'])
})

test('a newborn and empty stats', () => {
  const lines = passportLines({}, now)
  expect(lines[0]).toBe('Вік: народився сьогодні')
  expect(lines.slice(1, 5)).toEqual(['Сесій: 0', 'З’їв: 0 токенів', 'Лускав: 0 разів', 'Дітей: 0'])
})
