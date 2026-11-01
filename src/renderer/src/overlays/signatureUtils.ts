const TRIM_THRESHOLD = 8

/** Crops transparent margins and returns a padded PNG data URL. */
export function trimCanvas(source: HTMLCanvasElement, padding = 12): string {
  const ctx = source.getContext('2d')
  if (!ctx) return source.toDataURL('image/png')
  const { width, height } = source
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > TRIM_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0 || maxY < 0) return source.toDataURL('image/png')

  const target = document.createElement('canvas')
  target.width = maxX - minX + 1 + padding * 2
  target.height = maxY - minY + 1 + padding * 2
  const targetCtx = target.getContext('2d')
  if (!targetCtx) return source.toDataURL('image/png')
  targetCtx.drawImage(source, minX, minY, maxX - minX + 1, maxY - minY + 1, padding, padding, maxX - minX + 1, maxY - minY + 1)
  return target.toDataURL('image/png')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not read that image'))
    image.src = src
  })
}

/** Turns a scanned signature into a transparent PNG and trims the empty space. */
export async function cleanScannedSignature(dataUrl: string, threshold = 232): Promise<string> {
  const image = await loadImage(dataUrl)
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, 1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const brightness = (r + g + b) / 3
    if (brightness > threshold) {
      data[i + 3] = 0
      continue
    }
    // Deepen light grey ink so the signature reads as black ink.
    const factor = Math.min(1, 1 - (brightness - 40) / 400)
    data[i] = Math.round(r * factor)
    data[i + 1] = Math.round(g * factor)
    data[i + 2] = Math.round(b * factor)
  }
  ctx.putImageData(pixels, 0, 0)
  return trimCanvas(canvas)
}

export const SIGNATURE_FONTS = [
  { id: 'Caveat', label: 'Caveat', css: '"Caveat", cursive' },
  { id: 'Great Vibes', label: 'Great Vibes', css: '"Great Vibes", cursive' }
]

export async function renderTypedSignature(
  text: string,
  fontId: string,
  color = '#101820'
): Promise<string> {
  const font = SIGNATURE_FONTS.find((entry) => entry.id === fontId) ?? SIGNATURE_FONTS[0]
  try {
    await document.fonts.load(`96px ${font.css}`)
  } catch {
    // Fall back to the browser default if the bundled font is unavailable.
  }
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('Canvas is unavailable')
  measureCtx.font = `96px ${font.css}`
  const width = Math.ceil(measureCtx.measureText(text).width) + 80
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(320, width)
  canvas.height = 240
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.font = `96px ${font.css}`
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 40, canvas.height / 2)
  return trimCanvas(canvas, 10)
}
