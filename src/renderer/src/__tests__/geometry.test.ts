import { describe, expect, it } from 'vitest'
import {
  clampRectToPage,
  moveRect,
  overlayScreenBox,
  resizeRect,
  rotatePoint,
  snapRect,
  toLocalDelta
} from '@/lib/geometry'
import { createPageViewport, overlayBoundingRect } from '@/lib/pageViewport'

describe('page viewport transforms', () => {
  const pageWidth = 600
  const pageHeight = 800

  it('maps the PDF origin to the bottom-left corner at rotation 0', () => {
    const viewport = createPageViewport(pageWidth, pageHeight, 0, 1)
    expect(viewport.convertToViewportPoint(0, 0)).toEqual([0, 800])
    expect(viewport.convertToViewportPoint(600, 800)).toEqual([600, 0])
    expect(viewport.width).toBe(600)
    expect(viewport.height).toBe(800)
  })

  it('swaps dimensions at 90 degrees', () => {
    const viewport = createPageViewport(pageWidth, pageHeight, 90, 2)
    expect(viewport.width).toBe(1600)
    expect(viewport.height).toBe(1200)
    expect(viewport.convertToViewportPoint(0, 0)).toEqual([0, 0])
    expect(viewport.convertToViewportPoint(pageWidth, pageHeight)).toEqual([1600, 1200])
  })

  it('round-trips coordinates for every right-angle rotation', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const viewport = createPageViewport(pageWidth, pageHeight, rotation, 1.75)
      for (const point of [
        [0, 0],
        [120, 340],
        [600, 800]
      ]) {
        const [vx, vy] = viewport.convertToViewportPoint(point[0], point[1])
        const [x, y] = viewport.convertToPdfPoint(vx, vy)
        expect(x).toBeCloseTo(point[0], 6)
        expect(y).toBeCloseTo(point[1], 6)
      }
    }
  })

  it('builds an axis-aligned bounding box for rotated pages', () => {
    const viewport = createPageViewport(pageWidth, pageHeight, 90, 1)
    const bbox = overlayBoundingRect({ x: 100, y: 200, w: 50, h: 20 }, viewport)
    expect(bbox.right - bbox.left).toBeCloseTo(20, 6)
    expect(bbox.bottom - bbox.top).toBeCloseTo(50, 6)
  })
})

describe('overlay geometry', () => {
  it('positions a box around the converted centre', () => {
    const viewport = createPageViewport(600, 800, 0, 2)
    const box = overlayScreenBox({ id: 'a', pageId: 'p', x: 100, y: 100, w: 50, h: 25, rotation: 0, opacity: 1, locked: false }, viewport, 0)
    expect(box.left).toBeCloseTo(250, 6)
    expect(box.top).toBeCloseTo(2 * (800 - 112.5), 6)
    expect(box.width).toBeCloseTo(100, 6)
    expect(box.height).toBeCloseTo(50, 6)
    expect(box.angle).toBe(0)
  })

  it('cancels the page rotation when drawing the overlay', () => {
    const viewport = createPageViewport(600, 800, 0, 1)
    const base = { id: 'a', pageId: 'p', x: 0, y: 0, w: 10, h: 10, rotation: 30, opacity: 1, locked: false }
    expect(overlayScreenBox(base, viewport, 0).angle).toBe(-30)
    expect(overlayScreenBox(base, viewport, 90).angle).toBe(60)
  })

  it('keeps the opposite corner pinned while resizing', () => {
    const base = { x: 100, y: 100, w: 100, h: 50 }
    // Dragging the bottom-right handle down (-y in PDF space) grows the height.
    const resized = resizeRect(base, 0, 'se', { x: 20, y: -10 }, false)
    expect(resized).toEqual({ x: 100, y: 90, w: 120, h: 60 })

    // Dragging the top-left handle up-right shrinks the width and grows the height.
    const shrunk = resizeRect(base, 0, 'nw', { x: 20, y: 10 }, false)
    expect(shrunk.x).toBeCloseTo(120, 6)
    expect(shrunk.y).toBeCloseTo(100, 6)
    expect(shrunk.w).toBeCloseTo(80, 6)
    expect(shrunk.h).toBeCloseTo(60, 6)
  })

  it('resizes along rotated axes', () => {
    const base = { x: 0, y: 0, w: 100, h: 100 }
    const resized = resizeRect(base, 90, 'e', { x: 0, y: 20 }, false)
    expect(resized.w).toBeCloseTo(120, 6)
    expect(resized.h).toBeCloseTo(100, 6)
  })

  it('honours the aspect ratio for corner handles', () => {
    const base = { x: 0, y: 0, w: 200, h: 100 }
    const resized = resizeRect(base, 0, 'se', { x: 100, y: 0 }, true)
    expect(resized.w / resized.h).toBeCloseTo(2, 6)
  })

  it('never shrinks below the minimum size', () => {
    const resized = resizeRect({ x: 0, y: 0, w: 40, h: 40 }, 0, 'e', { x: -200, y: 0 }, false)
    expect(resized.w).toBeGreaterThanOrEqual(12)
  })

  it('moves a rect without changing its size', () => {
    expect(moveRect({ x: 10, y: 20, w: 30, h: 40 }, { x: 5, y: -5 })).toEqual({
      x: 15,
      y: 15,
      w: 30,
      h: 40
    })
  })

  it('clamps a rect inside the page', () => {
    expect(clampRectToPage({ x: -50, y: 900, w: 100, h: 50 }, 600, 800)).toEqual({
      x: 0,
      y: 750,
      w: 100,
      h: 50
    })
  })

  it('snaps to page edges and centre', () => {
    expect(snapRect({ x: 2, y: 3, w: 100, h: 50 }, 600, 800).x).toBe(0)
    expect(snapRect({ x: 497, y: 3, w: 100, h: 50 }, 600, 800).x).toBe(500)
    expect(snapRect({ x: 251, y: 3, w: 100, h: 50 }, 600, 800).x).toBe(250)
  })

  it('rotates deltas into local space', () => {
    // A box rotated 90° counter-clockwise has its local +x axis along world +y.
    const local = toLocalDelta(10, 0, 90)
    expect(local.x).toBeCloseTo(0, 6)
    expect(local.y).toBeCloseTo(-10, 6)
  })

  it('rotates a point around an origin', () => {
    const rotated = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90)
    expect(rotated.x).toBeCloseTo(0, 6)
    expect(rotated.y).toBeCloseTo(10, 6)
  })
})
