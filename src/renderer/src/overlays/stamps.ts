export interface StampDefinition {
  id: string
  label: string
  viewBox: { w: number; h: number }
  /** Natural size on the page, in PDF points. */
  size: { w: number; h: number }
  /** Inner SVG markup; `color` is already interpolated. */
  body: (color: string) => string
  group: 'icons' | 'labels'
}

const stroke = (color: string, width = 9): string =>
  `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`

export const STAMPS: StampDefinition[] = [
  {
    id: 'check',
    label: 'Tick',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 52, h: 52 },
    body: (color) => `<path d="M16 53 L40 78 L84 22" ${stroke(color, 13)} />`
  },
  {
    id: 'check-circle',
    label: 'Tick in circle',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 52, h: 52 },
    body: (color) =>
      `<circle cx="50" cy="50" r="42" ${stroke(color, 8)} />` +
      `<path d="M30 51 L44 66 L70 34" ${stroke(color, 9)} />`
  },
  {
    id: 'cross',
    label: 'Cross',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 46, h: 46 },
    body: (color) => `<path d="M24 24 L76 76 M76 24 L24 76" ${stroke(color, 12)} />`
  },
  {
    id: 'cross-circle',
    label: 'Cross in circle',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 52, h: 52 },
    body: (color) =>
      `<circle cx="50" cy="50" r="42" ${stroke(color, 8)} />` +
      `<path d="M34 34 L66 66 M66 34 L34 66" ${stroke(color, 9)} />`
  },
  {
    id: 'arrow-right',
    label: 'Arrow right',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 68, h: 40 },
    body: (color) => `<path d="M10 50 H82 M54 22 L84 50 L54 78" ${stroke(color, 10)} />`
  },
  {
    id: 'arrow-left',
    label: 'Arrow left',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 68, h: 40 },
    body: (color) => `<path d="M90 50 H18 M46 22 L16 50 L46 78" ${stroke(color, 10)} />`
  },
  {
    id: 'arrow-up',
    label: 'Arrow up',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 40, h: 68 },
    body: (color) => `<path d="M50 90 V18 M22 46 L50 16 L78 46" ${stroke(color, 10)} />`
  },
  {
    id: 'arrow-down',
    label: 'Arrow down',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 40, h: 68 },
    body: (color) => `<path d="M50 10 V82 M22 54 L50 84 L78 54" ${stroke(color, 10)} />`
  },
  {
    id: 'star',
    label: 'Star',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 48, h: 48 },
    body: (color) =>
      `<path d="M50 8 L62 38 L94 41 L70 62 L77 94 L50 77 L23 94 L30 62 L6 41 L38 38 Z" fill="${color}" />`
  },
  {
    id: 'heart',
    label: 'Heart',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 46, h: 42 },
    body: (color) =>
      `<path d="M50 88 C18 66 6 50 6 33 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 33 C94 50 82 66 50 88 Z" fill="${color}" />`
  },
  {
    id: 'info',
    label: 'Info',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 44, h: 44 },
    body: (color) =>
      `<circle cx="50" cy="50" r="42" fill="${color}" />` +
      `<rect x="45" y="42" width="10" height="34" rx="5" fill="#ffffff" />` +
      `<circle cx="50" cy="27" r="6" fill="#ffffff" />`
  },
  {
    id: 'warning',
    label: 'Warning',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 48, h: 44 },
    body: (color) =>
      `<path d="M50 8 L94 88 H6 Z" fill="${color}" />` +
      `<rect x="45" y="36" width="10" height="30" rx="5" fill="#ffffff" />` +
      `<circle cx="50" cy="76" r="5.5" fill="#ffffff" />`
  },
  {
    id: 'circle',
    label: 'Circle',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 52, h: 52 },
    body: (color) => `<circle cx="50" cy="50" r="42" ${stroke(color, 8)} />`
  },
  {
    id: 'box',
    label: 'Square',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 52, h: 52 },
    body: (color) => `<rect x="10" y="10" width="80" height="80" rx="4" ${stroke(color, 8)} />`
  },
  {
    id: 'pointer',
    label: 'Pointer',
    group: 'icons',
    viewBox: { w: 100, h: 100 },
    size: { w: 30, h: 44 },
    body: (color) =>
      `<path d="M24 8 L24 78 L41 63 L52 92 L66 86 L55 58 L78 56 Z" fill="${color}" stroke="${color}" stroke-width="4" stroke-linejoin="round" />`
  }
]

const labelStamp = (id: string, label: string): StampDefinition => ({
  id,
  label,
  group: 'labels',
  viewBox: { w: 320, h: 96 },
  size: { w: 180, h: 54 },
  body: (c) =>
    `<rect x="4" y="4" width="312" height="88" rx="12" fill="none" stroke="${c}" stroke-width="6" />` +
    `<text x="160" y="64" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="46" font-weight="700" textLength="270" lengthAdjust="spacingAndGlyphs" fill="${c}">${label}</text>`
})

export const LABEL_STAMPS: StampDefinition[] = [
  labelStamp('label-approved', 'APPROVED'),
  labelStamp('label-rejected', 'REJECTED'),
  labelStamp('label-draft', 'DRAFT'),
  labelStamp('label-confidential', 'CONFIDENTIAL'),
  labelStamp('label-paid', 'PAID'),
  labelStamp('label-reviewed', 'REVIEWED')
]

export const ALL_STAMPS: StampDefinition[] = [...STAMPS, ...LABEL_STAMPS]

export function findStamp(id: string): StampDefinition | undefined {
  return ALL_STAMPS.find((stamp) => stamp.id === id)
}

export function stampSvg(stamp: StampDefinition, color: string): string {
  const { w, h } = stamp.viewBox
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    stamp.body(color) +
    '</svg>'
  )
}

const stampCache = new Map<string, string>()

/** Rasterises a stamp so pdf-lib can embed it without shipping vector fonts. */
export async function stampToPng(stamp: StampDefinition, color: string, scale = 3): Promise<string> {
  const key = `${stamp.id}|${color}|${scale}`
  const cached = stampCache.get(key)
  if (cached) return cached

  const { w, h } = stamp.viewBox
  const svg = stampSvg(stamp, color)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const image = new Image()
  image.width = w
  image.height = h
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Could not rasterise stamp'))
    image.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const png = canvas.toDataURL('image/png')
  stampCache.set(key, png)
  return png
}
