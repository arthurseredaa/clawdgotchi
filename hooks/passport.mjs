const DAY_MS = 24 * 60 * 60 * 1000

export function fmtTokens(n) {
  const a = Math.abs(n)
  if (a >= 1e6) return `${+(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${+(a / 1e3).toFixed(1)}k`
  return String(Math.round(a))
}

export function plural(n, one, few, many) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function ageText(born, now) {
  const days = Math.floor((now - born) / DAY_MS)
  if (!(days >= 1)) return 'народився сьогодні'
  return `${days} ${plural(days, 'день', 'дні', 'днів')}`
}

const pad = (n) => String(n).padStart(2, '0')

// stats: { born, sessions, eaten, pops, babies }, any of them missing on a fresh install.
export function passportLines(stats, now) {
  const { born = now, sessions = 0, eaten = 0, pops = 0, babies = 0 } = stats
  const clock = new Date(now)
  return [
    `Вік: ${ageText(born, now)}`,
    `Сесій: ${sessions}`,
    `З’їв: ${fmtTokens(eaten)} токенів`,
    `Лускав: ${pops} ${plural(pops, 'раз', 'рази', 'разів')}`,
    `Дітей: ${babies}`,
    `Годинник Clawd: ${pad(clock.getHours())}:${pad(clock.getMinutes())}`,
  ]
}
