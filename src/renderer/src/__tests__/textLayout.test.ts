import { describe, expect, it } from 'vitest'
import { layoutText, wrapText, type WrappedText } from '@/pdf/textLayout'
import type { TextOverlay } from '@shared/types'

/** Deterministic fake metrics: every character is half the font size wide. */
const measureFor = (fontSize: number) => (candidate: string) => candidate.length * fontSize * 0.5

const makeOverlay = (overrides: Partial<TextOverlay> = {}): TextOverlay => ({
  id: 'text-1',
  pageId: 'page-1',
  type: 'text',
  text: '',
  fontFamily: 'Helvetica',
  fontSize: 10,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  color: '#000000',
  align: 'left',
  lineHeight: 1.2,
  bgColor: null,
  borderColor: null,
  borderWidth: 0,
  x: 0,
  y: 0,
  w: 100,
  h: 12,
  rotation: 0,
  opacity: 1,
  locked: false,
  ...overrides
})

describe('text wrapping', () => {
  it('keeps explicit line breaks', () => {
    const lines = wrapText('one\ntwo\nthree', 200, measureFor(10))
    expect(lines).toEqual(['one', 'two', 'three'])
  })

  it('wraps at word boundaries', () => {
    const lines = wrapText('alpha beta gamma delta', 60, measureFor(10))
    expect(lines).toEqual(['alpha beta', 'gamma delta'])
  })

  it('hard-breaks a word that is wider than the box', () => {
    const lines = wrapText('supercalifragilistic', 50, measureFor(10))
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(10)
    }
    expect(lines.join('')).toBe('supercalifragilistic')
  })

  it('preserves blank lines', () => {
    expect(wrapText('a\n\nb', 100, measureFor(10))).toEqual(['a', '', 'b'])
  })

  it('computes height from line count and line height', () => {
    const overlay = makeOverlay({ text: 'alpha beta gamma delta', w: 100, fontSize: 10, lineHeight: 1.5 })
    const layout: WrappedText = layoutText(overlay, measureFor(10))
    expect(layout.lines.length).toBe(2)
    expect(layout.height).toBeCloseTo(2 * 10 * 1.5, 6)
  })

  it('returns a single empty line for empty text', () => {
    expect(wrapText('', 100, measureFor(10))).toEqual([''])
  })
})

describe('painted rect anchoring', () => {
  it('keeps the top edge fixed when a single-line box wraps to two lines', async () => {
    const { effectiveOverlayRect } = await import('@/pdf/textLayout')
    const single = makeOverlay({ text: 'short', w: 200, fontSize: 10, lineHeight: 1.5, y: 500, h: 15 })
    const wrapped = makeOverlay({ text: 'alpha beta gamma delta', w: 60, fontSize: 10, lineHeight: 1.5, y: 500, h: 15 })
    const singleRect = effectiveOverlayRect(single)
    const wrappedRect = effectiveOverlayRect(wrapped)
    // Top edge (y + h) is the anchor and must not move.
    expect(singleRect.y + singleRect.h).toBeCloseTo(515, 6)
    expect(wrappedRect.y + wrappedRect.h).toBeCloseTo(515, 6)
    expect(wrappedRect.y).toBeLessThan(singleRect.y)
    expect(wrappedRect.h).toBeCloseTo(2 * 10 * 1.5, 6)
  })

  it('leaves non-text overlays untouched', async () => {
    const { effectiveOverlayRect } = await import('@/pdf/textLayout')
    const stamp = {
      id: 's',
      pageId: 'p',
      type: 'stamp' as const,
      stampId: 'check',
      color: '#000000',
      x: 10,
      y: 20,
      w: 30,
      h: 40,
      rotation: 0,
      opacity: 1,
      locked: false
    }
    expect(effectiveOverlayRect(stamp)).toEqual({ x: 10, y: 20, w: 30, h: 40 })
  })
})
