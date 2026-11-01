import { create } from 'zustand'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type {
  Overlay,
  PageModel,
  ProjectFile,
  ShapeKind,
  TextCapableOverlay,
  TextOverlay,
  TextStyle
} from '@shared/types'
import { createId } from '@/lib/ids'
import { clampRectToPage, snapRect } from '@/lib/geometry'

export type Tool = 'select' | 'text' | 'edit-text' | 'signature' | 'stamp' | 'image' | 'shape'
export type ZoomMode = 'custom' | 'fit-width' | 'fit-page'

interface Snapshot {
  pages: PageModel[]
  overlays: Record<string, Overlay[]>
}

export interface LoadedDocument {
  pdf: PDFDocumentProxy
  sourceBytes: Uint8Array
  pages: PageModel[]
  fileName: string
  filePath: string | null
  overlays?: Record<string, Overlay[]>
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  text: '',
  fontFamily: 'Helvetica',
  fontSize: 14,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  color: '#111827',
  align: 'left',
  lineHeight: 1.3,
  bgColor: null,
  borderColor: null,
  borderWidth: 0
}

interface DocumentStore {
  pdf: PDFDocumentProxy | null
  sourceBytes: Uint8Array | null
  fileName: string | null
  filePath: string | null
  pages: PageModel[]
  overlays: Record<string, Overlay[]>
  selectedId: string | null
  editingId: string | null
  activePageId: string | null
  tool: Tool
  textDefaults: TextStyle
  shapeKind: ShapeKind
  pendingStampId: string | null
  pendingSignature: { id: string; png: string; label: string } | null
  zoom: number
  zoomMode: ZoomMode
  dirty: boolean
  past: Snapshot[]
  future: Snapshot[]
  pendingSnapshot: Snapshot | null

  loadDocument(document: LoadedDocument): void
  closeDocument(): void
  markSaved(filePath: string, fileName: string): void

  setTool(tool: Tool): void
  setZoom(zoom: number, mode: ZoomMode): void
  setActivePage(pageId: string): void
  select(id: string | null): void
  startEditing(id: string): void
  stopEditing(): void

  beginHistory(): void
  commitHistory(): void
  undo(): void
  redo(): void

  addOverlay(overlay: Overlay): void
  updateOverlay(id: string, patch: Partial<Overlay>, options?: { history?: boolean }): void
  updateTextDefaults(patch: Partial<TextStyle>): void
  deleteSelected(): void
  duplicateSelected(): void
  insertOverlayCopy(overlay: Overlay): void
  bringForward(id: string): void
  sendBackward(id: string): void
  nudgeSelected(dx: number, dy: number): void

  rotatePage(pageId: string, delta: number): void
  deletePage(pageId: string): void
  duplicatePage(pageId: string): void
  insertBlankPage(afterPageId: string | null): void
  movePage(fromIndex: number, toIndex: number): void

  setPendingStamp(id: string | null): void
  setPendingSignature(signature: DocumentStore['pendingSignature']): void
  setShapeKind(kind: ShapeKind): void

  overlaysForPage(pageId: string): Overlay[]
  selectedOverlay(): Overlay | null
  pageById(pageId: string): PageModel | undefined
  pageIndex(pageId: string): number
  toProject(): ProjectFile | null
  restoreProject(project: ProjectFile): void
}

const clone = <T,>(value: T): T => structuredClone(value)

const snapshotOf = (state: Pick<DocumentStore, 'pages' | 'overlays'>): Snapshot => ({
  pages: clone(state.pages),
  overlays: clone(state.overlays)
})

const snapshotChanged = (a: Snapshot, b: Snapshot): boolean =>
  JSON.stringify(a) !== JSON.stringify(b)

const HISTORY_LIMIT = 80

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  pdf: null,
  sourceBytes: null,
  fileName: null,
  filePath: null,
  pages: [],
  overlays: {},
  selectedId: null,
  editingId: null,
  activePageId: null,
  tool: 'select',
  textDefaults: DEFAULT_TEXT_STYLE,
  shapeKind: 'rect',
  pendingStampId: null,
  pendingSignature: null,
  zoom: 1,
  zoomMode: 'fit-width',
  dirty: false,
  past: [],
  future: [],
  pendingSnapshot: null,

  loadDocument: ({ pdf, sourceBytes, pages, fileName, filePath, overlays }) =>
    set({
      pdf,
      sourceBytes,
      pages,
      overlays: overlays ?? {},
      fileName,
      filePath,
      selectedId: null,
      editingId: null,
      activePageId: pages[0]?.id ?? null,
      dirty: false,
      past: [],
      future: [],
      pendingSnapshot: null,
      pendingSignature: null,
      pendingStampId: null,
      tool: 'select'
    }),

  closeDocument: () =>
    set({
      pdf: null,
      sourceBytes: null,
      pages: [],
      overlays: {},
      fileName: null,
      filePath: null,
      selectedId: null,
      editingId: null,
      activePageId: null,
      dirty: false,
      past: [],
      future: [],
      pendingSnapshot: null,
      pendingSignature: null,
      pendingStampId: null,
      tool: 'select'
    }),

  markSaved: (filePath, fileName) => set({ filePath, fileName, dirty: false }),

  setTool: (tool) =>
    set((state) => ({
      tool,
      editingId: null,
      selectedId: tool === 'select' ? state.selectedId : null,
      pendingStampId: tool === 'stamp' ? state.pendingStampId : null,
      pendingSignature: tool === 'signature' ? state.pendingSignature : null
    })),

  setZoom: (zoom, zoomMode) => set({ zoom: Math.min(6, Math.max(0.1, zoom)), zoomMode }),

  setActivePage: (pageId) => set({ activePageId: pageId }),

  select: (id) =>
    set((state) => {
      if (state.editingId && state.editingId !== id) return { selectedId: id, editingId: null }
      return { selectedId: id }
    }),

  startEditing: (id) => set({ editingId: id, selectedId: id }),

  stopEditing: () => {
    const state = get()
    const id = state.editingId
    if (id) {
      const overlay = state.selectedOverlay()
      const isEmptyText =
        overlay &&
        (overlay.type === 'text' || overlay.type === 'text-edit') &&
        overlay.text.trim().length === 0
      if (isEmptyText) {
        // A text box that was never filled in should not be left behind as an invisible object.
        const next: Record<string, Overlay[]> = {}
        for (const [pageId, list] of Object.entries(state.overlays)) {
          next[pageId] = list.filter((item) => item.id !== id)
        }
        set({ overlays: next, editingId: null, selectedId: null })
        get().commitHistory()
        return
      }
    }
    set({ editingId: null })
  },

  beginHistory: () => {
    const state = get()
    if (state.pendingSnapshot) return
    set({ pendingSnapshot: snapshotOf(state) })
  },

  commitHistory: () => {
    const { pendingSnapshot } = get()
    if (!pendingSnapshot) return
    const current = snapshotOf(get())
    if (!snapshotChanged(pendingSnapshot, current)) {
      set({ pendingSnapshot: null })
      return
    }
    set((state) => ({
      past: [...state.past, pendingSnapshot].slice(-HISTORY_LIMIT),
      future: [],
      pendingSnapshot: null,
      dirty: true
    }))
  },

  undo: () => {
    const state = get()
    const previous = state.past[state.past.length - 1]
    if (!previous) return
    set({
      past: state.past.slice(0, -1),
      future: [...state.future, snapshotOf(state)],
      pages: previous.pages,
      overlays: previous.overlays,
      dirty: true,
      selectedId: previous.overlays[state.activePageId ?? '']?.some((o) => o.id === state.selectedId)
        ? state.selectedId
        : null,
      editingId: null
    })
  },

  redo: () => {
    const state = get()
    const next = state.future[state.future.length - 1]
    if (!next) return
    set({
      future: state.future.slice(0, -1),
      past: [...state.past, snapshotOf(state)],
      pages: next.pages,
      overlays: next.overlays,
      dirty: true,
      editingId: null
    })
  },

  addOverlay: (overlay) => {
    get().beginHistory()
    set((state) => ({
      overlays: {
        ...state.overlays,
        [overlay.pageId]: [...(state.overlays[overlay.pageId] ?? []), overlay]
      },
      selectedId: overlay.id,
      // Every placement is a single-shot action; the new object becomes the selection.
      tool: 'select',
      pendingSignature: null,
      pendingStampId: null
    }))
    get().commitHistory()
  },

  updateOverlay: (id, patch, options) => {
    if (options?.history) get().beginHistory()
    set((state) => {
      const next: Record<string, Overlay[]> = {}
      for (const [pageId, list] of Object.entries(state.overlays)) {
        const index = list.findIndex((overlay) => overlay.id === id)
        if (index === -1) {
          next[pageId] = list
          continue
        }
        const merged = { ...list[index], ...patch } as Overlay
        next[pageId] = [...list.slice(0, index), merged, ...list.slice(index + 1)]
      }
      return { overlays: next, dirty: true }
    })
    if (options?.history) get().commitHistory()
  },

  updateTextDefaults: (patch) => set((state) => ({ textDefaults: { ...state.textDefaults, ...patch } })),

  deleteSelected: () => {
    const state = get()
    const id = state.selectedId
    if (!id) return
    state.beginHistory()
    set((current) => {
      const next: Record<string, Overlay[]> = {}
      for (const [pageId, list] of Object.entries(current.overlays)) {
        next[pageId] = list.filter((overlay) => overlay.id !== id)
      }
      return { overlays: next, selectedId: null, editingId: null }
    })
    get().commitHistory()
  },

  duplicateSelected: () => {
    const overlay = get().selectedOverlay()
    if (!overlay) return
    get().insertOverlayCopy(overlay)
  },

  insertOverlayCopy: (overlay) => {
    const page = get().pageById(overlay.pageId)
    const offset = 12
    const moved = page
      ? clampRectToPage(
          { ...overlay, x: overlay.x + offset, y: overlay.y - offset },
          page.width,
          page.height
        )
      : { x: overlay.x + offset, y: overlay.y - offset }
    const copy = {
      ...clone(overlay),
      ...moved,
      id: createId(overlay.type)
    } as Overlay
    get().beginHistory()
    set((state) => ({
      overlays: {
        ...state.overlays,
        [copy.pageId]: [...(state.overlays[copy.pageId] ?? []), copy]
      },
      selectedId: copy.id
    }))
    get().commitHistory()
  },

  bringForward: (id) => {
    get().beginHistory()
    set((state) => {
      const next = { ...state.overlays }
      for (const [pageId, list] of Object.entries(next)) {
        const index = list.findIndex((overlay) => overlay.id === id)
        if (index === -1 || index === list.length - 1) continue
        const reordered = [...list]
        const [item] = reordered.splice(index, 1)
        reordered.splice(index + 1, 0, item)
        next[pageId] = reordered
      }
      return { overlays: next }
    })
    get().commitHistory()
  },

  sendBackward: (id) => {
    get().beginHistory()
    set((state) => {
      const next = { ...state.overlays }
      for (const [pageId, list] of Object.entries(next)) {
        const index = list.findIndex((overlay) => overlay.id === id)
        if (index <= 0) continue
        const reordered = [...list]
        const [item] = reordered.splice(index, 1)
        reordered.splice(index - 1, 0, item)
        next[pageId] = reordered
      }
      return { overlays: next }
    })
    get().commitHistory()
  },

  nudgeSelected: (dx, dy) => {
    const state = get()
    const overlay = state.selectedOverlay()
    if (!overlay || overlay.locked) return
    const page = state.pageById(overlay.pageId)
    const moved = page
      ? clampRectToPage({ ...overlay, x: overlay.x + dx, y: overlay.y + dy }, page.width, page.height)
      : { x: overlay.x + dx, y: overlay.y + dy }
    state.beginHistory()
    state.updateOverlay(overlay.id, moved)
    state.commitHistory()
  },

  rotatePage: (pageId, delta) => {
    get().beginHistory()
    set((state) => ({
      pages: state.pages.map((page) =>
        page.id === pageId ? { ...page, rotation: (page.rotation + delta + 360) % 360 } : page
      )
    }))
    get().commitHistory()
  },

  deletePage: (pageId) => {
    const state = get()
    if (state.pages.length <= 1) return
    state.beginHistory()
    const index = state.pages.findIndex((page) => page.id === pageId)
    const remaining = state.pages.filter((page) => page.id !== pageId)
    const nextActive = remaining[Math.max(0, index - 1)]?.id ?? remaining[0]?.id ?? null
    set((current) => {
      const overlays = { ...current.overlays }
      delete overlays[pageId]
      return {
        pages: remaining,
        overlays,
        activePageId: current.activePageId === pageId ? nextActive : current.activePageId,
        selectedId: null,
        editingId: null
      }
    })
    get().commitHistory()
  },

  duplicatePage: (pageId) => {
    const state = get()
    const index = state.pages.findIndex((page) => page.id === pageId)
    const page = state.pages[index]
    if (!page) return
    const copy: PageModel = { ...page, id: createId('page') }
    state.beginHistory()
    set((current) => {
      const pages = [...current.pages]
      pages.splice(index + 1, 0, copy)
      const sourceOverlays = current.overlays[pageId] ?? []
      const copiedOverlays = sourceOverlays.map(
        (overlay) => ({ ...clone(overlay), id: createId(overlay.type), pageId: copy.id }) as Overlay
      )
      return {
        pages,
        overlays: { ...current.overlays, [copy.id]: copiedOverlays },
        activePageId: copy.id
      }
    })
    get().commitHistory()
  },

  insertBlankPage: (afterPageId) => {
    const state = get()
    const index = afterPageId ? state.pages.findIndex((page) => page.id === afterPageId) : -1
    const template = state.pages[index >= 0 ? index : state.pages.length - 1]
    const page: PageModel = {
      id: createId('page'),
      sourceIndex: null,
      rotation: 0,
      sourceRotation: 0,
      width: template?.width ?? 612,
      height: template?.height ?? 792
    }
    state.beginHistory()
    set((current) => {
      const pages = [...current.pages]
      pages.splice(index + 1, 0, page)
      return { pages, overlays: { ...current.overlays, [page.id]: [] }, activePageId: page.id }
    })
    get().commitHistory()
  },

  movePage: (fromIndex, toIndex) => {
    const state = get()
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= state.pages.length ||
      toIndex >= state.pages.length
    ) {
      return
    }
    state.beginHistory()
    set((current) => {
      const pages = [...current.pages]
      const [moved] = pages.splice(fromIndex, 1)
      pages.splice(toIndex, 0, moved)
      return { pages }
    })
    get().commitHistory()
  },

  setPendingStamp: (id) => set({ pendingStampId: id, tool: id ? 'stamp' : 'select', selectedId: null }),
  setPendingSignature: (signature) =>
    set({ pendingSignature: signature, tool: signature ? 'signature' : 'select', selectedId: null }),
  setShapeKind: (shapeKind) => set({ shapeKind, tool: 'shape', selectedId: null }),

  overlaysForPage: (pageId) => get().overlays[pageId] ?? [],

  selectedOverlay: () => {
    const state = get()
    if (!state.selectedId) return null
    for (const list of Object.values(state.overlays)) {
      const found = list.find((overlay) => overlay.id === state.selectedId)
      if (found) return found
    }
    return null
  },

  pageById: (pageId) => get().pages.find((page) => page.id === pageId),

  pageIndex: (pageId) => get().pages.findIndex((page) => page.id === pageId),

  toProject: () => {
    const state = get()
    if (!state.fileName) return null
    return {
      version: 1,
      sourceName: state.fileName,
      pages: clone(state.pages),
      overlays: clone(state.overlays)
    }
  },

  restoreProject: (project) => {
    const state = get()
    const validPages = project.pages.filter((page) => typeof page?.id === 'string')
    const overlays: Record<string, Overlay[]> = {}
    for (const [pageId, list] of Object.entries(project.overlays ?? {})) {
      if (!Array.isArray(list)) continue
      overlays[pageId] = list.filter((overlay) => overlay && typeof overlay.id === 'string')
    }
    set({
      pages: validPages.length > 0 ? validPages : state.pages,
      overlays,
      dirty: false,
      past: [],
      future: [],
      selectedId: null
    })
  }
}))

/** Applies page-edge and centre snapping to a text/overlay rect. */
export function snapOverlayRect(
  rect: { x: number; y: number; w: number; h: number },
  page: PageModel
): { x: number; y: number; w: number; h: number } {
  return snapRect(rect, page.width, page.height, 4)
}

export function isTextCapable(overlay: Overlay): overlay is TextCapableOverlay {
  return overlay.type === 'text' || overlay.type === 'text-edit'
}

export function isTextBox(overlay: Overlay): overlay is TextOverlay {
  return overlay.type === 'text'
}
