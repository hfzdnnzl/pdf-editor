import { useEffect, useRef, useState } from 'react'
import type { PageModel } from '@shared/types'
import { useDocumentStore } from '@/state/documentStore'
import { PlusIcon, RotateCwIcon, TrashIcon } from './Icons'

const THUMB_WIDTH = 118

function Thumbnail({ page }: { page: PageModel }) {
  const pdf = useDocumentStore((state) => state.pdf)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [aspect, setAspect] = useState(page.width / Math.max(1, page.height))

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas || !pdf || page.sourceIndex === null) return

    pdf
      .getPage(page.sourceIndex + 1)
      .then(async (pdfPage) => {
        if (cancelled) return
        const rotation = (page.sourceRotation + page.rotation) % 360
        const base = pdfPage.getViewport({ scale: 1, rotation })
        const scale = THUMB_WIDTH / base.width
        const viewport = pdfPage.getViewport({ scale, rotation })
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        setAspect(viewport.width / Math.max(1, viewport.height))
        const context = canvas.getContext('2d')
        if (!context) return
        await pdfPage
          .render({
            canvasContext: context,
            canvas,
            viewport,
            transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0]
          })
          .promise.catch(() => undefined)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [pdf, page.sourceIndex, page.rotation, page.sourceRotation])

  if (page.sourceIndex === null) {
    return (
      <div className="thumb__frame" style={{ width: THUMB_WIDTH, height: THUMB_WIDTH / aspect }}>
        <span className="hint" style={{ color: '#9aa7b4' }}>
          Blank
        </span>
      </div>
    )
  }

  return (
    <div className="thumb__frame" style={{ width: THUMB_WIDTH }}>
      <canvas ref={canvasRef} />
    </div>
  )
}

export function PageSidebar() {
  const pages = useDocumentStore((state) => state.pages)
  const activePageId = useDocumentStore((state) => state.activePageId)
  const setActivePage = useDocumentStore((state) => state.setActivePage)
  const movePage = useDocumentStore((state) => state.movePage)
  const rotatePage = useDocumentStore((state) => state.rotatePage)
  const deletePage = useDocumentStore((state) => state.deletePage)
  const insertBlankPage = useDocumentStore((state) => state.insertBlankPage)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <span>Pages</span>
        <button
          className="iconbtn"
          style={{ width: 22, height: 22 }}
          title="Insert blank page after current"
          onClick={() => insertBlankPage(activePageId)}
        >
          <PlusIcon size={14} />
        </button>
      </div>
      <div className="sidebar__list">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className={`thumb${page.id === activePageId ? ' is-active' : ''}${
              dropIndex === index ? ' is-drop-target' : ''
            }`}
            draggable
            onDragStart={(event) => {
              setDragIndex(index)
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDropIndex(index)
            }}
            onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
            onDrop={(event) => {
              event.preventDefault()
              if (dragIndex !== null && dragIndex !== index) movePage(dragIndex, index)
              setDragIndex(null)
              setDropIndex(null)
            }}
            onDragEnd={() => {
              setDragIndex(null)
              setDropIndex(null)
            }}
            onClick={() => setActivePage(page.id)}
          >
            <Thumbnail page={page} />
            <div className="thumb__label">{index + 1}</div>
            <button
              className="thumb__action"
              title="Rotate page"
              onClick={(event) => {
                event.stopPropagation()
                rotatePage(page.id, 90)
              }}
            >
              <RotateCwIcon size={13} />
            </button>
            {pages.length > 1 && (
              <button
                className="thumb__action"
                style={{ right: 32 }}
                title="Delete page"
                onClick={(event) => {
                  event.stopPropagation()
                  deletePage(page.id)
                }}
              >
                <TrashIcon size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
