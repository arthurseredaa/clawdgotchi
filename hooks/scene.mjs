import { POP_MS, stageOf } from './sprite.mjs'

export const EAT_MS = 1600
export const SLEEP_MS = 5 * 60 * 1000
export const EGG_LOOP_FROM = 1600
export const EGG_LOOP_MS = 400
export const HATCH_FROM = 2000
export const MAX_EGG_MS = 90 * 1000

// Burst first, then the egg wobbles until the compaction is done, then it cracks and hatches.
export function popTime(popStart, hatchStart, now) {
  if (popStart == null) return null
  const elapsed = now - popStart
  if (hatchStart != null) {
    const hatchAt = Math.max(hatchStart, popStart + EGG_LOOP_FROM)
    if (now >= hatchAt) {
      const p = HATCH_FROM + (now - hatchAt)
      return p < POP_MS ? p : null
    }
  }
  if (elapsed < EGG_LOOP_FROM) return elapsed
  return EGG_LOOP_FROM + ((elapsed - EGG_LOOP_FROM) % EGG_LOOP_MS)
}

export const MAX_BABIES = 3

// 23:00–01:59 Clawd is sleepy; 02:00–05:59 he dozes off even while Claude works.
export function nightPhase(hour) {
  if (hour == null) return null
  if (hour >= 23 || hour < 2) return 'late'
  if (hour < 6) return 'deep'
  return null
}

export function resolveScene(s, now) {
  const stage = stageOf(s.percent)
  const babies = Math.min(MAX_BABIES, s.babies || 0)
  const night = nightPhase(s.hour)
  const scene = (mode, popT = null) => ({ stage, mode, popT, babies })
  const popT = popTime(s.popStart, s.hatchStart, now)
  if (popT != null) return scene('idle', popT)
  if (now < s.eatUntil) return scene('eat')
  if (s.working) return scene(night === 'deep' ? 'sleep' : 'work')
  if (now - s.lastActivity >= SLEEP_MS) return scene('sleep')
  return scene(night ? 'sleepy' : 'idle')
}
