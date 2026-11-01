import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  degrees,
  rgb,
  type Color
} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type {
  FontFamilyRef,
  ImageOverlay,
  Overlay,
  PageModel,
  ShapeOverlay,
  SignatureOverlay,
  StampOverlay,
  TextCapableOverlay,
  TextEditOverlay
} from '@shared/types'
import { parseHexColor } from '@shared/color'
import { findStamp, stampToPng } from '@/overlays/stamps'
import { rotatePoint, rectCenter } from '@/lib/geometry'
import { effectiveOverlayRect, overlayTextAscent, wrapText } from './textLayout'

export interface BuildPdfInput {
  sourceBytes: Uint8Array
  pages: PageModel[]
  overlays: Record<string, Overlay[]>
  /** Raw TTF/OTF bytes for imported fonts, keyed by font id. */
  fonts: Record<string, Uint8Array>
}

export interface BuildPdfResult {
  bytes: Uint8Array
  warnings: string[]
}

const STANDARD_FONT_MAP: Record<
  string,
  { regular: StandardFonts; bold: StandardFonts; italic: StandardFonts; boldItalic: StandardFonts }
> = {
  Helvetica: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique
  },
  Times: {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic
  },
  Courier: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique
  }
}

/** WinAnsi covers Latin-1 plus these typographic extras. */
const WINANSI_EXTRA = new Set<number>([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178
])

export function isWinAnsiEncodable(char: string): boolean {
  const cp = char.codePointAt(0) ?? 0
  if (cp === 0x0a || cp === 0x0d || cp === 0x09) return true
  if (cp >= 0x20 && cp <= 0x7e) return true
  if (cp >= 0xa0 && cp <= 0xff) return true
  return WINANSI_EXTRA.has(cp)
}

export function unsupportedCharacters(text: string): string[] {
  const found = new Set<string>()
  for (const char of text) {
    if (!isWinAnsiEncodable(char)) found.add(char)
  }
  return [...found]
}

const sanitizeForStandardFont = (text: string): string =>
  [...text].map((char) => (isWinAnsiEncodable(char) ? char : '?')).join('')

const colorFrom = (hex: string): Color => {
  const { r, g, b } = parseHexColor(hex)
  return rgb(r, g, b)
}

function dataUrlBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Unsupported image data')
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return { bytes, mime: match[1] }
}

export async function buildPdf(input: BuildPdfInput): Promise<BuildPdfResult> {
  const warnings: string[] = []
  const source = await PDFDocument.load(input.sourceBytes, {
    ignoreEncryption: true,
    updateMetadata: false
  })
  const out = await PDFDocument.create()
  out.registerFontkit(fontkit)

  const sourceIndices = input.pages
    .filter((page) => page.sourceIndex !== null)
    .map((page) => page.sourceIndex as number)
  const copied = sourceIndices.length > 0 ? await out.copyPages(source, sourceIndices) : []

  let cursor = 0
  const outputPages: PDFPage[] = []
  for (const page of input.pages) {
    if (page.sourceIndex === null) {
      outputPages.push(out.addPage([page.width, page.height]))
    } else {
      const sourcePage = copied[cursor]
      cursor += 1
      if (!sourcePage) {
        outputPages.push(out.addPage([page.width, page.height]))
        continue
      }
      outputPages.push(out.addPage(sourcePage))
    }
  }

  input.pages.forEach((page, index) => {
    const outputPage = outputPages[index]
    if (!outputPage) return
    const baseRotation =
      page.sourceIndex !== null && source.getPageCount() > page.sourceIndex
        ? source.getPage(page.sourceIndex).getRotation().angle
        : 0
    outputPage.setRotation(degrees((baseRotation + page.rotation) % 360))
  })

  const standardFonts = new Map<string, PDFFont>()
  const embeddedFonts = new Map<string, PDFFont>()
  const fallbackFont = await out.embedFont(StandardFonts.Helvetica)

  const resolveFont = async (
    family: FontFamilyRef,
    bold: boolean,
    italic: boolean
  ): Promise<PDFFont> => {
    if (family.startsWith('custom:')) {
      const id = family.slice('custom:'.length)
      const cached = embeddedFonts.get(id)
      if (cached) return cached
      const bytes = input.fonts[id]
      if (bytes) {
        try {
          const font = await out.embedFont(bytes, { subset: true })
          embeddedFonts.set(id, font)
          return font
        } catch {
          warnings.push('An imported font could not be embedded and was replaced with Helvetica.')
        }
      } else {
        warnings.push('An imported font was missing; Helvetica was used instead.')
      }
    }
    const familyKey = STANDARD_FONT_MAP[family as string] ? (family as string) : 'Helvetica'
    const variants = STANDARD_FONT_MAP[familyKey]
    const standard =
      bold && italic
        ? variants.boldItalic
        : bold
          ? variants.bold
          : italic
            ? variants.italic
            : variants.regular
    const cached = standardFonts.get(standard)
    if (cached) return cached
    const font = await out.embedFont(standard)
    standardFonts.set(standard, font)
    return font
  }

  const drawTextOverlay = async (
    page: PDFPage,
    overlay: TextCapableOverlay,
    font: PDFFont,
    standardFont: boolean
  ): Promise<void> => {
    // Same geometry as the live preview: text is anchored to the top of the stored rect.
    const rect = effectiveOverlayRect(overlay)
    const center = rectCenter(rect)
    const text = standardFont ? sanitizeForStandardFont(overlay.text) : overlay.text
    const lines = wrapText(text, rect.w, (candidate) =>
      font.widthOfTextAtSize(candidate, overlay.fontSize)
    )
    const lineHeight = overlay.fontSize * overlay.lineHeight
    const ascent = overlayTextAscent(overlay.fontSize)

    lines.forEach((line, index) => {
      const lineWidth = font.widthOfTextAtSize(line, overlay.fontSize)
      const offset =
        overlay.align === 'center'
          ? (rect.w - lineWidth) / 2
          : overlay.align === 'right'
            ? rect.w - lineWidth
            : 0
      const baseline = {
        x: rect.x + offset,
        y: rect.y + rect.h - ascent - index * lineHeight
      }
      const anchor = rotatePoint(baseline, center, overlay.rotation)
      try {
        page.drawText(line, {
          x: anchor.x,
          y: anchor.y,
          size: overlay.fontSize,
          font,
          color: colorFrom(overlay.color),
          opacity: overlay.opacity,
          rotate: degrees(overlay.rotation)
        })
      } catch {
        warnings.push('Some text could not be rendered with the selected font.')
        page.drawText(sanitizeForStandardFont(line), {
          x: anchor.x,
          y: anchor.y,
          size: overlay.fontSize,
          font: fallbackFont,
          color: colorFrom(overlay.color),
          opacity: overlay.opacity,
          rotate: degrees(overlay.rotation)
        })
      }

      const decoration = (offsetY: number): void => {
        if (lineWidth <= 0) return
        const start = rotatePoint(
          { x: rect.x + offset, y: baseline.y + offsetY },
          center,
          overlay.rotation
        )
        const end = rotatePoint(
          { x: rect.x + offset + lineWidth, y: baseline.y + offsetY },
          center,
          overlay.rotation
        )
        page.drawLine({
          start,
          end,
          thickness: Math.max(0.5, overlay.fontSize * 0.05),
          color: colorFrom(overlay.color),
          opacity: overlay.opacity
        })
      }
      if (overlay.underline) decoration(-overlay.fontSize * 0.12)
      if (overlay.strike) decoration(overlay.fontSize * 0.28)
    })
  }

  for (const [pageIndex, page] of input.pages.entries()) {
    const outputPage = outputPages[pageIndex]
    if (!outputPage) continue
    const overlays = input.overlays[page.id] ?? []

    for (const overlay of overlays) {
      if (overlay.opacity <= 0.001) continue
      const center = rectCenter(overlay)

      if (overlay.type === 'text-edit') {
        const patch = overlay as TextEditOverlay
        const corner = rotatePoint({ x: patch.patch.x, y: patch.patch.y }, center, patch.rotation)
        outputPage.drawRectangle({
          x: corner.x,
          y: corner.y,
          width: patch.patch.w,
          height: patch.patch.h,
          color: colorFrom(patch.patchColor),
          opacity: 1,
          rotate: degrees(patch.rotation)
        })
      }

      if (overlay.type === 'text' || overlay.type === 'text-edit') {
        if (overlay.bgColor) {
          const corner = rotatePoint({ x: overlay.x, y: overlay.y }, center, overlay.rotation)
          outputPage.drawRectangle({
            x: corner.x,
            y: corner.y,
            width: overlay.w,
            height: overlay.h,
            color: colorFrom(overlay.bgColor),
            opacity: overlay.opacity,
            rotate: degrees(overlay.rotation)
          })
        }
        if (overlay.borderColor && overlay.borderWidth > 0) {
          const corner = rotatePoint({ x: overlay.x, y: overlay.y }, center, overlay.rotation)
          outputPage.drawRectangle({
            x: corner.x,
            y: corner.y,
            width: overlay.w,
            height: overlay.h,
            borderColor: colorFrom(overlay.borderColor),
            borderWidth: overlay.borderWidth,
            opacity: overlay.opacity,
            rotate: degrees(overlay.rotation)
          })
        }
        if (unsupportedCharacters(overlay.text).length > 0 && !overlay.fontFamily.startsWith('custom:')) {
          warnings.push(
            `“${overlay.text.slice(0, 24)}…” contains characters the built-in fonts cannot encode and they were replaced with “?”. Import a TTF/OTF font that supports them instead.`
          )
        }
        const standard = !overlay.fontFamily.startsWith('custom:')
        const font = await resolveFont(overlay.fontFamily, overlay.bold, overlay.italic)
        await drawTextOverlay(outputPage, overlay, font, standard)
        continue
      }

      if (overlay.type === 'signature' || overlay.type === 'image') {
        const image = overlay as SignatureOverlay | ImageOverlay
        const dataUrl = 'png' in image && image.type === 'signature' ? image.png : image.dataUrl
        const { bytes, mime } = dataUrlBytes(dataUrl)
        const embedded =
          mime === 'image/jpeg' ? await out.embedJpg(bytes) : await out.embedPng(bytes)
        const corner = rotatePoint({ x: overlay.x, y: overlay.y }, center, overlay.rotation)
        outputPage.drawImage(embedded, {
          x: corner.x,
          y: corner.y,
          width: overlay.w,
          height: overlay.h,
          opacity: overlay.opacity,
          rotate: degrees(overlay.rotation)
        })
        continue
      }

      if (overlay.type === 'stamp') {
        const stamp = findStamp((overlay as StampOverlay).stampId)
        if (!stamp) {
          warnings.push('A stamp could not be found and was skipped.')
          continue
        }
        const png = await stampToPng(stamp, (overlay as StampOverlay).color)
        const embedded = await out.embedPng(dataUrlBytes(png).bytes)
        const corner = rotatePoint({ x: overlay.x, y: overlay.y }, center, overlay.rotation)
        outputPage.drawImage(embedded, {
          x: corner.x,
          y: corner.y,
          width: overlay.w,
          height: overlay.h,
          opacity: overlay.opacity,
          rotate: degrees(overlay.rotation)
        })
        continue
      }

      if (overlay.type === 'shape') {
        const shape = overlay as ShapeOverlay
        const strokeColor = colorFrom(shape.stroke)
        const fillColor = shape.fill ? colorFrom(shape.fill) : undefined
        if (shape.shape === 'rect') {
          const corner = rotatePoint({ x: overlay.x, y: overlay.y }, center, overlay.rotation)
          outputPage.drawRectangle({
            x: corner.x,
            y: corner.y,
            width: overlay.w,
            height: overlay.h,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: shape.strokeWidth,
            opacity: overlay.opacity,
            rotate: degrees(overlay.rotation)
          })
        } else if (shape.shape === 'ellipse') {
          outputPage.drawEllipse({
            x: center.x,
            y: center.y,
            xScale: overlay.w / 2,
            yScale: overlay.h / 2,
            color: fillColor,
            borderColor: strokeColor,
            borderWidth: shape.strokeWidth,
            opacity: overlay.opacity,
            rotate: degrees(overlay.rotation)
          })
        } else {
          const start = rotatePoint({ x: overlay.x, y: overlay.y }, center, overlay.rotation)
          const end = rotatePoint(
            { x: overlay.x + overlay.w, y: overlay.y + overlay.h },
            center,
            overlay.rotation
          )
          outputPage.drawLine({
            start,
            end,
            thickness: shape.strokeWidth,
            color: strokeColor,
            opacity: overlay.opacity
          })
          if (shape.shape === 'arrow') {
            const angle = Math.atan2(end.y - start.y, end.x - start.x)
            const headLength = Math.min(18, Math.hypot(end.x - start.x, end.y - start.y) * 0.35)
            if (headLength > 0.5) {
              const left = {
                x: end.x - headLength * Math.cos(angle - Math.PI / 7),
                y: end.y - headLength * Math.sin(angle - Math.PI / 7)
              }
              const right = {
                x: end.x - headLength * Math.cos(angle + Math.PI / 7),
                y: end.y - headLength * Math.sin(angle + Math.PI / 7)
              }
              outputPage.drawLine({
                start: left,
                end,
                thickness: shape.strokeWidth,
                color: strokeColor,
                opacity: overlay.opacity
              })
              outputPage.drawLine({
                start: right,
                end,
                thickness: shape.strokeWidth,
                color: strokeColor,
                opacity: overlay.opacity
              })
            }
          }
        }
      }
    }
  }

  out.setProducer('PDF Studio')
  out.setCreator('PDF Studio')
  out.setModificationDate(new Date())

  const bytes = await out.save({ useObjectStreams: true })
  return { bytes: new Uint8Array(bytes), warnings }
}
