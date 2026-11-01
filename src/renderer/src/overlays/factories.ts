import type {
  Align,
  FontFamilyRef,
  ImageOverlay,
  PageModel,
  Rect,
  ShapeKind,
  ShapeOverlay,
  SignatureOverlay,
  StampOverlay,
  TextEditOverlay,
  TextStyle
} from '@shared/types'
import { createId } from '@/lib/ids'
import { findStamp } from './stamps'

export async function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Could not read that image'))
    image.src = dataUrl
  })
}

/** pdf-lib only embeds PNG and JPEG, so anything else is transcoded through a canvas. */
export async function normalizeImage(
  dataUrl: string
): Promise<{ dataUrl: string; mime: 'image/png' | 'image/jpeg'; width: number; height: number }> {
  const mimeMatch = /^data:([^;]+);base64,/.exec(dataUrl)
  const mime = mimeMatch?.[1] ?? 'image/png'
  const { width, height } = await imageSize(dataUrl)
  if (mime === 'image/png' || mime === 'image/jpeg') {
    return { dataUrl, mime, width, height }
  }
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Could not read that image'))
    image.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.drawImage(image, 0, 0)
  return { dataUrl: canvas.toDataURL('image/png'), mime: 'image/png', width, height }
}

/**
 * Places an object of `width` × `height` centred on `at` (the click point), keeping it fully on the
 * page. Falls back to the page centre when no point was given.
 */
function placedRect(
  page: PageModel,
  width: number,
  height: number,
  at?: { x: number; y: number }
): Rect {
  const w = Math.min(width, page.width * 0.9)
  const h = Math.min(height, page.height * 0.9)
  if (!at) return { x: (page.width - w) / 2, y: (page.height - h) / 2, w, h }
  const x = Math.min(Math.max(at.x - w / 2, 0), Math.max(0, page.width - w))
  const y = Math.min(Math.max(at.y - h / 2, 0), Math.max(0, page.height - h))
  return { x, y, w, h }
}

export function createTextOverlay(
  page: PageModel,
  style: TextStyle,
  rect: Rect
): import('@shared/types').TextOverlay {
  return {
    id: createId('text'),
    pageId: page.id,
    type: 'text',
    ...style,
    ...rect,
    rotation: 0,
    opacity: 1,
    locked: false
  }
}

export function createTextEditOverlay(
  page: PageModel,
  run: {
    rect: Rect
    text: string
    fontFamily: FontFamilyRef
    fontSize: number
    bold: boolean
    italic: boolean
    align: Align
    color: string
    patchColor: string
  }
): TextEditOverlay {
  return {
    id: createId('text-edit'),
    pageId: page.id,
    type: 'text-edit',
    text: run.text,
    fontFamily: run.fontFamily,
    fontSize: run.fontSize,
    bold: run.bold,
    italic: run.italic,
    underline: false,
    strike: false,
    color: run.color,
    align: run.align,
    lineHeight: 1.2,
    bgColor: null,
    borderColor: null,
    borderWidth: 0,
    ...run.rect,
    patch: { ...run.rect },
    patchColor: run.patchColor,
    rotation: 0,
    opacity: 1,
    locked: false
  }
}

export async function createSignatureOverlay(
  page: PageModel,
  png: string,
  label?: string,
  at?: { x: number; y: number }
): Promise<SignatureOverlay> {
  const { width, height } = await imageSize(png)
  const aspect = height > 0 ? width / height : 3
  const w = Math.min(page.width * 0.34, 240)
  const h = w / aspect
  return {
    id: createId('signature'),
    pageId: page.id,
    type: 'signature',
    png,
    label,
    ...placedRect(page, w, h, at),
    rotation: 0,
    opacity: 1,
    locked: false
  }
}

export function createStampOverlay(
  page: PageModel,
  stampId: string,
  color: string,
  at?: { x: number; y: number }
): StampOverlay | null {
  const stamp = findStamp(stampId)
  if (!stamp) return null
  return {
    id: createId('stamp'),
    pageId: page.id,
    type: 'stamp',
    stampId,
    color,
    ...placedRect(page, stamp.size.w, stamp.size.h, at),
    rotation: 0,
    opacity: 1,
    locked: false
  }
}

export async function createImageOverlay(
  page: PageModel,
  dataUrl: string,
  at?: { x: number; y: number }
): Promise<ImageOverlay> {
  const normalized = await normalizeImage(dataUrl)
  const maxWidth = page.width * 0.5
  const scale = Math.min(1, maxWidth / normalized.width)
  const w = normalized.width * scale
  const h = normalized.height * scale
  return {
    id: createId('image'),
    pageId: page.id,
    type: 'image',
    dataUrl: normalized.dataUrl,
    mime: normalized.mime,
    ...placedRect(page, w, h, at),
    rotation: 0,
    opacity: 1,
    locked: false
  }
}

export function createShapeOverlay(
  page: PageModel,
  shape: ShapeKind,
  rect: Rect
): ShapeOverlay {
  return {
    id: createId('shape'),
    pageId: page.id,
    type: 'shape',
    shape,
    stroke: '#e02424',
    fill: null,
    strokeWidth: 2,
    ...rect,
    rotation: 0,
    opacity: 1,
    locked: false
  }
}
