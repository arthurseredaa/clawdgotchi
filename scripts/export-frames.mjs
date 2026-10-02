// Prints the pixel frames the README media is rendered from, as JSON on stdout.
// Usage: node scripts/export-frames.mjs > frames.json  (scripts/render-media.py runs it for you)
import { frame, mirror, glyphsOf, mirrorGlyphs, POP_MS } from '../hooks/sprite.mjs'
import { passportLines } from '../hooks/passport.mjs'

// One frame: pixel grid g plus glyph cells z ("z z Z" while asleep), mirrored into the right corner like the band.
function shot(scene, t, flip = true) {
  const g = frame(scene, t)
  const z = glyphsOf(scene, t)
  return flip ? { g: mirror(g), z: mirrorGlyphs(z, g[0].length) } : { g, z }
}
const run = (scene, from, count) => Array.from({ length: count }, (_, i) => shot(scene, from + i))

// The pop as the mod plays it: burst, the egg wobbling while the compaction runs, then the hatch.
function popRun(t0) {
  const frames = []
  let t = t0
  for (let pt = 0; pt < 1600; pt += 125) frames.push(shot({ stage: 4, mode: 'idle', popT: pt }, t++))
  for (let i = 0; i < 12; i++) frames.push(shot({ stage: 4, mode: 'idle', popT: 1600 + ((i * 125) % 400) }, t++))
  for (let pt = 2000; pt < POP_MS; pt += 125) frames.push(shot({ stage: 4, mode: 'idle', popT: pt }, t++))
  return frames
}

const hero = [
  ...run({ stage: 0, mode: 'idle', popT: null }, 0, 24),
  ...run({ stage: 0, mode: 'work', popT: null }, 24, 16),
  ...run({ stage: 1, mode: 'eat', popT: null }, 40, 13),
  ...run({ stage: 2, mode: 'idle', popT: null }, 53, 16),
  ...run({ stage: 3, mode: 'idle', popT: null }, 69, 16),
  ...run({ stage: 4, mode: 'idle', popT: null }, 85, 24),
  ...popRun(109),
  ...run({ stage: 0, mode: 'idle', popT: null }, 150, 12),
]

const now = new Date(2026, 9, 2, 23, 41).getTime()
const out = {
  hero,
  stages: [0, 1, 2, 3, 4].map((stage) => shot({ stage, mode: 'idle', popT: null }, 2)),
  compact: [...run({ stage: 4, mode: 'idle', popT: null }, 0, 12), ...popRun(12), ...run({ stage: 0, mode: 'idle', popT: null }, 60, 12)],
  babies: run({ stage: 1, mode: 'work', popT: null, babies: 3 }, 0, 32),
  night: [...run({ stage: 0, mode: 'sleepy', popT: null }, 0, 24), ...run({ stage: 0, mode: 'sleep', popT: null }, 24, 32)],
  passport: {
    portrait: shot({ stage: 1, mode: 'idle', popT: null }, 5, false),
    lines: passportLines({ born: now - 12 * 86400000, sessions: 37, eaten: 4200000, pops: 9, babies: 23 }, now),
  },
}
process.stdout.write(JSON.stringify(out))
