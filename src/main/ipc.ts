import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { IPC, MAX_PDF_BYTES, PROJECT_SUFFIX } from '@shared/ipc'
import type {
  AppSettings,
  DocumentState,
  ImportedFont,
  ImportedImage,
  OpenedDocument
} from '@shared/types'
import * as store from './store'

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  return value
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function toBuffer(data: unknown): Buffer {
  if (data instanceof Uint8Array) {
    if (data.byteLength > MAX_PDF_BYTES) throw new Error('File is too large')
    return Buffer.from(data)
  }
  if (data instanceof ArrayBuffer) {
    if (data.byteLength > MAX_PDF_BYTES) throw new Error('File is too large')
    return Buffer.from(new Uint8Array(data))
  }
  throw new Error('Invalid binary payload')
}

function senderWindow(sender: Electron.WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(sender)
}

function showOpenDialog(win: BrowserWindow | null, options: Electron.OpenDialogOptions) {
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
}

function showSaveDialog(win: BrowserWindow | null, options: Electron.SaveDialogOptions) {
  return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options)
}

export function projectPathFor(pdfPath: string): string {
  return pdfPath.toLowerCase().endsWith('.pdf')
    ? `${pdfPath.slice(0, -4)}${PROJECT_SUFFIX}`
    : `${pdfPath}${PROJECT_SUFFIX}`
}

async function openDocument(filePath: string): Promise<OpenedDocument | null> {
  const info = await fs.stat(filePath)
  if (!info.isFile()) return null
  if (info.size > MAX_PDF_BYTES) throw new Error('PDF is larger than the 512 MB limit')
  const data = await fs.readFile(filePath)
  await store.addRecent({ path: filePath, name: path.basename(filePath) })
  return {
    path: filePath,
    name: path.basename(filePath),
    data: new Uint8Array(data)
  }
}

async function readFontFamily(fontBytes: Buffer, fallback: string): Promise<string> {
  try {
    const fontkit = (await import('@pdf-lib/fontkit')).default as unknown as {
      create: (input: Buffer) => { familyName?: string; name?: { familyName?: string } }
    }
    const font = fontkit.create(fontBytes)
    const family = font?.familyName ?? font?.name?.familyName
    if (typeof family === 'string' && family.trim().length > 0) return family.trim()
  } catch {
    // Fall back to the file name when the font cannot be parsed.
  }
  return fallback
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.openPdfDialog, async (event): Promise<OpenedDocument | null> => {
    const win = senderWindow(event.sender)
    const result = await showOpenDialog(win, {
      title: 'Open PDF',
      properties: ['openFile'],
      filters: [{ name: 'PDF documents', extensions: ['pdf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return openDocument(result.filePaths[0])
  })

  ipcMain.handle(IPC.openPdfAtPath, async (_event, filePath: unknown) =>
    openDocument(requireString(filePath, 'path'))
  )

  ipcMain.handle(IPC.readPdfAtPath, async (_event, filePath: unknown) =>
    openDocument(requireString(filePath, 'path'))
  )

  ipcMain.handle(IPC.savePdf, async (event, payload: unknown) => {
    const input = (payload ?? {}) as {
      data?: unknown
      suggestedName?: unknown
      forceDialog?: unknown
      path?: unknown
    }
    const buffer = toBuffer(input.data)
    const suggestedName =
      typeof input.suggestedName === 'string' && input.suggestedName.trim().length > 0
        ? input.suggestedName
        : 'document.pdf'
    let target = optionalString(input.path)
    const forceDialog = input.forceDialog !== false

    if (forceDialog || !target) {
      const win = senderWindow(event.sender)
      const result = await showSaveDialog(win, {
        title: 'Save PDF',
        defaultPath: target ?? path.join(app.getPath('documents'), suggestedName),
        filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      })
      if (result.canceled || !result.filePath) return null
      target = result.filePath.toLowerCase().endsWith('.pdf')
        ? result.filePath
        : `${result.filePath}.pdf`
    }

    await store.backupExisting(target)
    await store.atomicWrite(target, buffer)
    await store.addRecent({ path: target, name: path.basename(target) })
    return { path: target }
  })

  ipcMain.handle(IPC.writeProject, async (_event, pdfPath: unknown, json: unknown) => {
    const target = projectPathFor(requireString(pdfPath, 'path'))
    if (typeof json !== 'string') throw new Error('project payload must be a string')
    await store.atomicWrite(target, json)
    return true
  })

  ipcMain.handle(IPC.readProject, async (_event, pdfPath: unknown) => {
    const target = projectPathFor(requireString(pdfPath, 'path'))
    try {
      return await fs.readFile(target, 'utf8')
    } catch {
      return null
    }
  })

  ipcMain.handle(IPC.getSettings, () => store.getSettings())

  ipcMain.handle(IPC.updateSettings, async (_event, patch: unknown) => {
    const input = (patch ?? {}) as Partial<AppSettings>
    return store.updateSettings(input)
  })

  ipcMain.handle(IPC.listSignatures, () => store.listSignatures())

  ipcMain.handle(IPC.addSignature, async (_event, payload: unknown) => {
    const input = (payload ?? {}) as { name?: unknown; png?: unknown }
    const name =
      typeof input.name === 'string' && input.name.trim().length > 0
        ? input.name.trim()
        : 'Signature'
    const png = requireString(input.png, 'signature image')
    if (!png.startsWith('data:image/png;base64,')) throw new Error('Signature must be a PNG')
    return store.addSignature(name, png)
  })

  ipcMain.handle(IPC.renameSignature, async (_event, id: unknown, name: unknown) =>
    store.renameSignature(requireString(id, 'id'), requireString(name, 'name').trim())
  )

  ipcMain.handle(IPC.deleteSignature, async (_event, id: unknown) =>
    store.deleteSignature(requireString(id, 'id'))
  )

  ipcMain.handle(IPC.listFonts, () => store.listFonts())

  ipcMain.handle(IPC.pickFont, async (event): Promise<ImportedFont | null> => {
    const win = senderWindow(event.sender)
    const result = await showOpenDialog(win, {
      title: 'Import font',
      properties: ['openFile'],
      filters: [{ name: 'Fonts', extensions: ['ttf', 'otf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const source = result.filePaths[0]
    const info = await fs.stat(source)
    if (info.size > 20 * 1024 * 1024) throw new Error('Font files must be smaller than 20 MB')
    const bytes = await fs.readFile(source)
    const id = `font-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const fileName = `${id}${path.extname(source).toLowerCase()}`
    await fs.mkdir(store.fontsDir(), { recursive: true })
    await fs.writeFile(path.join(store.fontsDir(), fileName), bytes)
    const family = await readFontFamily(bytes, path.basename(source, path.extname(source)))
    await store.saveFont({ id, family, fileName, addedAt: Date.now() })
    return { id, family, dataBase64: bytes.toString('base64') }
  })

  ipcMain.handle(IPC.readFont, async (_event, id: unknown): Promise<ImportedFont | null> => {
    const fonts = await store.listFonts()
    const meta = fonts.find((font) => font.id === id)
    if (!meta) return null
    try {
      const bytes = await fs.readFile(path.join(store.fontsDir(), meta.fileName))
      return { id: meta.id, family: meta.family, dataBase64: bytes.toString('base64') }
    } catch {
      return null
    }
  })

  ipcMain.handle(IPC.deleteFont, async (_event, id: unknown) => store.deleteFont(requireString(id, 'id')))

  ipcMain.handle(IPC.pickImage, async (event): Promise<ImportedImage | null> => {
    const win = senderWindow(event.sender)
    const result = await showOpenDialog(win, {
      title: 'Insert image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const source = result.filePaths[0]
    const info = await fs.stat(source)
    if (info.size > 25 * 1024 * 1024) throw new Error('Images must be smaller than 25 MB')
    const bytes = await fs.readFile(source)
    const ext = path.extname(source).toLowerCase().replace('.', '')
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`
    return {
      name: path.basename(source),
      mime,
      dataUrl: `data:${mime};base64,${bytes.toString('base64')}`
    }
  })

  ipcMain.on(IPC.setDocumentState, (event, state: unknown) => {
    const input = (state ?? {}) as Partial<DocumentState>
    const next = store.setDocState(event.sender.id, {
      title: typeof input.title === 'string' ? input.title : 'PDF Studio',
      dirty: Boolean(input.dirty),
      path: optionalString(input.path)
    })
    const win = senderWindow(event.sender)
    if (win && !win.isDestroyed()) {
      win.setTitle(`${next.dirty ? '• ' : ''}${next.title}`)
      if (process.platform === 'darwin') win.setDocumentEdited(next.dirty)
      win.setRepresentedFilename(next.path ?? '')
    }
  })

  ipcMain.on(IPC.closeReady, (event) => {
    const win = senderWindow(event.sender)
    if (!win || win.isDestroyed()) return
    store.markForceClose(event.sender.id)
    win.close()
  })
}
