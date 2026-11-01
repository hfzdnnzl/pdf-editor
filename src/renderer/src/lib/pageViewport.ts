import type { Rect } from '@shared/types'

export interface PageViewportModel {
  scale: number
  width: number
  height: number
  rotation: number
  pageWidth: number
  pageHeight: number
  convertToViewportPoint(x: number, y: number): [number, number]
  convertToPdfPoint(vx: number, vy: number): [number, number]
}

/**
 * Mirrors pdf.js `PageViewport` for the four right-angle rotations. Used for blank pages and in
 * tests, where no pdf.js page proxy exists.
 */
export function createPageViewport(
  pageWidth: number,
  pageHeight: number,
  rotation: number,
  scale: number
): PageViewportModel {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360
  const swap = normalized === 90 || normalized === 270
  const width = (swap ? pageHeight : pageWidth) * scale
  const height = (swap ? pageWidth : pageHeight) * scale

  const toViewport = (x: number, y: number): [number, number] => {
    switch (normalized) {
      case 90:
        return [y * scale, x * scale]
      case 180:
        return [(pageWidth - x) * scale, y * scale]
      case 270:
        return [(pageHeight - y) * scale, (pageWidth - x) * scale]
      default:
        return [x * scale, (pageHeight - y) * scale]
    }
  }

  const toPdf = (vx: number, vy: number): [number, number] => {
    const x = vx / scale
    const y = vy / scale
    switch (normalized) {
      case 90:
        return [y, x]
      case 180:
        return [pageWidth - x, y]
      case 270:
        return [pageWidth - y, pageHeight - x]
      default:
        return [x, pageHeight - y]
    }
  }

  return {
    scale,
    width,
    height,
    rotation: normalized,
    pageWidth,
    pageHeight,
    convertToViewportPoint: toViewport,
    convertToPdfPoint: toPdf
  }
}

export function overlayBoundingRect(
  rect: Rect,
  viewport: PageViewportModel
): { top: number; left: number; bottom: number; right: number } {
  const corners = [
    viewport.convertToViewportPoint(rect.x, rect.y),
    viewport.convertToViewportPoint(rect.x + rect.w, rect.y),
    viewport.convertToViewportPoint(rect.x, rect.y + rect.h),
    viewport.convertToViewportPoint(rect.x + rect.w, rect.y + rect.h)
  ]
  const xs = corners.map(([x]) => x)
  const ys = corners.map(([, y]) => y)
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys)
  }
}
