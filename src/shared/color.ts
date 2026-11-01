export interface Rgb {
  r: number
  g: number
  b: number
}

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Parses `#rgb` / `#rrggbb` into 0..1 components. Falls back to black. */
export function parseHexColor(value: string): Rgb {
  const match = HEX_PATTERN.exec(value.trim())
  if (!match) return { r: 0, g: 0, b: 0 }
  let hex = match[1]
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255
  }
}

export function toHexColor(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)))
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`
}

/** Perceived luminance (0..1), used to pick readable text over a sampled background. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
