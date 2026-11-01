import { beforeEach, describe, expect, it } from 'vitest'
import type { Overlay, PageModel, TextOverlay } from '@shared/types'
import { useDocumentStore } from '@/state/documentStore'

const page = (index: number): PageModel => ({
  id: `page-${index}`,
  sourceIndex: index,
  rotation: 0,
  sourceRotation: 0,
  width: 600,
  height: 800
})

const textOverlay = (pageId: string, overrides: Partial<TextOverlay> = {}): TextOverlay => ({
  id: `text-${pageId}`,
  pageId,
  type: 'text',
  text: 'Hello',
  fontFamily: 'Helvetica',
  fontSize: 14,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  color: '#111111',
  align: 'left',
  lineHeight: 1.3,
  bgColor: null,
  borderColor: null,
  borderWidth: 0,
  x: 40,
  y: 500,
  w: 200,
  h: 18,
  rotation: 0,
  opacity: 1,
  locked: false,
  ...overrides
})

const load = (overlays: Record<string, Overlay[]> = {}): void => {
  useDocumentStore.getState().loadDocument({
    // The store never touches the pdf.js proxy in these tests.
    pdf: {} as never,
    sourceBytes: new Uint8Array([1, 2, 3]),
    pages: [page(0), page(1)],
    overlays,
    fileName: 'test.pdf',
    filePath: '/tmp/test.pdf'
  })
}

describe('document store', () => {
  beforeEach(() => load())

  it('adds an overlay and can undo/redo it', () => {
    const store = useDocumentStore.getState()
    store.addOverlay(textOverlay('page-0'))
    expect(useDocumentStore.getState().overlays['page-0']).toHaveLength(1)
    expect(useDocumentStore.getState().selectedId).toBe('text-page-0')
    expect(useDocumentStore.getState().dirty).toBe(true)

    useDocumentStore.getState().undo()
    // Undo restores the pre-add state, where the page had no overlay list at all.
    expect(useDocumentStore.getState().overlays['page-0'] ?? []).toHaveLength(0)

    useDocumentStore.getState().redo()
    expect(useDocumentStore.getState().overlays['page-0']).toHaveLength(1)
  })

  it('duplicates an overlay with a fresh id', () => {
    useDocumentStore.getState().addOverlay(textOverlay('page-0'))
    useDocumentStore.getState().duplicateSelected()
    const list = useDocumentStore.getState().overlays['page-0']
    expect(list).toHaveLength(2)
    expect(list[1].id).not.toBe(list[0].id)
    expect(list[1].x).toBeGreaterThan(list[0].x)
  })

  it('deletes the selection and clears it', () => {
    useDocumentStore.getState().addOverlay(textOverlay('page-0'))
    useDocumentStore.getState().deleteSelected()
    expect(useDocumentStore.getState().overlays['page-0']).toHaveLength(0)
    expect(useDocumentStore.getState().selectedId).toBeNull()
  })

  it('duplicates a page together with its overlays', () => {
    load({ 'page-0': [textOverlay('page-0')] })
    useDocumentStore.getState().duplicatePage('page-0')
    const state = useDocumentStore.getState()
    expect(state.pages).toHaveLength(3)
    const copy = state.pages[1]
    expect(copy.id).not.toBe('page-0')
    expect(state.overlays[copy.id]).toHaveLength(1)
    expect(state.overlays[copy.id][0].pageId).toBe(copy.id)
    expect(state.overlays[copy.id][0].id).not.toBe('text-page-0')
  })

  it('inserts a blank page after the given page', () => {
    useDocumentStore.getState().insertBlankPage('page-0')
    const state = useDocumentStore.getState()
    expect(state.pages).toHaveLength(3)
    expect(state.pages[1].sourceIndex).toBeNull()
    expect(state.pages[1].width).toBe(600)
    expect(state.activePageId).toBe(state.pages[1].id)
  })

  it('reorders pages', () => {
    useDocumentStore.getState().movePage(0, 1)
    const state = useDocumentStore.getState()
    expect(state.pages[0].id).toBe('page-1')
    expect(state.pages[1].id).toBe('page-0')
    useDocumentStore.getState().undo()
    expect(useDocumentStore.getState().pages[0].id).toBe('page-0')
  })

  it('never deletes the last remaining page', () => {
    useDocumentStore.getState().deletePage('page-0')
    useDocumentStore.getState().deletePage('page-1')
    expect(useDocumentStore.getState().pages).toHaveLength(1)
  })

  it('rotates a page in 90 degree steps', () => {
    useDocumentStore.getState().rotatePage('page-0', 90)
    expect(useDocumentStore.getState().pages[0].rotation).toBe(90)
    useDocumentStore.getState().rotatePage('page-0', -90)
    expect(useDocumentStore.getState().pages[0].rotation).toBe(0)
    useDocumentStore.getState().rotatePage('page-0', -90)
    expect(useDocumentStore.getState().pages[0].rotation).toBe(270)
  })

  it('drops an empty text box when editing stops', () => {
    useDocumentStore.getState().addOverlay(textOverlay('page-0', { text: '' }))
    useDocumentStore.getState().startEditing('text-page-0')
    useDocumentStore.getState().stopEditing()
    expect(useDocumentStore.getState().overlays['page-0']).toHaveLength(0)
  })

  it('keeps a filled text box when editing stops', () => {
    useDocumentStore.getState().addOverlay(textOverlay('page-0'))
    useDocumentStore.getState().startEditing('text-page-0')
    useDocumentStore.getState().stopEditing()
    expect(useDocumentStore.getState().overlays['page-0']).toHaveLength(1)
  })

  it('brings an overlay forward and back', () => {
    load({ 'page-0': [textOverlay('page-0', { id: 'a' }), textOverlay('page-0', { id: 'b' })] })
    useDocumentStore.getState().bringForward('a')
    expect(useDocumentStore.getState().overlays['page-0'].map((o) => o.id)).toEqual(['b', 'a'])
    useDocumentStore.getState().sendBackward('a')
    expect(useDocumentStore.getState().overlays['page-0'].map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('nudges the selection within the page bounds', () => {
    load({ 'page-0': [textOverlay('page-0', { x: 0, y: 0 })] })
    useDocumentStore.getState().select('text-page-0')
    useDocumentStore.getState().nudgeSelected(-10, -10)
    const overlay = useDocumentStore.getState().overlays['page-0'][0]
    expect(overlay.x).toBe(0)
    expect(overlay.y).toBe(0)
    useDocumentStore.getState().nudgeSelected(10, 10)
    expect(useDocumentStore.getState().overlays['page-0'][0].x).toBe(10)
  })

  it('serialises and restores a project', () => {
    load({ 'page-0': [textOverlay('page-0')] })
    const project = useDocumentStore.getState().toProject()
    expect(project?.version).toBe(1)
    expect(project?.overlays['page-0']).toHaveLength(1)

    load()
    useDocumentStore.getState().restoreProject(project!)
    expect(useDocumentStore.getState().overlays['page-0']).toHaveLength(1)
    expect(useDocumentStore.getState().dirty).toBe(false)
  })
})

describe('overlay placement', () => {
  const page: PageModel = {
    id: 'p',
    sourceIndex: 0,
    rotation: 0,
    sourceRotation: 0,
    width: 600,
    height: 800
  }

  it('centres a stamp on the click point and keeps it on the page', async () => {
    const { createStampOverlay } = await import('@/overlays/factories')
    const centred = createStampOverlay(page, 'check', '#ff0000', { x: 300, y: 400 })
    expect(centred).not.toBeNull()
    expect(centred!.x + centred!.w / 2).toBeCloseTo(300, 6)
    expect(centred!.y + centred!.h / 2).toBeCloseTo(400, 6)

    const clamped = createStampOverlay(page, 'check', '#ff0000', { x: 2, y: 798 })
    expect(clamped!.x).toBeGreaterThanOrEqual(0)
    expect(clamped!.y + clamped!.h).toBeLessThanOrEqual(page.height + 0.001)
  })

  it('falls back to the page centre when no point is given', async () => {
    const { createStampOverlay } = await import('@/overlays/factories')
    const centred = createStampOverlay(page, 'check', '#ff0000')
    expect(centred!.x + centred!.w / 2).toBeCloseTo(page.width / 2, 6)
    expect(centred!.y + centred!.h / 2).toBeCloseTo(page.height / 2, 6)
  })
})
