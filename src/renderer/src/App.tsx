import { useCallback, useEffect, useState } from 'react'
import type { MenuCommand } from '@shared/types'
import { desk } from '@/platform'
import { EmptyState } from '@/components/EmptyState'
import { DialogHost } from '@/components/Dialogs'
import { PageSidebar } from '@/components/PageSidebar'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { StatusBar } from '@/components/StatusBar'
import { TitleBar } from '@/components/TitleBar'
import { Toast } from '@/components/Toast'
import { Toolbar } from '@/components/Toolbar'
import { ToolRail } from '@/components/ToolRail'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Viewer } from '@/pdf/Viewer'
import {
  openFileDialog,
  openPdfFromData,
  openPdfFromDataPath,
  saveBeforeClose,
  savePdf
} from '@/state/fileActions'
import { useDocumentStore } from '@/state/documentStore'
import { useFontStore } from '@/state/fontStore'
import { resolvedTheme, useUiStore } from '@/state/uiStore'

const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null
  if (!element) return false
  return (
    element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
  )
}

export function App() {
  const pdf = useDocumentStore((state) => state.pdf)
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const propertiesOpen = useUiStore((state) => state.propertiesOpen)
  const theme = useUiStore((state) => state.theme)
  const systemDark = useUiStore((state) => state.systemDark)
  const overlays = useDocumentStore((state) => state.overlays)
  const fileName = useDocumentStore((state) => state.fileName)
  const dirty = useDocumentStore((state) => state.dirty)
  const filePath = useDocumentStore((state) => state.filePath)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  useKeyboardShortcuts()

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme(theme, systemDark)
  }, [theme, systemDark])

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (matches: boolean) => useUiStore.getState().setSystemDark(matches)
    apply(query.matches)
    const listener = (event: MediaQueryListEvent) => apply(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    desk
      .getSettings()
      .then((settings) => {
        useUiStore.getState().setTheme(settings.theme)
        void useFontStore.getState().refresh()
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    desk.setDocumentState({
      title: fileName ?? 'PDF Studio',
      dirty,
      path: filePath
    })
  }, [fileName, dirty, filePath])

  useEffect(() => {
    const customIds = new Set<string>()
    for (const list of Object.values(overlays)) {
      for (const overlay of list) {
        if (
          (overlay.type === 'text' || overlay.type === 'text-edit') &&
          overlay.fontFamily.startsWith('custom:')
        ) {
          customIds.add(overlay.fontFamily.slice('custom:'.length))
        }
      }
    }
    for (const id of customIds) void useFontStore.getState().ensureLoaded(id)
  }, [overlays])

  const withBusy = useCallback(async (task: () => Promise<void>) => {
    setBusy(true)
    try {
      await task()
    } finally {
      setBusy(false)
    }
  }, [])

  const runCommand = useCallback(
    (command: MenuCommand) => {
      const store = useDocumentStore.getState()
      const ui = useUiStore.getState()
      const active = store.pages.find((page) => page.id === store.activePageId)

      switch (command) {
        case 'file:open':
          void openFileDialog()
          break
        case 'file:save':
          void savePdf()
          break
        case 'file:save-as':
          void savePdf({ saveAs: true })
          break
        case 'file:export':
          void savePdf({ exportCopy: true })
          break
        case 'edit:undo':
          if (isTypingTarget(document.activeElement)) document.execCommand('undo')
          else store.undo()
          break
        case 'edit:redo':
          if (isTypingTarget(document.activeElement)) document.execCommand('redo')
          else store.redo()
          break
        case 'edit:delete':
          if (!isTypingTarget(document.activeElement)) store.deleteSelected()
          break
        case 'edit:duplicate':
          if (!isTypingTarget(document.activeElement)) store.duplicateSelected()
          break
        case 'edit:select-all': {
          const element = document.activeElement
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.select()
          }
          break
        }
        case 'view:zoom-in':
          store.setZoom(store.zoom + 0.1, 'custom')
          break
        case 'view:zoom-out':
          store.setZoom(store.zoom - 0.1, 'custom')
          break
        case 'view:zoom-reset':
          store.setZoom(1, 'custom')
          break
        case 'view:fit-width':
          store.setZoom(store.zoom, 'fit-width')
          break
        case 'view:fit-page':
          store.setZoom(store.zoom, 'fit-page')
          break
        case 'page:rotate-cw':
          if (active) store.rotatePage(active.id, 90)
          break
        case 'page:rotate-ccw':
          if (active) store.rotatePage(active.id, -90)
          break
        case 'page:delete':
          if (active) store.deletePage(active.id)
          break
        case 'page:insert-blank':
          store.insertBlankPage(active?.id ?? null)
          break
        case 'page:duplicate':
          if (active) store.duplicatePage(active.id)
          break
        case 'tool:select':
        case 'tool:text':
        case 'tool:edit-text':
          store.setTool(command.slice('tool:'.length) as 'select' | 'text' | 'edit-text')
          break
        case 'tool:signature':
          ui.openDialog('signatures')
          break
        case 'tool:stamp':
          ui.openDialog('stamps')
          break
        case 'help:shortcuts':
          ui.openDialog('shortcuts')
          break
        case 'help:about':
          ui.openDialog('about')
          break
        default:
          break
      }
    },
    []
  )

  useEffect(() => {
    const unsubscribeMenu = desk.onMenuCommand(runCommand)
    const unsubscribeOpen = desk.onOpenFile((path) => {
      void withBusy(() => openPdfFromDataPath(path))
    })
    const unsubscribeSave = desk.onRequestSave(() => {
      void saveBeforeClose()
    })
    return () => {
      unsubscribeMenu()
      unsubscribeOpen()
      unsubscribeSave()
    }
  }, [runCommand, withBusy])

  useEffect(() => {
    let depth = 0
    const hasFiles = (event: DragEvent): boolean =>
      Boolean(event.dataTransfer?.types?.includes('Files'))

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth += 1
      setDragging(true)
    }
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      event.dataTransfer!.dropEffect = 'copy'
    }
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        useUiStore.getState().showToast('Only PDF files can be opened', 'error')
        return
      }
      void withBusy(async () => {
        const data = new Uint8Array(await file.arrayBuffer())
        await openPdfFromData(data, file.name, null)
      })
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [withBusy])

  return (
    <div className="app">
      <TitleBar />
      <Toolbar />
      <div className="workspace" style={{ position: 'relative' }}>
        {busy && <div className="busy-bar" />}
        <ToolRail />
        {sidebarOpen && pdf && <PageSidebar />}
        {pdf ? <Viewer /> : <EmptyState />}
        {propertiesOpen && pdf && <PropertiesPanel />}
      </div>
      <StatusBar />
      <Toast />
      <DialogHost />
      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay__box">Drop a PDF to open it</div>
        </div>
      )}
    </div>
  )
}

export default App
