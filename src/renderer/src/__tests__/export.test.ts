import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Overlay, PageModel, TextOverlay } from '@shared/types'
import { buildPdf, isWinAnsiEncodable, unsupportedCharacters } from '@/pdf/buildPdf'

const pageId = (index: number): string => `page-${index}`

const STANDARD_FONTS = new URL(
  '../../../../node_modules/pdfjs-dist/standard_fonts/',
  import.meta.url
).href

interface TextItem {
  str?: string
}

async function extractPages(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as {
    getDocument: (options: Record<string, unknown>) => {
      promise: Promise<{
        numPages: number
        getPage: (index: number) => Promise<{ getTextContent: () => Promise<{ items: TextItem[] }> }>
      }>
    }
  }
  const document = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    isEvalSupported: false,
    standardFontDataUrl: STANDARD_FONTS,
    verbosity: 0
  }).promise
  const pages: string[] = []
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index)
    const content = await page.getTextContent()
    pages.push(
      content.items
        .map((item) => item.str ?? '')
        .join('')
        .trim()
    )
  }
  return pages
}

async function sourcePdf(pageCount = 2): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([400, 600])
    page.drawText(`source-${index + 1}`, { x: 40, y: 540, size: 18, font, color: rgb(0, 0, 0) })
  }
  return new Uint8Array(await document.save())
}

function textOverlay(overrides: Partial<TextOverlay> = {}): TextOverlay {
  return {
    id: `text-${Math.random().toString(36).slice(2)}`,
    pageId: pageId(0),
    type: 'text',
    text: 'Q1 summary',
    fontFamily: 'Helvetica',
    fontSize: 14,
    bold: true,
    italic: false,
    underline: false,
    strike: false,
    color: '#ff0000',
    align: 'left',
    lineHeight: 1.3,
    bgColor: null,
    borderColor: null,
    borderWidth: 0,
    x: 40,
    y: 400,
    w: 200,
    h: 18,
    rotation: 0,
    opacity: 1,
    locked: false,
    ...overrides
  }
}

const pageModel = (index: number, overrides: Partial<PageModel> = {}): PageModel => ({
  id: pageId(index),
  sourceIndex: index,
  rotation: 0,
  sourceRotation: 0,
  width: 400,
  height: 600,
  ...overrides
})

describe('pdf export pipeline', () => {
  it('keeps the source pages and adds overlay text', async () => {
    const source = await sourcePdf(2)
    const pages = [pageModel(0), pageModel(1)]
    const overlays: Record<string, Overlay[]> = { [pageId(0)]: [textOverlay()] }

    const { bytes, warnings } = await buildPdf({ sourceBytes: source, pages, overlays, fonts: {} })
    expect(warnings).toEqual([])

    const result = await PDFDocument.load(bytes)
    expect(result.getPageCount()).toBe(2)

    const text = await extractPages(bytes)
    expect(text[0]).toContain('source-1')
    expect(text[0]).toContain('Q1 summary')
    expect(text[1]).toContain('source-2')
    expect(text[1]).not.toContain('Q1 summary')
  })

  it('applies page order, extra rotation and blank pages', async () => {
    const source = await sourcePdf(3)
    const pages: PageModel[] = [
      pageModel(2, { rotation: 90 }),
      { id: 'blank', sourceIndex: null, rotation: 0, sourceRotation: 0, width: 300, height: 500 },
      pageModel(0)
    ]

    const { bytes } = await buildPdf({ sourceBytes: source, pages, overlays: {}, fonts: {} })
    const result = await PDFDocument.load(bytes)
    expect(result.getPageCount()).toBe(3)
    expect(result.getPage(0).getRotation().angle).toBe(90)
    expect(result.getPage(0).getSize().width).toBe(400)
    expect(result.getPage(1).getSize().width).toBe(300)
    expect(result.getPage(1).getSize().height).toBe(500)
    expect(result.getPage(2).getRotation().angle).toBe(0)

    const text = await extractPages(bytes)
    expect(text[0]).toContain('source-3')
    expect(text[1]).toBe('')
    expect(text[2]).toContain('source-1')
  })

  it('drops pages that are not part of the working document', async () => {
    const source = await sourcePdf(3)
    const { bytes } = await buildPdf({
      sourceBytes: source,
      pages: [pageModel(1)],
      overlays: {},
      fonts: {}
    })
    const result = await PDFDocument.load(bytes)
    expect(result.getPageCount()).toBe(1)
    const text = await extractPages(bytes)
    expect(text[0]).toContain('source-2')
  })

  it('sanitises characters the standard fonts cannot encode', async () => {
    const source = await sourcePdf(1)
    const overlay = textOverlay({ text: 'Grüße 漢字' })
    const { bytes, warnings } = await buildPdf({
      sourceBytes: source,
      pages: [pageModel(0)],
      overlays: { [pageId(0)]: [overlay] },
      fonts: {}
    })
    expect(warnings.join(' ')).toMatch(/cannot encode/)
    const text = await extractPages(bytes)
    expect(text[0]).toContain('Grüße ??')
  })

  it('renders rotated, translucent, underlined text without throwing', async () => {
    const source = await sourcePdf(1)
    const overlay = textOverlay({ rotation: 45, opacity: 0.5, underline: true, strike: true })
    const { bytes } = await buildPdf({
      sourceBytes: source,
      pages: [pageModel(0)],
      overlays: { [pageId(0)]: [overlay] },
      fonts: {}
    })
    const text = await extractPages(bytes)
    expect(text[0]).toContain('Q1 summary')
  })

  it('renders a background patch for edited text', async () => {
    const source = await sourcePdf(1)
    const overlay: Overlay = {
      ...textOverlay({ text: 'Replaced' }),
      type: 'text-edit',
      patchColor: '#ffffff',
      patch: { x: 36, y: 396, w: 120, h: 22 }
    }
    const { bytes } = await buildPdf({
      sourceBytes: source,
      pages: [pageModel(0)],
      overlays: { [pageId(0)]: [overlay] },
      fonts: {}
    })
    const text = await extractPages(bytes)
    expect(text[0]).toContain('Replaced')
    expect(text[0]).toContain('source-1')
  })

  it('warns instead of failing when a custom font is missing', async () => {
    const source = await sourcePdf(1)
    const overlay = textOverlay({ text: 'Custom font text', fontFamily: 'custom:missing' })
    const { bytes, warnings } = await buildPdf({
      sourceBytes: source,
      pages: [pageModel(0)],
      overlays: { [pageId(0)]: [overlay] },
      fonts: {}
    })
    expect(warnings.join(' ')).toMatch(/imported font/i)
    const text = await extractPages(bytes)
    expect(text[0]).toContain('Custom font text')
  })

  it('flags characters outside WinAnsi', () => {
    expect(isWinAnsiEncodable('a')).toBe(true)
    expect(isWinAnsiEncodable('ä')).toBe(true)
    expect(isWinAnsiEncodable('—')).toBe(true)
    expect(isWinAnsiEncodable('漢')).toBe(false)
    expect(unsupportedCharacters('a漢b')).toEqual(['漢'])
  })
})
