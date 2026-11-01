import { useEffect, type CSSProperties } from 'react'
import type { Overlay } from '@shared/types'
import { overlayScreenBox, type ViewportLike } from '@/lib/geometry'
import { cssFamilyName, effectiveOverlayRect, layoutText } from '@/pdf/textLayout'
import { useFontStore } from '@/state/fontStore'
import { findStamp } from './stamps'

interface Props {
  overlay: Overlay
  viewport: ViewportLike
  pageRotation: number
}

function StampGraphic({ stampId, color }: { stampId: string; color: string }) {
  const stamp = findStamp(stampId)
  if (!stamp) return null
  return (
    <svg
      className="overlay__stamp"
      viewBox={`0 0 ${stamp.viewBox.w} ${stamp.viewBox.h}`}
      preserveAspectRatio="none"
      dangerouslySetInnerHTML={{ __html: stamp.body(color) }}
    />
  )
}

function ShapeGraphic({ overlay }: { overlay: Extract<Overlay, { type: 'shape' }> }) {
  const { w, h, stroke, fill, strokeWidth } = overlay
  const common = {
    fill: fill ?? 'none',
    stroke,
    strokeWidth,
    vectorEffect: 'none' as const
  }
  return (
    <svg
      className="overlay__shape"
      viewBox={`0 0 ${Math.max(w, 0.01)} ${Math.max(h, 0.01)}`}
      preserveAspectRatio="none"
    >
      {overlay.shape === 'rect' && <rect x={0} y={0} width={w} height={h} {...common} />}
      {overlay.shape === 'ellipse' && (
        <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...common} />
      )}
      {overlay.shape === 'line' && <line x1={0} y1={h} x2={w} y2={0} {...common} fill="none" />}
      {overlay.shape === 'arrow' && (
        <g {...common} fill="none">
          <line x1={0} y1={h} x2={w} y2={0} />
          <line
            x1={w}
            y1={0}
            x2={w - Math.min(18, Math.hypot(w, h) * 0.35) * Math.cos(Math.atan2(-h, w) - Math.PI / 7)}
            y2={
              -Math.min(18, Math.hypot(w, h) * 0.35) * Math.sin(Math.atan2(-h, w) - Math.PI / 7)
            }
          />
          <line
            x1={w}
            y1={0}
            x2={w - Math.min(18, Math.hypot(w, h) * 0.35) * Math.cos(Math.atan2(-h, w) + Math.PI / 7)}
            y2={
              -Math.min(18, Math.hypot(w, h) * 0.35) * Math.sin(Math.atan2(-h, w) + Math.PI / 7)
            }
          />
        </g>
      )}
    </svg>
  )
}

export function OverlayView({ overlay, viewport, pageRotation }: Props) {
  const scale = viewport.scale
  const ensureLoaded = useFontStore((state) => state.ensureLoaded)
  const loadedFonts = useFontStore((state) => state.loaded)

  useEffect(() => {
    if (overlay.type === 'text' || overlay.type === 'text-edit') {
      if (overlay.fontFamily.startsWith('custom:')) {
        void ensureLoaded(overlay.fontFamily.slice('custom:'.length))
      }
    }
  }, [overlay, ensureLoaded])

  const isText = overlay.type === 'text' || overlay.type === 'text-edit'
  const textOverlay = isText ? overlay : null
  const layout = textOverlay ? layoutText(textOverlay) : null

  const box = overlayScreenBox({ ...overlay, ...effectiveOverlayRect(overlay) }, viewport, pageRotation)
  const baseStyle: CSSProperties = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    transform: `translate(-50%, -50%) rotate(${box.angle}deg)`,
    opacity: overlay.opacity
  }

  if (overlay.type === 'signature' || overlay.type === 'image') {
    const src = overlay.type === 'signature' ? overlay.png : overlay.dataUrl
    return (
      <div className="overlay" style={baseStyle} data-overlay-id={overlay.id}>
        <img className="overlay__image" src={src} alt="" draggable={false} />
      </div>
    )
  }

  if (overlay.type === 'stamp') {
    return (
      <div className="overlay" style={baseStyle} data-overlay-id={overlay.id}>
        <StampGraphic stampId={overlay.stampId} color={overlay.color} />
      </div>
    )
  }

  if (overlay.type === 'shape') {
    return (
      <div className="overlay" style={baseStyle} data-overlay-id={overlay.id}>
        <ShapeGraphic overlay={overlay} />
      </div>
    )
  }

  const text = overlay
  const fontSizePx = text.fontSize * scale
  const lineHeightPx = fontSizePx * text.lineHeight
  const customId = text.fontFamily.startsWith('custom:')
    ? text.fontFamily.slice('custom:'.length)
    : null
  const fontReady = !customId || Boolean(loadedFonts[customId])
  const family = fontReady ? cssFamilyName(text.fontFamily) : 'Helvetica'

  return (
    <>
      {text.type === 'text-edit' && (
        <div
          className="patch"
          style={{
            left: overlayScreenBox({ ...text, ...text.patch, h: text.patch.h }, viewport, pageRotation)
              .left,
            top: overlayScreenBox({ ...text, ...text.patch, h: text.patch.h }, viewport, pageRotation)
              .top,
            width: text.patch.w * scale,
            height: text.patch.h * scale,
            transform: `translate(-50%, -50%) rotate(${pageRotation - text.rotation}deg)`,
            background: text.patchColor,
            opacity: overlay.opacity
          }}
        />
      )}
      <div className="overlay" style={baseStyle} data-overlay-id={overlay.id}>
        <div
          className="overlay__text"
          style={{
            fontFamily: family,
            fontSize: fontSizePx,
            lineHeight: `${lineHeightPx}px`,
            color: text.color,
            textAlign: text.align,
            fontWeight: text.bold ? 700 : 400,
            fontStyle: text.italic ? 'italic' : 'normal',
            textDecorationLine: [text.underline ? 'underline' : '', text.strike ? 'line-through' : '']
              .filter(Boolean)
              .join(' ') || 'none',
            background: text.bgColor ?? 'transparent',
            border: text.borderColor && text.borderWidth > 0 ? `${text.borderWidth * scale}px solid ${text.borderColor}` : 'none',
            boxSizing: 'border-box'
          }}
        >
          {(layout?.lines ?? ['']).map((line, index) => (
            <div className="overlay__text-line" key={index} style={{ height: lineHeightPx }}>
              {line.length > 0 ? line : ' '}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
