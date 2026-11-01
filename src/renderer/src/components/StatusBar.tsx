import { useDocumentStore } from '@/state/documentStore'
import { useUiStore } from '@/state/uiStore'
import { textWarnings } from '@/state/fileActions'

export function StatusBar() {
  const pages = useDocumentStore((state) => state.pages)
  const activePageId = useDocumentStore((state) => state.activePageId)
  const zoom = useDocumentStore((state) => state.zoom)
  const dirty = useDocumentStore((state) => state.dirty)
  const selectedId = useDocumentStore((state) => state.selectedId)
  const overlays = useDocumentStore((state) => state.overlays)
  const tool = useDocumentStore((state) => state.tool)
  const toast = useUiStore((state) => state.toast)

  const pageIndex = pages.findIndex((page) => page.id === activePageId)
  const overlayCount = Object.values(overlays).reduce((total, list) => total + list.length, 0)
  const warnings = textWarnings()

  return (
    <footer className="statusbar">
      <span className="statusbar__item">
        <span className="statusbar__dot" style={{ background: dirty ? 'var(--warning)' : 'var(--success)' }} />
        {dirty ? 'Unsaved changes' : 'All changes saved'}
      </span>
      <span>Page {pageIndex >= 0 ? pageIndex + 1 : 1} of {pages.length || 1}</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span>{overlayCount} object{overlayCount === 1 ? '' : 's'}</span>
      <span className="statusbar__spacer" />
      {warnings.length > 0 && (
        <span className="statusbar__item" style={{ color: 'var(--warning)' }} title={warnings.join('\n')}>
          ⚠ {warnings.length} font warning{warnings.length === 1 ? '' : 's'}
        </span>
      )}
      <span>{selectedId ? 'Selection active' : `Tool: ${tool}`}</span>
      {toast?.tone === 'error' && <span style={{ color: 'var(--danger)' }}>{toast.message}</span>}
    </footer>
  )
}
