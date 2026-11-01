import type { CSSProperties } from 'react'
import { rotatePoint, type HandleId } from '@/lib/geometry'

export interface SelectionBox {
  left: number
  top: number
  width: number
  height: number
  angle: number
}

const ROTATE_HANDLE_OFFSET = 26

/** Handle positions in the overlay layer's coordinate space (used for hit testing). */
export function handlePoints(
  box: SelectionBox
): Array<{ id: Exclude<HandleId, 'rotate'>; x: number; y: number }> {
  const center = { x: box.left, y: box.top }
  const half = { x: box.width / 2, y: box.height / 2 }
  const defs: Array<[Exclude<HandleId, 'rotate'>, number, number]> = [
    ['nw', -1, -1],
    ['n', 0, -1],
    ['ne', 1, -1],
    ['e', 1, 0],
    ['se', 1, 1],
    ['s', 0, 1],
    ['sw', -1, 1],
    ['w', -1, 0]
  ]
  return defs.map(([id, hx, hy]) => {
    const point = rotatePoint(
      { x: center.x + hx * half.x, y: center.y + hy * half.y },
      center,
      box.angle
    )
    return { id, ...point }
  })
}

export function rotateHandlePoint(box: SelectionBox): { x: number; y: number } {
  const center = { x: box.left, y: box.top }
  return rotatePoint(
    { x: center.x, y: center.y - box.height / 2 - ROTATE_HANDLE_OFFSET },
    center,
    box.angle
  )
}

/**
 * Handle offsets inside the frame element. The frame is centred with `translate(-50%, -50%)`, so
 * children must use coordinates local to the frame (0…width), never the layer's.
 */
const localHandleOffsets = (width: number, height: number): Array<{ id: string; x: number; y: number }> =>
  handlePoints({ left: 0, top: 0, width, height, angle: 0 }).map((point) => ({
    id: point.id,
    x: point.x + width / 2,
    y: point.y + height / 2
  }))

export function SelectionFrame({ box, locked }: { box: SelectionBox; locked?: boolean }) {
  const style: CSSProperties = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    transform: `translate(-50%, -50%) rotate(${box.angle}deg)`
  }

  return (
    <div className={`selection-frame${locked ? ' is-locked' : ''}`} style={style}>
      {!locked && (
        <>
          {localHandleOffsets(box.width, box.height).map((point) => (
            <span key={point.id} className="handle" style={{ left: point.x, top: point.y }} />
          ))}
          <span
            className="handle-line"
            style={{ left: box.width / 2, top: -ROTATE_HANDLE_OFFSET, height: ROTATE_HANDLE_OFFSET }}
          />
          <span
            className="handle--rotate"
            style={{ left: box.width / 2, top: -ROTATE_HANDLE_OFFSET }}
          />
        </>
      )}
    </div>
  )
}
