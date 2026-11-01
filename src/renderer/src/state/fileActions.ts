import type { Overlay, PageModel, ProjectFile } from '@shared/types'
import { buildPdf, unsupportedCharacters } from '@/pdf/buildPdf'
import { buildPageModels, openPdfDocument } from '@/pdf/pdfjs'
import { createImageOverlay } from '@/overlays/factories'
import { desk } from '@/platform'
import { useDocumentStore } from './documentStore'
import { useFontStore } from './fontStore'
import { useUiStore } from './uiStore'

const toast = (message: string, tone: 'info' | 'success' | 'error' = 'info'): void =>
  useUiStore.getState().showToast(message, tone)

function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/)
  return parts[parts.length - 1] || filePath
}

function parseProject(raw: string): ProjectFile | null {
  try {
    const parsed = JSON.parse(raw) as ProjectFile
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.pages)) return null
    return parsed
  } catch {
    return null
  }
}

function sanitizeProjectPages(project: ProjectFile, pageCount: number): PageModel[] | null {
  const pages = project.pages.filter(
    (page) =>
      page &&
      typeof page.id === 'string' &&
      typeof page.width === 'number' &&
      typeof page.height === 'number' &&
      (page.sourceIndex === null ||
        (typeof page.sourceIndex === 'number' && page.sourceIndex >= 0 && page.sourceIndex < pageCount))
  ).map((page) => ({ ...page, sourceRotation: page.sourceRotation ?? 0 }))
  return pages.length > 0 ? pages : null
}

export async function openPdfFromData(
  data: Uint8Array,
  fileName: string,
  filePath: string | null
): Promise<void> {
  const store = useDocumentStore.getState()
  try {
    const pdf = await openPdfDocument(data)
    let pages = await buildPageModels(pdf)
    let overlays: Record<string, Overlay[]> = {}
    let restored = false

    if (filePath) {
      const raw = await desk.readProject(filePath)
      const project = raw ? parseProject(raw) : null
      const projectPages = project ? sanitizeProjectPages(project, pdf.numPages) : null
      if (project && projectPages) {
        pages = projectPages
        overlays = Object.fromEntries(
          Object.entries(project.overlays ?? {}).filter(([, list]) => Array.isArray(list))
        ) as Record<string, Overlay[]>
        restored = true
      }
    }

    store.loadDocument({ pdf, sourceBytes: data, pages, overlays, fileName, filePath })
    console.info(`[pdf-studio] loaded ${fileName}: ${pages.length} page(s), ${pdf.numPages} in source`)
    await useFontStore.getState().refresh()
    if (restored) toast('Reopened with saved edits from the project sidecar', 'success')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('password') || message.includes('Password')) {
      throw new Error('This PDF is encrypted. Password-protected files are not supported yet.')
    }
    throw new Error(`Could not open this PDF: ${message}`)
  }
}

export async function openFileDialog(): Promise<void> {
  if (!confirmDiscardChanges()) return
  try {
    const opened = await desk.openPdfDialog()
    if (!opened) return
    await openPdfFromData(opened.data, opened.name, opened.path)
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error')
  }
}

export async function openPdfFromDataPath(filePath: string): Promise<void> {
  if (!confirmDiscardChanges()) return
  try {
    const opened =
      (await desk.openPdfAtPath(filePath)) ?? (await desk.readPdfAtPath(filePath))
    if (!opened) {
      toast(`Could not read ${baseName(filePath)}`, 'error')
      return
    }
    await openPdfFromData(opened.data, opened.name, opened.path)
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error')
  }
}

function confirmDiscardChanges(): boolean {
  const state = useDocumentStore.getState()
  if (!state.pdf || !state.dirty) return true
  return window.confirm('Discard unsaved changes in the current document?')
}

async function collectFonts(): Promise<Record<string, Uint8Array>> {
  const { overlays } = useDocumentStore.getState()
  const ids = new Set<string>()
  for (const list of Object.values(overlays)) {
    for (const overlay of list) {
      if (overlay.type === 'text' || overlay.type === 'text-edit') {
        if (overlay.fontFamily.startsWith('custom:')) {
          ids.add(overlay.fontFamily.slice('custom:'.length))
        }
      }
    }
  }
  const fonts: Record<string, Uint8Array> = {}
  for (const id of ids) {
    const loaded = await useFontStore.getState().ensureLoaded(id)
    if (loaded) fonts[id] = loaded.bytes
  }
  return fonts
}

export function textWarnings(): string[] {
  const warnings: string[] = []
  for (const list of Object.values(useDocumentStore.getState().overlays)) {
    for (const overlay of list) {
      if (overlay.type !== 'text' && overlay.type !== 'text-edit') continue
      if (overlay.fontFamily.startsWith('custom:')) continue
      const missing = unsupportedCharacters(overlay.text)
      if (missing.length > 0) {
        warnings.push(`“${missing.join(' ')}” is not supported by the built-in fonts`)
      }
    }
  }
  return warnings
}

export async function savePdf(options: {
  saveAs?: boolean
  exportCopy?: boolean
} = {}): Promise<boolean> {
  const state = useDocumentStore.getState()
  if (!state.pdf || !state.sourceBytes) return false

  try {
    const fonts = await collectFonts()
    const { bytes, warnings } = await buildPdf({
      sourceBytes: state.sourceBytes,
      pages: state.pages,
      overlays: state.overlays,
      fonts
    })

    const suggested = state.fileName ?? 'document.pdf'
    const targetName = options.exportCopy
      ? suggested.replace(/\.pdf$/i, '') + '-edited.pdf'
      : suggested

    const result = await desk.savePdf({
      data: bytes,
      suggestedName: targetName,
      forceDialog: Boolean(options.saveAs || options.exportCopy || !state.filePath),
      path: options.exportCopy ? null : state.filePath
    })
    if (!result) return false

    if (!options.exportCopy) {
      useDocumentStore.getState().markSaved(result.path, baseName(result.path))
      const settings = await desk.getSettings()
      if (settings.sidecar) {
        const project = useDocumentStore.getState().toProject()
        if (project) await desk.writeProject(result.path, JSON.stringify(project, null, 2))
      }
    }

    if (warnings.length > 0) {
      toast(warnings[0] + (warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''), 'error')
    } else {
      toast(options.exportCopy ? 'Exported a flattened copy' : 'Saved', 'success')
    }
    return true
  } catch (error) {
    toast(`Save failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
    return false
  }
}

export async function saveBeforeClose(): Promise<void> {
  const saved = await savePdf()
  if (saved) desk.closeReady()
}

export async function insertImageFromDisk(): Promise<void> {
  try {
    const image = await desk.pickImage()
    if (!image) return
    const state = useDocumentStore.getState()
    const page = state.pageById(state.activePageId ?? '') ?? state.pages[0]
    if (!page) return
    const overlay = await createImageOverlay(page, image.dataUrl)
    state.addOverlay(overlay)
    state.setTool('select')
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error')
  }
}
