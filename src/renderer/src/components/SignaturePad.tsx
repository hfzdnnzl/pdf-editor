import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { trimCanvas } from '@/overlays/signatureUtils'

interface Props {
  color: string
  strokeWidth: number
  onChange?: (hasInk: boolean) => void
}

export interface SignaturePadHandle {
  undo: () => void
  clear: () => void
  toPng: () => string | null
  hasInk: () => boolean
}

interface Stroke {
  points: Array<{ x: number; y: number; t: number }>
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { color, strokeWidth, onChange },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const activeStroke = useRef<Stroke | null>(null)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(rect.width * dpr))
    canvas.height = Math.max(1, Math.round(rect.height * dpr))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const redraw = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const stroke of strokesRef.current) {
      if (stroke.points.length === 1) {
        const point = stroke.points[0]
        ctx.beginPath()
        ctx.arc(point.x, point.y, strokeWidth / 2, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      for (let index = 1; index < stroke.points.length; index += 1) {
        const previous = stroke.points[index - 1]
        const current = stroke.points[index]
        const distance = Math.hypot(current.x - previous.x, current.y - previous.y)
        const velocity = distance / Math.max(1, current.t - previous.t)
        const dynamicWidth = Math.max(
          strokeWidth * 0.45,
          strokeWidth * (1.35 - Math.min(velocity * 0.55, 0.9))
        )
        ctx.beginPath()
        ctx.lineWidth = dynamicWidth
        ctx.moveTo(previous.x, previous.y)
        ctx.quadraticCurveTo(
          (previous.x + current.x) / 2,
          (previous.y + current.y) / 2,
          current.x,
          current.y
        )
        ctx.stroke()
      }
    }
  }

  useEffect(() => {
    redraw()
    // Redrawing only needs the ink settings, not the stroke cache identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, strokeWidth])

  const publish = (next: boolean) => {
    setHasInk(next)
    onChange?.(next)
  }

  useImperativeHandle(ref, () => ({
    undo: () => {
      strokesRef.current.pop()
      redraw()
      publish(strokesRef.current.length > 0)
    },
    clear: () => {
      strokesRef.current = []
      redraw()
      publish(false)
    },
    toPng: () => {
      const canvas = canvasRef.current
      if (!canvas || strokesRef.current.length === 0) return null
      return trimCanvas(canvas, 8)
    },
    hasInk: () => strokesRef.current.length > 0
  }))

  const localPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      t: performance.now()
    }
  }

  return (
    <div className={`sigpad${hasInk ? '' : ' is-empty'}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          const stroke: Stroke = { points: [localPoint(event)] }
          strokesRef.current.push(stroke)
          activeStroke.current = stroke
          publish(true)
          redraw()
        }}
        onPointerMove={(event) => {
          if (!activeStroke.current) return
          activeStroke.current.points.push(localPoint(event))
          redraw()
        }}
        onPointerUp={() => {
          activeStroke.current = null
        }}
        onPointerCancel={() => {
          activeStroke.current = null
        }}
      />
      {!hasInk && <div className="sigpad__hint">Sign here with a trackpad, mouse or pen</div>}
    </div>
  )
})
