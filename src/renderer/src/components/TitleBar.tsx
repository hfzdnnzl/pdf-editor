import type { CSSProperties } from 'react'
import { desk } from '@/platform'
import { useDocumentStore } from '@/state/documentStore'
import { useUiStore } from '@/state/uiStore'

export function TitleBar() {
  const fileName = useDocumentStore((state) => state.fileName)
  const dirty = useDocumentStore((state) => state.dirty)
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const platform = desk.platform

  return (
    <header className={`titlebar${platform === 'darwin' ? ' is-mac' : ''}`}>
      <span className="titlebar__app">PDF Studio</span>
      {fileName && <span className="titlebar__sep">/</span>}
      {fileName && (
        <span className="titlebar__title" title={fileName}>
          {fileName}
        </span>
      )}
      {dirty && <span className="titlebar__dirty" title="Unsaved changes" />}
      <span className="titlebar__spacer" />
      <button
        className="iconbtn"
        style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? '☾' : '☀'}
      </button>
    </header>
  )
}
