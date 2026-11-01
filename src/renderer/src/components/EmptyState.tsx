import { useEffect, useState } from 'react'
import type { RecentFile } from '@shared/types'
import { desk } from '@/platform'
import { openFileDialog, openPdfFromDataPath } from '@/state/fileActions'
import { useDocumentStore } from '@/state/documentStore'
import { FilePdfIcon, FolderIcon } from './Icons'

export function EmptyState() {
  const [recent, setRecent] = useState<RecentFile[]>([])
  const setTool = useDocumentStore((state) => state.setTool)

  useEffect(() => {
    desk
      .getSettings()
      .then((settings) => setRecent(settings.recent))
      .catch(() => undefined)
  }, [])

  return (
    <div className="empty">
      <div className="empty__mark">
        <FilePdfIcon size={34} />
      </div>
      <h1>Open a PDF to get started</h1>
      <p>
        Add and rewrite text with real font controls, drop in signatures, stamps and images, then
        export a flattened PDF. Everything runs locally on your machine.
      </p>
      <div className="empty__row">
        <button className="btn btn--primary" onClick={() => void openFileDialog()}>
          <FolderIcon size={15} /> Open PDF…
        </button>
        <button
          className="btn"
          onClick={() => void openFileDialog().then(() => setTool('text'))}
        >
          Open &amp; add text
        </button>
      </div>
      <p className="hint">or drag a PDF anywhere into this window</p>

      {recent.length > 0 && (
        <div className="empty__recent">
          <div className="empty__recent-title">Recent</div>
          {recent.slice(0, 6).map((entry) => (
            <button
              key={entry.path}
              className="recent-item"
              onClick={() => void openPdfFromDataPath(entry.path)}
              title={entry.path}
            >
              <FilePdfIcon size={15} />
              <span>{entry.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
