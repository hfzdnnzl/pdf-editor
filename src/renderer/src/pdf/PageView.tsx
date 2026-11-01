import { useCallback, useEffect, useRef, useState } from 'react'
import { TextLayer } from 'pdfjs-dist'
import type { PDFPageProxy, PageViewport } from 'pdfjs-dist'
import type { PageModel } from '@shared/types'
import type { ViewportLike } from '@/lib/geometry'
import { useDocumentStore } from '@/state/documentStore'
import { OverlayLayer } from '@/overlays/OverlayLayer'

interface Props {
  page: PageModel
  index: number
  scale: number
  scrollRoot: HTMLElement | null
  isActive: boolean
}

function blankViewport(page: PageModel, scale: number): ViewportLike {
  const rotation = (page.sourceRotation + page.rotation) % 360
  const swap = rotation === 90 || rotation === 270
  return {
    scale,
    rotation,
    width: (swap ? page.height : page.width) * scale,
    height: (swap ? page.width : page.height) * scale,
    convertToViewportPoint: (x, y) => {
      switch (rotation) {
        case 90:
          return [y * scale, x * scale]
        case 180:
          return [(page.width - x) * scale, y * scale]
        case 270:
          return [(page.height - y) * scale, (page.width - x) * scale]
        default:
          return [x * scale, (page.height - y) * scale]
      }
    },
    convertToPdfPoint: (vx, vy) => {
      const x = vx / scale
      const y = vy / scale
      switch (rotation) {
        case 90:
          return [y, x]
        case 180:
          return [page.width - x, y]
        case 270:
          return [page.width - y, page.height - x]
        default:
          return [x, page.height - y]
      }
    }
  }
}

export function PageView({ page, index, scale, scrollRoot, isActive }: Props) {
  const pdf = useDocumentStore((state) => state.pdf)
  const tool = useDocumentStore((state) => state.tool)
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const [pdfPage, setPdfPage] = useState<PDFPageProxy | null>(null)
  const [viewport, setViewport] = useState<PageViewport | null>(null)
  const [visible, setVisible] = useState(false)
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    setCanvasElement(canvasRef.current)
  }, [page.id])

  useEffect(() => {
    let cancelled = false
    setPdfPage(null)
    if (!pdf || page.sourceIndex === null) return
    pdf
      .getPage(page.sourceIndex + 1)
      .then((loaded) => {
        if (cancelled) return
        setPdfPage(loaded)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pdf, page.sourceIndex])

  useEffect(() => {
    if (!pdfPage) {
      setViewport(null)
      return
    }
    setViewport(
      pdfPage.getViewport({ scale, rotation: (page.sourceRotation + page.rotation) % 360 })
    )
  }, [pdfPage, scale, page.sourceRotation, page.rotation])

  useEffect(() => {
    const element = rootRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setVisible(true)
        }
      },
      { root: scrollRoot, rootMargin: '900px 0px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !viewport || !pdfPage || !visible) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    const context = canvas.getContext('2d')
    if (!context) return
    const task = pdfPage.render({
      canvasContext: context,
      canvas,
      viewport,
      transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0]
    })
    task.promise.catch((error: unknown) => {
      const name = (error as { name?: string } | null)?.name
      if (name !== 'RenderingCancelledException') console.warn('[pdf] render failed', error)
    })
    return () => task.cancel()
  }, [pdfPage, viewport, visible])

  useEffect(() => {
    const container = textLayerRef.current
    if (!container || !pdfPage || !viewport || !visible) return
    // Every render gets its own holder so a slow, superseded render can never append duplicate
    // spans into the live layer (zoom and rotation changes restart rendering often).
    const holder = document.createElement('div')
    holder.className = 'text-layer__holder'
    container.replaceChildren(holder)
    const layer = new TextLayer({
      textContentSource: pdfPage.streamTextContent(),
      container: holder,
      viewport
    })
    layer.render().catch(() => undefined)
    return () => {
      if (container.firstChild === holder) container.replaceChildren()
    }
  }, [pdfPage, viewport, visible])

  const fallback = blankViewport(page, scale)
  const width = viewport?.width ?? fallback.width
  const height = viewport?.height ?? fallback.height
  const rotation = (page.sourceRotation + page.rotation) % 360
  const activeViewport: ViewportLike = viewport
    ? {
        scale: viewport.scale,
        width: viewport.width,
        height: viewport.height,
        convertToViewportPoint: (x, y) => viewport.convertToViewportPoint(x, y) as [number, number],
        convertToPdfPoint: (x, y) => viewport.convertToPdfPoint(x, y) as [number, number]
      }
    : fallback

  const setCanvasRef = useCallback((element: HTMLCanvasElement | null) => {
    canvasRef.current = element
    if (element) setCanvasElement(element)
  }, [])

  return (
    <div
      className="page-wrap"
      ref={rootRef}
      data-page-index={index}
      data-page-id={page.id}
      data-active={isActive ? 'true' : 'false'}
      style={{ width, height }}
    >
      <div
        className={`page${tool === 'edit-text' ? ' is-edit-text-mode' : ''}`}
        style={{ width, height, ['--total-scale-factor' as string]: scale }}
      >
        {page.sourceIndex === null ? (
          <div className="page__loading" style={{ background: '#fff' }} />
        ) : (
          <canvas ref={setCanvasRef} />
        )}
        <div className="text-layer" ref={textLayerRef} />
        <OverlayLayer
          page={page}
          viewport={activeViewport}
          pageRotation={rotation}
          canvas={canvasElement}
        />
        <span className="page__badge">Page {index + 1}</span>
      </div>
    </div>
  )
}
