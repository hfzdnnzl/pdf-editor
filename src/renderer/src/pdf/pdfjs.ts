import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageModel } from '@shared/types'
import { createId } from '@/lib/ids'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type { PDFDocumentProxy }

function assetBase(): string {
  return new URL('pdfjs/', document.baseURI).href
}

export async function openPdfDocument(data: Uint8Array): Promise<PDFDocumentProxy> {
  const base = assetBase()
  const task = pdfjs.getDocument({
    data: data.slice(),
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
    iccUrl: `${base}iccs/`,
    useSystemFonts: false
  })
  return task.promise
}

export async function buildPageModels(pdf: PDFDocumentProxy): Promise<PageModel[]> {
  const pages: PageModel[] = []
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const viewport = page.getViewport({ scale: 1, rotation: 0 })
    pages.push({
      id: createId('page'),
      sourceIndex: index - 1,
      rotation: 0,
      sourceRotation: (page.rotate ?? 0) % 360,
      width: viewport.width,
      height: viewport.height
    })
    page.cleanup()
  }
  return pages
}

/** pdf.js page rotation (its own /Rotate) plus the user's page rotation. */
export async function totalPageRotation(pdf: PDFDocumentProxy, page: PageModel): Promise<number> {
  if (page.sourceIndex === null) return page.rotation
  const pdfPage = await pdf.getPage(page.sourceIndex + 1)
  const rotate = pdfPage.rotate ?? 0
  return (rotate + page.rotation) % 360
}
