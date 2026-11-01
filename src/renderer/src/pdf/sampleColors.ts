import { toHexColor } from '@shared/color'

interface Region {
  left: number
  top: number
  width: number
  height: number
}

/** Samples the rendered page to recover the colours of an existing text run. */
export function sampleRunColors(
  canvas: HTMLCanvasElement | null,
  region: Region
): { background: string; text: string } {
  const fallback = { background: '#ffffff', text: '#111827' }
  if (!canvas || canvas.width === 0 || canvas.height === 0) return fallback
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return fallback

  const cssWidth = canvas.clientWidth || canvas.width
  const cssHeight = canvas.clientHeight || canvas.height
  const scaleX = canvas.width / cssWidth
  const scaleY = canvas.height / cssHeight

  const x = Math.max(0, Math.floor(region.left * scaleX))
  const y = Math.max(0, Math.floor(region.top * scaleY))
  const w = Math.min(canvas.width - x, Math.ceil(region.width * scaleX))
  const h = Math.min(canvas.height - y, Math.ceil(region.height * scaleY))
  if (w <= 0 || h <= 0) return fallback

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(x, y, w, h).data
  } catch {
    return fallback
  }

  const counts = new Map<number, number>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 32) continue
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (counts.size === 0) return fallback

  const decode = (key: number): [number, number, number] => [
    (key >> 16) & 0xff,
    (key >> 8) & 0xff,
    key & 0xff
  ]

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [bgKey] = sorted[0]
  const bg = decode(bgKey)
  // Paper is almost always pure white; snap near-white so the patch is invisible.
  const nearWhite = bg.every((channel) => channel >= 238)
  const bgHex = nearWhite ? '#ffffff' : toHexColor(bg[0] / 255, bg[1] / 255, bg[2] / 255)

  let textHex: string | null = null
  let bestScore = 0
  for (const [key, count] of sorted.slice(1)) {
    const color = decode(key)
    const distance = Math.sqrt(
      (color[0] - bg[0]) ** 2 + (color[1] - bg[1]) ** 2 + (color[2] - bg[2]) ** 2
    )
    if (distance < 70) continue
    const score = distance * Math.log10(count + 1)
    if (score > bestScore) {
      bestScore = score
      textHex = toHexColor(color[0] / 255, color[1] / 255, color[2] / 255)
    }
  }

  return { background: bgHex, text: textHex ?? (bgHex === '#ffffff' ? '#111827' : '#ffffff') }
}
