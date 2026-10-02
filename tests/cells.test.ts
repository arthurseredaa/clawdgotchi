import { expect, test } from 'claude-code/testing'
import { DEFAULT_COLOR, cellOf, toCells } from '../hooks/cells.mjs'

const decode = (b64: string) => {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
  return Array.from(new Uint32Array(bytes.buffer))
}
const empty = () => Array.from({ length: 8 }, () => Array(20).fill(null))

test('cellOf paints with glyph color only, so translucent backgrounds never show through', () => {
  expect(cellOf(null, null)).toEqual([0x20, DEFAULT_COLOR, DEFAULT_COLOR])
  expect(cellOf(0xff0000, null)).toEqual([0x2580, 0xff0000, DEFAULT_COLOR])
  expect(cellOf(null, 0x0000ff)).toEqual([0x2584, 0x0000ff, DEFAULT_COLOR])
  // iTerm2 with transparency blends every background color, so a solid cell is a full block.
  expect(cellOf(0xd97757, 0xd97757)).toEqual([0x2588, 0xd97757, DEFAULT_COLOR])
})

test('two colors in one cell: the lighter one is the glyph, the darker one the background', () => {
  expect(cellOf(0xd97757, 0x141216)).toEqual([0x2580, 0xd97757, 0x141216])
  expect(cellOf(0x141216, 0xd97757)).toEqual([0x2584, 0xd97757, 0x141216])
})

test('toCells packs 8x20 pixels into 4x20 cells', () => {
  const g = empty()
  g[0][0] = 0xaaaaaa
  g[1][0] = 0xbbbbbb
  g[7][19] = 0xcccccc
  const n = decode(toCells(g))
  expect(n.length).toBe(4 * 20 * 3)
  expect(n.slice(0, 3)).toEqual([0x2584, 0xbbbbbb, 0xaaaaaa])
  expect(n.slice(-3)).toEqual([0x2584, 0xcccccc, DEFAULT_COLOR])
  expect(n[3]).toBe(0x20)
})

test('glyphs are written into their cells over the pixels', () => {
  const g = empty()
  g[0][0] = 0xaaaaaa
  const n = decode(toCells(g, [{ x: 0, row: 0, ch: 'z', color: 0xbdb7cc }, { x: 2, row: 3, ch: 'Z', color: 0xbdb7cc }]))
  expect(n.slice(0, 3)).toEqual([0x7a, 0xbdb7cc, DEFAULT_COLOR])
  expect(n.slice((3 * 20 + 2) * 3, (3 * 20 + 2) * 3 + 3)).toEqual([0x5a, 0xbdb7cc, DEFAULT_COLOR])
})
