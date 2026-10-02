export const DEFAULT_COLOR = 0x01000000

const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const FULL_BLOCK = 0x2588
const SPACE = 0x20

const luminance = (c) => 0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff)

// Paint with glyph color wherever possible: terminals with window transparency (iTerm2)
// blend every background color, which made background-painted pixels look darker.
// A background is used only when one cell holds two colors, and then for the darker one.
export function cellOf(top, bottom) {
  if (top == null && bottom == null) return [SPACE, DEFAULT_COLOR, DEFAULT_COLOR]
  if (top == null) return [LOWER_HALF, bottom, DEFAULT_COLOR]
  if (bottom == null) return [UPPER_HALF, top, DEFAULT_COLOR]
  if (top === bottom) return [FULL_BLOCK, top, DEFAULT_COLOR]
  return luminance(top) >= luminance(bottom) ? [UPPER_HALF, top, bottom] : [LOWER_HALF, bottom, top]
}

// glyphs: [{ x, row, ch, color }] written into whole cells over the pixels (row counts cells, not pixels).
export function toCells(grid, glyphs = []) {
  const at = new Map(glyphs.map((g) => [`${g.row}:${g.x}`, g]))
  const nums = []
  for (let r = 0; r + 1 < grid.length; r += 2) {
    for (let c = 0; c < grid[r].length; c++) {
      const g = at.get(`${r / 2}:${c}`)
      nums.push(...(g ? [g.ch.codePointAt(0), g.color, DEFAULT_COLOR] : cellOf(grid[r][c], grid[r + 1][c])))
    }
  }
  return toBase64(new Uint8Array(Uint32Array.from(nums).buffer))
}

function toBase64(bytes) {
  if (typeof bytes.toBase64 === 'function') return bytes.toBase64()
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
