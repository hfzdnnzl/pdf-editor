import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TextCapableOverlay } from '@shared/types'
import { overlayScreenBox, type ViewportLike } from '@/lib/geometry'
import { cssFamilyName, layoutText } from '@/pdf/textLayout'
import { useDocumentStore } from '@/state/documentStore'
import { useFontStore } from '@/state/fontStore'

interface Props {
  overlay: TextCapableOverlay
  viewport: ViewportLike
  pageRotation: number
}

export function TextInlineEditor({ overlay, viewport, pageRotation }: Props) {
  const updateOverlay = useDocumentStore((state) => state.updateOverlay)
  const stopEditing = useDocumentStore((state) => state.stopEditing)
  const beginHistory = useDocumentStore((state) => state.beginHistory)
  const commitHistory = useDocumentStore((state) => state.commitHistory)
  const loadedFonts = useFontStore((state) => state.loaded)
  const [value, setValue] = useState(overlay.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const historyStarted = useRef(false)
  const mountText = useRef(overlay.text)

  useLayoutEffect(() => {
    beginHistory()
    historyStarted.current = true
    // Focus synchronously inside the gesture, then again after the browser's default focus
    // handling for the click has run, so typing lands in the editor either way.
    const element = textareaRef.current
    const initialText = mountText.current
    const focusEditor = () => {
      if (!element) return
      element.focus({ preventScroll: true })
      // Select everything only for a brand-new empty box; existing runs keep their content and
      // put the caret at the end so typing cannot silently wipe the original wording.
      if (initialText.length === 0) element.select()
      else element.setSelectionRange(initialText.length, initialText.length)
    }
    focusEditor()
    const frame = requestAnimationFrame(() => {
      if (document.activeElement !== element) focusEditor()
    })
    return () => {
      cancelAnimationFrame(frame)
      if (historyStarted.current) {
        commitHistory()
        historyStarted.current = false
      }
    }
    // History is only opened once for the whole editing session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    updateOverlay(overlay.id, { text: value })
  }, [value, overlay.id, updateOverlay])

  const scale = viewport.scale
  const layout = layoutText({ ...overlay, text: value })
  const height = Math.max(layout.height, overlay.fontSize * overlay.lineHeight)
  const box = overlayScreenBox({ ...overlay, h: height }, viewport, pageRotation)

  const customId = overlay.fontFamily.startsWith('custom:')
    ? overlay.fontFamily.slice('custom:'.length)
    : null
  const fontReady = !customId || Boolean(loadedFonts[customId])
  const fontSizePx = overlay.fontSize * scale

  return (
    <textarea
      ref={textareaRef}
      className="text-editor"
      value={value}
      spellCheck={false}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => stopEditing()}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
          event.preventDefault()
          event.currentTarget.blur()
        }
        event.stopPropagation()
      }}
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: Math.max(box.height, fontSizePx * overlay.lineHeight),
        transform: `translate(-50%, -50%) rotate(${box.angle}deg)`,
        fontFamily: fontReady ? cssFamilyName(overlay.fontFamily) : 'Helvetica',
        fontSize: fontSizePx,
        lineHeight: `${fontSizePx * overlay.lineHeight}px`,
        color: overlay.color,
        textAlign: overlay.align,
        fontWeight: overlay.bold ? 700 : 400,
        fontStyle: overlay.italic ? 'italic' : 'normal',
        background: overlay.bgColor ?? 'rgba(255,255,255,0.35)',
        padding: 0
      }}
    />
  )
}
