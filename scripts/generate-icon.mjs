// Generates build/icon.png (1024×1024) without any image dependencies.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const SIZE = 1024

const crcTable = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

const crc32 = (buffer) => {
  let crc = -1
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

const pixels = new Uint8Array(SIZE * SIZE * 4)

const blend = (x, y, [r, g, b], alpha) => {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || alpha <= 0) return
  const index = (y * SIZE + x) * 4
  const dstAlpha = pixels[index + 3] / 255
  const outAlpha = alpha + dstAlpha * (1 - alpha)
  if (outAlpha === 0) return
  pixels[index] = Math.round((r * alpha + pixels[index] * dstAlpha * (1 - alpha)) / outAlpha)
  pixels[index + 1] = Math.round((g * alpha + pixels[index + 1] * dstAlpha * (1 - alpha)) / outAlpha)
  pixels[index + 2] = Math.round((b * alpha + pixels[index + 2] * dstAlpha * (1 - alpha)) / outAlpha)
  pixels[index + 3] = Math.round(outAlpha * 255)
}

/** Coverage of a point inside a rounded rectangle, antialiased over a 3×3 sample grid. */
const roundedRectAlpha = (x, y, left, top, right, bottom, radius) => {
  let hits = 0
  for (let sy = 0; sy < 3; sy += 1) {
    for (let sx = 0; sx < 3; sx += 1) {
      const px = x + (sx + 0.5) / 3
      const py = y + (sy + 0.5) / 3
      if (px < left || px > right || py < top || py > bottom) continue
      const cx = Math.min(Math.max(px, left + radius), right - radius)
      const cy = Math.min(Math.max(py, top + radius), bottom - radius)
      if (Math.hypot(px - cx, py - cy) > radius) continue
      hits += 1
    }
  }
  return hits / 9
}

const thicknessAlpha = (distance, halfWidth) => {
  const edge = 1
  if (distance <= halfWidth - edge) return 1
  if (distance >= halfWidth + edge) return 0
  return Math.max(0, Math.min(1, (halfWidth + edge - distance) / (2 * edge)))
}

const distanceToSegment = (x, y, x1, y1, x2, y2) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSq))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

// Background: diagonal gradient inside a squircle.
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const alpha = roundedRectAlpha(x, y, 24, 24, SIZE - 24, SIZE - 24, 220)
    if (alpha === 0) continue
    const t = (x + y) / (SIZE * 2)
    const color = [
      Math.round(47 + t * 20),
      Math.round(111 - t * 45),
      Math.round(235 - t * 90)
    ]
    blend(x, y, color, alpha)
  }
}

// White page with a folded corner.
const pageLeft = 300
const pageTop = 214
const pageRight = 724
const pageBottom = 830
const radius = 34

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const alpha = roundedRectAlpha(x, y, pageLeft, pageTop, pageRight, pageBottom, radius)
    if (alpha === 0) continue
    const inFold = x > pageRight - 120 && y < pageTop + 120
    if (inFold && x - (pageRight - 120) > y - pageTop) continue
    blend(x, y, [246, 249, 253], alpha)
  }
}

// Fold triangle.
for (let y = pageTop; y < pageTop + 120; y += 1) {
  for (let x = pageRight - 120; x < pageRight; x += 1) {
    if (x - (pageRight - 120) <= y - pageTop) continue
    const t = (x - (pageRight - 120)) / 120
    blend(x, y, [Math.round(210 - t * 30), Math.round(222 - t * 30), Math.round(238 - t * 20)], 1)
  }
}

// Text lines.
for (const [lineY, width] of [
  [370, 300],
  [440, 250],
  [510, 300],
  [580, 200]
]) {
  for (let y = lineY; y < lineY + 26; y += 1) {
    for (let x = pageLeft + 44; x < pageLeft + 44 + width; x += 1) {
      blend(x, y, [180, 196, 216], 1)
    }
  }
}

// Check mark in the accent colour.
const check = [
  [430, 660],
  [500, 730],
  [650, 570]
]
for (let y = 540; y < 760; y += 1) {
  for (let x = 400; x < 690; x += 1) {
    let distance = Infinity
    for (let i = 1; i < check.length; i += 1) {
      distance = Math.min(
        distance,
        distanceToSegment(x, y, check[i - 1][0], check[i - 1][1], check[i][0], check[i][1])
      )
    }
    const alpha = thicknessAlpha(distance, 22)
    if (alpha > 0) blend(x, y, [52, 211, 153], alpha)
  }
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 4 + 1)] = 0
  Buffer.from(pixels.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1)
}

const header = Buffer.alloc(13)
header.writeUInt32BE(SIZE, 0)
header.writeUInt32BE(SIZE, 4)
header[8] = 8
header[9] = 6

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const target = join(root, 'build', 'icon.png')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, png)
console.log(`[icon] wrote ${target} (${(png.length / 1024).toFixed(1)} kB)`)
