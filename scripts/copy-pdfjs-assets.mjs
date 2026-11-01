// Copies pdf.js runtime assets that cannot be bundled (fonts, cmaps, wasm) into the
// renderer's public folder so the viewer works offline in a packaged app.
import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(root, 'node_modules', 'pdfjs-dist')
const target = join(root, 'src', 'renderer', 'public', 'pdfjs')
const folders = ['standard_fonts', 'cmaps', 'wasm', 'iccs']

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

if (!(await exists(source))) {
  console.warn('[pdfjs-assets] pdfjs-dist is not installed yet, skipping copy')
  process.exit(0)
}

await mkdir(target, { recursive: true })
for (const folder of folders) {
  const from = join(source, folder)
  if (!(await exists(from))) continue
  await cp(from, join(target, folder), { recursive: true })
}

const copied = await readdir(target)
console.log(`[pdfjs-assets] copied ${copied.join(', ')} -> src/renderer/public/pdfjs`)
