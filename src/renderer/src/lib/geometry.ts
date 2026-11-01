import type { Overlay, OverlayBase, Rect } from '@shared/types'

export interface ViewportLike {
  scale: number
  width: number
  height: number
  rotation?: number
  convertToViewportPoint(x: number, y: number): [number, number]
  convertToPdfPoint(x: number, y: number): [number, number]
}

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'

export const HANDLE_DIRECTIONS: Record<Exclude<HandleId, 'rotate'>, [number, number]> = {
  nw: [-1, 1],
  n: [0, 1],
  ne: [1, 1],
  e: [1, 0],
  se: [1, -1],
  s: [0, -1],
  sw: [-1, -1],
  w: [-1, 0]
}

export const MIN_OVERLAY_SIZE = 12

const toRad = (deg: number): number => (deg * Math.PI) / 180
const mod360 = (deg: number): number => ((deg % 360) + 360) % 360

export function rectCenter(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

export function rotatePoint(
  point: { x: number; y: number },
  origin: { x: number; y: number },
  degrees: number
): { x: number; y: number } {
  const rad = toRad(degrees)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos
  }
}

/** Rotates a delta vector into the overlay's local (unrotated) axes. */
export function toLocalDelta(dx: number, dy: number, rotation: number): { x: number; y: number } {
  const rad = toRad(-rotation)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
}

export function toWorldDelta(dx: number, dy: number, rotation: number): { x: number; y: number } {
  const rad = toRad(rotation)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Screen-space placement of a PDF-space rectangle, accounting for page rotation. */
export function overlayScreenBox(
  overlay: OverlayBase,
  viewport: ViewportLike,
  pageRotation: number
): { left: number; top: number; width: number; height: number; angle: number } {
  const center = rectCenter(overlay)
  const [cx, cy] = viewport.convertToViewportPoint(center.x, center.y)
  return {
    left: cx,
    top: cy,
    width: overlay.w * viewport.scale,
    height: overlay.h * viewport.scale,
    angle: pageRotation - overlay.rotation
  }
}

export function clientToPdf(
  viewport: ViewportLike,
  element: { getBoundingClientRect(): DOMRect },
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = element.getBoundingClientRect()
  const [x, y] = viewport.convertToPdfPoint(clientX - rect.left, clientY - rect.top)
  return { x, y }
}

export function resizeRect(
  base: Rect,
  rotation: number,
  handle: Exclude<HandleId, 'rotate'>,
  delta: { x: number; y: number },
  keepAspect: boolean
): Rect {
  const [hx, hy] = HANDLE_DIRECTIONS[handle]
  const local = toLocalDelta(delta.x, delta.y, rotation)
  const center = rectCenter(base)

  let width = base.w
  let height = base.h

  if (hx !== 0) width = Math.max(MIN_OVERLAY_SIZE, base.w + hx * local.x)
  if (hy !== 0) height = Math.max(MIN_OVERLAY_SIZE, base.h + hy * local.y)

  if (keepAspect && hx !== 0 && hy !== 0 && base.w > 0 && base.h > 0) {
    const ratio = base.w / base.h
    if (Math.abs(width - base.w) >= Math.abs(height - base.h)) height = width / ratio
    else width = height * ratio
  }

  // The corner opposite the dragged handle stays pinned in page space.
  const anchorLocal = { x: (-hx * base.w) / 2, y: (-hy * base.h) / 2 }
  const anchor = rotatePoint(
    { x: center.x + anchorLocal.x, y: center.y + anchorLocal.y },
    center,
    rotation
  )
  const newCenterLocal = { x: (hx * width) / 2, y: (hy * height) / 2 }
  const newCenterOffset = toWorldDelta(newCenterLocal.x, newCenterLocal.y, rotation)

  return {
    x: anchor.x + newCenterOffset.x - width / 2,
    y: anchor.y + newCenterOffset.y - height / 2,
    w: width,
    h: height
  }
}

export function moveRect(base: Rect, delta: { x: number; y: number }): Rect {
  return { x: base.x + delta.x, y: base.y + delta.y, w: base.w, h: base.h }
}

export function clampRectToPage(rect: Rect, pageWidth: number, pageHeight: number): Rect {
  return {
    x: clamp(rect.x, 0, Math.max(0, pageWidth - rect.w)),
    y: clamp(rect.y, 0, Math.max(0, pageHeight - rect.h)),
    w: Math.min(rect.w, pageWidth),
    h: Math.min(rect.h, pageHeight)
  }
}

export function snapRect(rect: Rect, pageWidth: number, pageHeight: number, threshold = 4): Rect {
  const snapped = { ...rect }
  if (Math.abs(snapped.x) < threshold) snapped.x = 0
  if (Math.abs(snapped.y) < threshold) snapped.y = 0
  if (Math.abs(snapped.x + snapped.w - pageWidth) < threshold) snapped.x = pageWidth - snapped.w
  if (Math.abs(snapped.y + snapped.h - pageHeight) < threshold) snapped.y = pageHeight - snapped.h
  const centerX = pageWidth / 2 - snapped.w / 2
  if (Math.abs(snapped.x - centerX) < threshold) snapped.x = centerX
  const centerY = pageHeight / 2 - snapped.h / 2
  if (Math.abs(snapped.y - centerY) < threshold) snapped.y = centerY
  return snapped
}

export function handleScreenPositions(box: {
  left: number
  top: number
  width: number
  height: number
}): Array<{ id: Exclude<HandleId, 'rotate'>; x: number; y: number }> {
  const { left, top, width, height } = box
  return [
    { id: 'nw', x: left, y: top },
    { id: 'n', x: left + width / 2, y: top },
    { id: 'ne', x: left + width, y: top },
    { id: 'e', x: left + width, y: top + height / 2 },
    { id: 'se', x: left + width, y: top + height },
    { id: 's', x: left + width / 2, y: top + height },
    { id: 'sw', x: left, y: top + height },
    { id: 'w', x: left, y: top + height / 2 }
  ]
}

export function normalizeDegrees(degrees: number): number {
  return mod360(degrees)
}

export function isOverlayHit(overlay: Overlay, point: { x: number; y: number }): boolean {
  const center = rectCenter(overlay)
  const local = rotatePoint(point, center, -overlay.rotation)
  return (
    local.x >= overlay.x - 1 &&
    local.x <= overlay.x + overlay.w + 1 &&
    local.y >= overlay.y - 1 &&
    local.y <= overlay.y + overlay.h + 1
  )
}
