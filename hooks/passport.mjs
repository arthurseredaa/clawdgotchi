const DAY_MS = 24 * 60 * 60 * 1000

export function fmtTokens(n) {
  const a = Math.abs(n)
  if (a >= 1e6) return `${+(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${+(a / 1e3).toFixed(1)}k`
  return String(Math.round(a))
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`

function ageText(born, now) {
  const days = Math.floor((now - born) / DAY_MS)
  if (!(days >= 1)) return 'born today'
  return count(days, 'day', 'days')
}

function popsText(pops) {
  if (pops === 0) return 'never'
  if (pops === 1) return 'once'
  return `${pops} times`
}

// stats: { born, sessions, eaten, pops, babies }, any of them missing on a fresh install.
export function passportLines(stats, now) {
  const { born = now, sessions = 0, eaten = 0, pops = 0, babies = 0 } = stats
  return [
    `Age: ${ageText(born, now)}`,
    `Sessions: ${sessions}`,
    `Ate: ${eaten === 1 ? '1 token' : `${fmtTokens(eaten)} tokens`}`,
    `Popped: ${popsText(pops)}`,
    `Babies: ${babies}`,
  ]
}
