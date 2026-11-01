import { useCallback, useEffect, useRef, useState } from 'react'
import type { Align, FontFamilyRef, Overlay, PageModel, Rect } from '@shared/types'
import {
  clampRectToPage,
  clientToPdf,
  moveRect,
  overlayScreenBox,
  resizeRect,
  rotatePoint,
  snapRect,
  type HandleId,
  type ViewportLike
} from '@/lib/geometry'
import { effectiveOverlayRect } from '@/pdf/textLayout'
import { sampleRunColors } from '@/pdf/sampleColors'
import { insertImageFromDisk } from '@/state/fileActions'
import { useDocumentStore } from '@/state/documentStore'
import { useUiStore } from '@/state/uiStore'
import {
  createShapeOverlay,
  createSignatureOverlay,
  createStampOverlay,
  createTextEditOverlay,
  createTextOverlay
} from './factories'
import { OverlayView } from './OverlayView'
import { SelectionFrame, handlePoints, rotateHandlePoint } from './SelectionFrame'
import { TextInlineEditor } from './TextInlineEditor'

interface Props {
  page: PageModel
  viewport: ViewportLike
  pageRotation: number
  canvas: HTMLCanvasElement | null
}

type Drag =
  | { kind: 'move'; id: string; start: { x: number; y: number }; base: Overlay }
  | {
      kind: 'resize'
      id: string
      start: { x: number; y: number }
      base: Overlay
      handle: Exclude<HandleId, 'rotate'>
    }
  | {
      kind: 'rotate'
      id: string
      base: Overlay
      center: { x: number; y: number }
      startAngle: number
      startRotation: number
    }
  | { kind: 'draw'; id: string; start: { x: number; y: number } }

const EMPTY_OVERLAYS: Overlay[] = []
const TEXT_BOX_WIDTH = 190
const HANDLE_RADIUS = 8
const ROTATE_RADIUS = 10

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y)

const cursorForHandle = (handle: Exclude<HandleId, 'rotate'>): string => {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    default:
      return 'nwse-resize'
  }
}

const normalizedRect = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.max(1, Math.abs(b.x - a.x)),
  h: Math.max(1, Math.abs(b.y - a.y))
})

const hitTest = (overlay: Overlay, point: { x: number; y: number }): boolean => {
  const rect = effectiveOverlayRect(overlay)
  const center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
  const local = rotatePoint(point, center, -overlay.rotation)
  return (
    local.x >= rect.x - 1 &&
    local.x <= rect.x + rect.w + 1 &&
    local.y >= rect.y - 1 &&
    local.y <= rect.y + rect.h + 1
  )
}

const inferFamily = (cssFamily: string): FontFamilyRef => {
  const value = cssFamily.toLowerCase()
  if (value.includes('courier') || value.includes('mono')) return 'Courier'
  if (value.includes('times') || (value.includes('serif') && !value.includes('sans'))) return 'Times'
  return 'Helvetica'
}

const inferAlign = (span: HTMLElement): Align => {
  const layer = span.closest('.text-layer')
  if (!layer) return 'left'
  const layerRect = layer.getBoundingClientRect()
  const spanRect = span.getBoundingClientRect()
  const left = spanRect.left - layerRect.left
  const right = layerRect.width - (spanRect.right - layerRect.left)
  if (Math.abs(left - right) < 4) return 'center'
  if (right < left - 4) return 'right'
  return 'left'
}

export function OverlayLayer({ page, viewport, pageRotation, canvas }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [, forceRender] = useState(0)

  const overlays = useDocumentStore((state) => state.overlays[page.id] ?? EMPTY_OVERLAYS)
  const selectedId = useDocumentStore((state) => state.selectedId)
  const editingId = useDocumentStore((state) => state.editingId)
  const shapeKind = useDocumentStore((state) => state.shapeKind)
  const selected = overlays.find((overlay) => overlay.id === selectedId) ?? null
  const editing = overlays.find((overlay) => overlay.id === editingId) ?? null

  const selectedBox = selected
    ? overlayScreenBox({ ...selected, ...effectiveOverlayRect(selected) }, viewport, pageRotation)
    : null

  const pointerPdf = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const element = layerRef.current
      if (!element) return { x: 0, y: 0 }
      return clientToPdf(viewport, element, event.clientX, event.clientY)
    },
    [viewport]
  )

  const pointerLocal = useCallback((event: { clientX: number; clientY: number }) => {
    const element = layerRef.current
    if (!element) return { x: 0, y: 0 }
    const rect = element.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }, [])

  const finishDrag = useCallback(() => {
    if (!dragRef.current) return
    dragRef.current = null
    useDocumentStore.getState().commitHistory()
    forceRender((value) => value + 1)
  }, [])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      event.preventDefault()
      const store = useDocumentStore.getState()
      const pdf = pointerPdf(event)

      if (drag.kind === 'move') {
        const delta = { x: pdf.x - drag.start.x, y: pdf.y - drag.start.y }
        const moved = snapRect(moveRect(drag.base, delta), page.width, page.height, 3)
        store.updateOverlay(drag.id, clampRectToPage(moved, page.width, page.height))
        return
      }

      if (drag.kind === 'resize') {
        const delta = { x: pdf.x - drag.start.x, y: pdf.y - drag.start.y }
        const base = { ...drag.base, ...effectiveOverlayRect(drag.base) }
        const resized = resizeRect(base, base.rotation, drag.handle, delta, event.shiftKey)
        const snapped = snapRect(resized, page.width, page.height, 3)
        store.updateOverlay(drag.id, clampRectToPage(snapped, page.width, page.height))
        return
      }

      if (drag.kind === 'rotate') {
        const local = pointerLocal(event)
        const centerScreen = viewport.convertToViewportPoint(drag.center.x, drag.center.y)
        const angle =
          (Math.atan2(local.y - centerScreen[1], local.x - centerScreen[0]) * 180) / Math.PI
        let rotation = drag.startRotation - (angle - drag.startAngle)
        if (event.shiftKey) rotation = Math.round(rotation / 15) * 15
        store.updateOverlay(drag.id, { rotation: ((rotation % 360) + 360) % 360 })
        return
      }

      if (drag.kind === 'draw') {
        const rect = normalizedRect(drag.start, pdf)
        store.updateOverlay(drag.id, clampRectToPage(rect, page.width, page.height))
      }
    }

    const onUp = () => finishDrag()

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [finishDrag, page.height, page.width, pointerLocal, pointerPdf, viewport])

  useEffect(() => {
    const element = layerRef.current?.parentElement
    if (!element) return
    const onHover = (event: PointerEvent) => {
      if (dragRef.current) return
      const store = useDocumentStore.getState()
      const local = pointerLocal(event)
      if (store.tool !== 'select') {
        element.style.cursor = store.tool === 'edit-text' ? 'text' : 'crosshair'
        return
      }
      const active = store.selectedOverlay()
      if (active) {
        const box = overlayScreenBox(
          { ...active, ...effectiveOverlayRect(active) },
          viewport,
          pageRotation
        )
        if (distance(local, rotateHandlePoint(box)) <= ROTATE_RADIUS) {
          element.style.cursor = 'grab'
          return
        }
        const handle = handlePoints(box).find((point) => distance(local, point) <= HANDLE_RADIUS)
        if (handle) {
          element.style.cursor = cursorForHandle(handle.id)
          return
        }
      }
      const pdf = pointerPdf(event)
      const hit = [...overlays].reverse().find((overlay) => hitTest(overlay, pdf))
      element.style.cursor = hit ? 'move' : 'default'
    }
    element.addEventListener('pointermove', onHover)
    return () => element.removeEventListener('pointermove', onHover)
  }, [overlays, pageRotation, pointerLocal, pointerPdf, viewport])

  const captureExistingRun = (event: PointerEvent) => {
    const element = document.elementFromPoint(event.clientX, event.clientY)
    const span = element?.closest('.text-layer span') as HTMLElement | null
    const layerRect = layerRef.current?.getBoundingClientRect()
    if (!span || !canvas || !layerRect) return

    const spanRect = span.getBoundingClientRect()
    const region = {
      left: spanRect.left - layerRect.left,
      top: spanRect.top - layerRect.top,
      width: spanRect.width,
      height: spanRect.height
    }
    const colors = sampleRunColors(canvas, region)

    const corners = [
      viewport.convertToPdfPoint(region.left, region.top),
      viewport.convertToPdfPoint(region.left + region.width, region.top),
      viewport.convertToPdfPoint(region.left, region.top + region.height),
      viewport.convertToPdfPoint(region.left + region.width, region.top + region.height)
    ]
    const xs = corners.map(([x]) => x)
    const ys = corners.map(([, y]) => y)
    const rect: Rect = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(0.1, Math.max(...xs) - Math.min(...xs)),
      h: Math.max(0.1, Math.max(...ys) - Math.min(...ys))
    }

    const style = window.getComputedStyle(span)
    const fontSize = parseFloat(style.fontSize) / viewport.scale
    if (!Number.isFinite(fontSize) || fontSize <= 1) {
      useUiStore.getState().showToast('Could not read that text run', 'error')
      return
    }

    const store = useDocumentStore.getState()
    const overlay = createTextEditOverlay(page, {
      rect,
      text: (span.textContent ?? '').replace(/\u00a0/g, ' '),
      fontFamily: inferFamily(style.fontFamily),
      fontSize: Number(fontSize.toFixed(2)),
      bold: Number(style.fontWeight) >= 600,
      italic: style.fontStyle === 'italic',
      align: inferAlign(span),
      color: colors.text,
      patchColor: colors.background
    })
    store.addOverlay(overlay)
    store.startEditing(overlay.id)
  }

  const placeStamp = (stampId: string, at: { x: number; y: number }) => {
    const overlay = createStampOverlay(page, stampId, '#c92a2a', at)
    if (overlay) useDocumentStore.getState().addOverlay(overlay)
  }

  const placeSignature = async (
    signature: { png: string; label: string },
    at: { x: number; y: number }
  ) => {
    const overlay = await createSignatureOverlay(page, signature.png, signature.label, at)
    useDocumentStore.getState().addOverlay(overlay)
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement | null)?.closest('.text-editor')) return
    // Stop the browser's default focus handling from stealing focus from an inline text editor
    // that is created by this very gesture.
    event.preventDefault()
    const store = useDocumentStore.getState()
    const local = pointerLocal(event)
    const pdf = pointerPdf(event)
    if (editingId) store.stopEditing()

    if (store.tool === 'select') {
      if (selected && !selected.locked) {
        const box = overlayScreenBox(
          { ...selected, ...effectiveOverlayRect(selected) },
          viewport,
          pageRotation
        )
        if (distance(local, rotateHandlePoint(box)) <= ROTATE_RADIUS) {
          const rect = effectiveOverlayRect(selected)
          const center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
          const centerScreen = viewport.convertToViewportPoint(center.x, center.y)
          const startAngle =
            (Math.atan2(local.y - centerScreen[1], local.x - centerScreen[0]) * 180) / Math.PI
          store.beginHistory()
          dragRef.current = {
            kind: 'rotate',
            id: selected.id,
            base: selected,
            center,
            startAngle,
            startRotation: selected.rotation
          }
          return
        }
        const handle = handlePoints(box).find((point) => distance(local, point) <= HANDLE_RADIUS)
        if (handle) {
          store.beginHistory()
          dragRef.current = {
            kind: 'resize',
            id: selected.id,
            start: pdf,
            base: selected,
            handle: handle.id
          }
          return
        }
      }

      const hit = [...overlays].reverse().find((overlay) => hitTest(overlay, pdf))
      if (!hit) {
        store.select(null)
        return
      }
      store.select(hit.id)
      if (hit.locked) return
      store.beginHistory()
      dragRef.current = { kind: 'move', id: hit.id, start: pdf, base: hit }
      return
    }

    if (store.tool === 'text') {
      const height = store.textDefaults.fontSize * store.textDefaults.lineHeight
      const overlay = createTextOverlay(page, store.textDefaults, {
        x: pdf.x,
        y: pdf.y - height,
        w: TEXT_BOX_WIDTH,
        h: height
      })
      store.addOverlay(overlay)
      store.startEditing(overlay.id)
      return
    }

    if (store.tool === 'edit-text') {
      captureExistingRun(event)
      return
    }

    if (store.tool === 'stamp' && store.pendingStampId) {
      placeStamp(store.pendingStampId, pdf)
      return
    }

    if (store.tool === 'signature' && store.pendingSignature) {
      void placeSignature(store.pendingSignature, pdf)
      return
    }

    if (store.tool === 'shape') {
      const shape = createShapeOverlay(page, shapeKind, { x: pdf.x, y: pdf.y, w: 1, h: 1 })
      store.beginHistory()
      store.addOverlay(shape)
      dragRef.current = { kind: 'draw', id: shape.id, start: pdf }
      return
    }

    if (store.tool === 'image') {
      void insertImageFromDisk()
    }
  }

  useEffect(() => {
    const element = layerRef.current?.parentElement
    if (!element) return
    const listener = (event: Event) => handlePointerDown(event as PointerEvent)
    element.addEventListener('pointerdown', listener)
    return () => element.removeEventListener('pointerdown', listener)
  }, [handlePointerDown])

  return (
    <div ref={layerRef} className="overlay-layer">
      {overlays.map((overlay) => (
        <OverlayView
          key={overlay.id}
          overlay={overlay}
          viewport={viewport}
          pageRotation={pageRotation}
        />
      ))}
      {selectedBox && !editingId && <SelectionFrame box={selectedBox} locked={selected?.locked} />}
      {editing && (editing.type === 'text' || editing.type === 'text-edit') && (
        <TextInlineEditor overlay={editing} viewport={viewport} pageRotation={pageRotation} />
      )}
    </div>
  )
}
