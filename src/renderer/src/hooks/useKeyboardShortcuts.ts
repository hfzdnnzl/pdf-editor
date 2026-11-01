import { useEffect } from 'react'
import { isDesktop } from '@/platform'
import { openFileDialog, savePdf } from '@/state/fileActions'
import { useUiStore } from '@/state/uiStore'
import { useDocumentStore } from '@/state/documentStore'

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return element.isContentEditable || EDITABLE.has(element.tagName)
}

/** Shortcuts that the native menu does not already cover (or all of them in the browser build). */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const typing = isTypingTarget(event.target)

      if (mod && key === 's') {
        if (!isDesktop) {
          event.preventDefault()
          void savePdf({ saveAs: event.shiftKey })
        }
        return
      }
      if (mod && key === 'o') {
        if (!isDesktop) {
          event.preventDefault()
          void openFileDialog()
        }
        return
      }
      if (mod) return
      if (typing || event.altKey) return

      const store = useDocumentStore.getState()
      if (!store.pdf) return

      if (key === 'escape') {
        store.stopEditing()
        store.select(null)
        return
      }

      if (key === 'delete' || key === 'backspace') {
        if (store.selectedId) {
          event.preventDefault()
          store.deleteSelected()
        }
        return
      }

      if (key.startsWith('arrow')) {
        if (!store.selectedId) return
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        if (key === 'arrowleft') store.nudgeSelected(-step, 0)
        if (key === 'arrowright') store.nudgeSelected(step, 0)
        if (key === 'arrowup') store.nudgeSelected(0, step)
        if (key === 'arrowdown') store.nudgeSelected(0, -step)
        return
      }

      if (key === 'v') store.setTool('select')
      if (key === 't') store.setTool('text')
      if (key === 'x') store.setTool('edit-text')
      if (key === 's') useUiStore.getState().openDialog('signatures')
      if (key === 'i') useUiStore.getState().openDialog('stamps')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
