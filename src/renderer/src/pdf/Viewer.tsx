import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentStore } from '@/state/documentStore'
import { PageView } from './PageView'

const PAGE_GAP = 22
const VIEWPORT_PADDING = 24

export function Viewer() {
  const pages = useDocumentStore((state) => state.pages)
  const zoom = useDocumentStore((state) => state.zoom)
  const zoomMode = useDocumentStore((state) => state.zoomMode)
  const activePageId = useDocumentStore((state) => state.activePageId)
  const setZoom = useDocumentStore((state) => state.setZoom)
  const setActivePage = useDocumentStore((state) => state.setActivePage)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setScrollRoot(scrollRef.current)
  }, [])

  const isSwapped = (page: (typeof pages)[number]): boolean =>
    (page.sourceRotation + page.rotation) % 180 !== 0
  const naturalPageWidth = Math.max(1, ...pages.map((page) => (isSwapped(page) ? page.height : page.width)))
  const naturalPageHeight = Math.max(1, ...pages.map((page) => (isSwapped(page) ? page.width : page.height)))

  const recomputeFit = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    if (zoomMode === 'custom') return
    const availableWidth = container.clientWidth - VIEWPORT_PADDING * 2
    const availableHeight = container.clientHeight - VIEWPORT_PADDING * 2
    const next =
      zoomMode === 'fit-width'
        ? availableWidth / naturalPageWidth
        : Math.min(availableWidth / naturalPageWidth, availableHeight / naturalPageHeight)
    if (Number.isFinite(next) && next > 0) {
      const clamped = Math.min(4, Math.max(0.15, next))
      if (Math.abs(clamped - zoom) > 0.001) setZoom(clamped, zoomMode)
    }
  }, [naturalPageHeight, naturalPageWidth, setZoom, zoom, zoomMode])

  useEffect(() => {
    recomputeFit()
  }, [recomputeFit, pages.length])

  useEffect(() => {
    const container = scrollRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => recomputeFit())
    observer.observe(container)
    return () => observer.disconnect()
  }, [recomputeFit])

  useEffect(() => {
    const container = scrollRef.current
    if (!container || !activePageId) return
    const element = container.querySelector<HTMLElement>(`[data-page-id="${activePageId}"]`)
    if (!element) return
    const rect = element.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const fullyVisible = rect.top >= containerRect.top && rect.bottom <= containerRect.bottom
    if (!fullyVisible) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activePageId])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const containerRect = container.getBoundingClientRect()
        // Reading starts at the top, so anchor the current page near the top edge.
        const center = containerRect.top + Math.min(140, containerRect.height * 0.25)
        let bestId: string | null = null
        let bestDistance = Number.POSITIVE_INFINITY
        container.querySelectorAll<HTMLElement>('[data-page-id]').forEach((element) => {
          const rect = element.getBoundingClientRect()
          const elementCenter = rect.top + rect.height / 2
          const distanceToCenter = Math.abs(elementCenter - center)
          if (distanceToCenter < bestDistance) {
            bestDistance = distanceToCenter
            bestId = element.dataset.pageId ?? null
          }
        })
        if (bestId && bestId !== useDocumentStore.getState().activePageId) {
          setActivePage(bestId)
        }
      })
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [setActivePage])

  return (
    <div className="viewer">
      <div className="viewer__scroll" ref={scrollRef}>
        <div className="viewer__pages" style={{ gap: PAGE_GAP }}>
          {pages.map((page, index) => (
            <PageView
              key={page.id}
              page={page}
              index={index}
              scale={zoom}
              scrollRoot={scrollRoot}
              isActive={page.id === activePageId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
