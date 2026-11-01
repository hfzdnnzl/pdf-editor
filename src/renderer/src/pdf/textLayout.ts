import type { FontFamilyRef, Overlay, Rect, TextCapableOverlay } from '@shared/types'

export const STANDARD_FONTS: Array<{ id: FontFamilyRef; label: string }> = [
  { id: 'Helvetica', label: 'Helvetica (sans)' },
  { id: 'Times', label: 'Times (serif)' },
  { id: 'Courier', label: 'Courier (mono)' }
]

export const CUSTOM_CSS_PREFIX = 'PDFStudioCustom-'

export function customFontId(family: FontFamilyRef): string | null {
  return family.startsWith('custom:') ? family.slice('custom:'.length) : null
}

export function cssFamilyName(family: FontFamilyRef): string {
  const id = customFontId(family)
  return id ? `${CUSTOM_CSS_PREFIX}${id}` : family
}

export function cssFontSpec(
  family: FontFamilyRef,
  bold: boolean,
  italic: boolean,
  fontSize: number
): string {
  return `${italic ? 'italic ' : ''}${bold ? '700' : '400'} ${fontSize}px "${cssFamilyName(family)}", sans-serif`
}

const measureCanvas =
  typeof document === 'undefined' ? null : document.createElement('canvas')

let measureContext: CanvasRenderingContext2D | null = null

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext) return measureContext
  if (!measureCanvas) return null
  measureContext = measureCanvas.getContext('2d')
  return measureContext
}

/** Width of `text` in PDF points, measured with the same font stack used for preview. */
export function measureText(text: string, fontSpec: string): number {
  const ctx = getMeasureContext()
  if (!ctx) return text.length * 0.5 * Number(fontSpec.split(' ').find((part) => part.endsWith('px'))?.replace('px', '') ?? 12)
  ctx.font = fontSpec
  return ctx.measureText(text).width
}

export interface WrappedText {
  lines: string[]
  width: number
  height: number
}

/**
 * Greedy word wrapping that keeps explicit line breaks. `measure` returns the width of a
 * candidate string, letting the DOM preview and the pdf-lib exporter share one algorithm.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (candidate: string) => number
): string[] {
  const limit = Math.max(1, maxWidth)
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      lines.push('')
      continue
    }

    const words = paragraph.split(/(\s+)/).filter((chunk) => chunk.length > 0)
    let current = ''

    for (const word of words) {
      const candidate = current + word
      if (current.length > 0 && measure(candidate) > limit) {
        lines.push(...hardBreak(current.trimEnd(), limit, measure))
        current = word.trimStart()
      } else {
        current = candidate
      }
    }

    if (current.length > 0) lines.push(...hardBreak(current.trimEnd(), limit, measure))
  }

  return lines.length > 0 ? lines : ['']
}

/** Splits text that is wider than the box on character boundaries. */
function hardBreak(
  text: string,
  limit: number,
  measure: (candidate: string) => number
): string[] {
  if (text.length === 0) return ['']
  if (measure(text) <= limit) return [text]

  const chunks: string[] = []
  let rest = text
  while (rest.length > 0) {
    let cut = rest.length
    while (cut > 1 && measure(rest.slice(0, cut)) > limit) cut -= 1
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  return chunks
}

export function layoutText(
  overlay: TextCapableOverlay,
  measure: (candidate: string) => number = (candidate) =>
    measureText(candidate, cssFontSpec(overlay.fontFamily, overlay.bold, overlay.italic, overlay.fontSize))
): WrappedText {
  const lines = wrapText(overlay.text, overlay.w, measure)
  const widest = lines.reduce((max, line) => Math.max(max, measure(line)), 0)
  return {
    lines,
    width: widest,
    height: lines.length * overlay.fontSize * overlay.lineHeight
  }
}

/**
 * The rect actually painted for an overlay. Text grows downwards from the top of the stored rect,
 * so the first line stays where it was placed (and where an edited run used to be) and extra lines
 * extend below it rather than pushing the first line up.
 */
export function effectiveOverlayRect(overlay: Overlay): Rect {
  if (overlay.type === 'text' || overlay.type === 'text-edit') {
    const height = Math.max(layoutText(overlay).height, overlay.fontSize * overlay.lineHeight)
    return { x: overlay.x, y: overlay.y + overlay.h - height, w: overlay.w, h: height }
  }
  return { x: overlay.x, y: overlay.y, w: overlay.w, h: overlay.h }
}

/** Painted height of an overlay, used for hit testing and selection frames. */
export function effectiveOverlayHeight(overlay: Overlay): number {
  return effectiveOverlayRect(overlay).h
}

export function overlayTextAscent(fontSize: number): number {
  return fontSize * 0.8
}
