import { useEffect, useRef, useState } from 'react'
import { desk } from '@/platform'
import { openFileDialog, savePdf } from '@/state/fileActions'
import { useDocumentStore } from '@/state/documentStore'
import { useUiStore } from '@/state/uiStore'
import {
  KeyboardIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  PanelRightIcon,
  RedoIcon,
  SaveIcon,
  SidebarIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon
} from './Icons'

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

export function Toolbar() {
  const hasDocument = useDocumentStore((state) => Boolean(state.pdf))
  const zoom = useDocumentStore((state) => state.zoom)
  const zoomMode = useDocumentStore((state) => state.zoomMode)
  const setZoom = useDocumentStore((state) => state.setZoom)
  const pages = useDocumentStore((state) => state.pages)
  const activePageId = useDocumentStore((state) => state.activePageId)
  const setActivePage = useDocumentStore((state) => state.setActivePage)
  const canUndo = useDocumentStore((state) => state.past.length > 0)
  const canRedo = useDocumentStore((state) => state.future.length > 0)
  const undo = useDocumentStore((state) => state.undo)
  const redo = useDocumentStore((state) => state.redo)
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const propertiesOpen = useUiStore((state) => state.propertiesOpen)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const toggleProperties = useUiStore((state) => state.toggleProperties)

  const [zoomMenuOpen, setZoomMenuOpen] = useState(false)
  const [pageDraft, setPageDraft] = useState('')
  const zoomRef = useRef<HTMLDivElement>(null)
  const platform = desk.platform
  const mod = platform === 'darwin' ? '⌘' : 'Ctrl'

  const pageIndex = Math.max(0, pages.findIndex((page) => page.id === activePageId))

  useEffect(() => {
    setPageDraft(String(pageIndex + 1))
  }, [pageIndex])

  useEffect(() => {
    if (!zoomMenuOpen) return
    const onClick = (event: MouseEvent) => {
      if (!zoomRef.current?.contains(event.target as Node)) setZoomMenuOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [zoomMenuOpen])

  const goToPage = (index: number) => {
    const clamped = Math.min(pages.length - 1, Math.max(0, index))
    const page = pages[clamped]
    if (page) setActivePage(page.id)
  }

  return (
    <div className="toolbar">
      <div className="toolbar__group">
        <button className="btn" onClick={() => void openFileDialog()} title={`Open (${mod}O)`}>
          <FolderIcon size={15} /> Open
        </button>
        <button
          className="btn"
          disabled={!hasDocument}
          onClick={() => void savePdf()}
          title={`Save (${mod}S)`}
        >
          <SaveIcon size={15} /> Save
        </button>
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__group">
        <button className="iconbtn" disabled={!canUndo} onClick={undo} title={`Undo (${mod}Z)`}>
          <UndoIcon size={17} />
        </button>
        <button className="iconbtn" disabled={!canRedo} onClick={redo} title={`Redo (⇧${mod}Z)`}>
          <RedoIcon size={17} />
        </button>
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__group page-nav">
        <button
          className="iconbtn"
          disabled={!hasDocument || pageIndex === 0}
          onClick={() => goToPage(pageIndex - 1)}
          title="Previous page"
        >
          <ChevronLeftIcon size={16} />
        </button>
        <input
          value={pageDraft}
          disabled={!hasDocument}
          onChange={(event) => setPageDraft(event.target.value)}
          onBlur={() => {
            const parsed = Number.parseInt(pageDraft, 10)
            if (Number.isFinite(parsed)) goToPage(parsed - 1)
            else setPageDraft(String(pageIndex + 1))
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
          }}
        />
        <span>/ {pages.length || 1}</span>
        <button
          className="iconbtn"
          disabled={!hasDocument || pageIndex >= pages.length - 1}
          onClick={() => goToPage(pageIndex + 1)}
          title="Next page"
        >
          <ChevronRightIcon size={16} />
        </button>
      </div>

      <div className="toolbar__spacer" />

      <div className="zoom-control" ref={zoomRef}>
        <button
          className="iconbtn"
          disabled={!hasDocument}
          onClick={() => setZoom(zoom - 0.1, 'custom')}
          title={`Zoom out (${mod}−)`}
        >
          <ZoomOutIcon size={16} />
        </button>
        <button
          className="zoom-control__value"
          disabled={!hasDocument}
          onClick={() => setZoomMenuOpen((open) => !open)}
          title="Zoom options"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          className="iconbtn"
          disabled={!hasDocument}
          onClick={() => setZoom(zoom + 0.1, 'custom')}
          title={`Zoom in (${mod}+)`}
        >
          <ZoomInIcon size={16} />
        </button>
        {zoomMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 40,
              right: 0,
              zIndex: 40,
              width: 176,
              padding: 4,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 9,
              boxShadow: '0 14px 30px rgba(0,0,0,0.35)'
            }}
          >
            {[
              { label: 'Fit width', action: () => setZoom(zoom, 'fit-width'), active: zoomMode === 'fit-width' },
              { label: 'Fit page', action: () => setZoom(zoom, 'fit-page'), active: zoomMode === 'fit-page' },
              { label: 'Actual size', action: () => setZoom(1, 'custom'), active: zoomMode === 'custom' && zoom === 1 }
            ].map((option) => (
              <button
                key={option.label}
                className="recent-item"
                onClick={() => {
                  option.action()
                  setZoomMenuOpen(false)
                }}
              >
                {option.label}
                {option.active ? ' ✓' : ''}
              </button>
            ))}
            <div className="rail__divider" style={{ width: '100%' }} />
            {ZOOM_PRESETS.map((preset) => (
              <button
                key={preset}
                className="recent-item"
                onClick={() => {
                  setZoom(preset, 'custom')
                  setZoomMenuOpen(false)
                }}
              >
                {Math.round(preset * 100)}%
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar__divider" />

      <div className="toolbar__group">
        <button
          className={`iconbtn${sidebarOpen ? ' is-active' : ''}`}
          onClick={toggleSidebar}
          title="Toggle page thumbnails"
        >
          <SidebarIcon size={17} />
        </button>
        <button
          className={`iconbtn${propertiesOpen ? ' is-active' : ''}`}
          onClick={toggleProperties}
          title="Toggle properties panel"
        >
          <PanelRightIcon size={17} />
        </button>
        <button
          className="iconbtn"
          onClick={() => useUiStore.getState().openDialog('shortcuts')}
          title="Keyboard shortcuts"
        >
          <KeyboardIcon size={16} />
        </button>
      </div>
    </div>
  )
}
