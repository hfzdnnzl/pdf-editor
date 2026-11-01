import type {
  AppSettings,
  DesktopApi,
  DocumentState,
  ImportedFont,
  ImportedImage,
  OpenedDocument,
  StoredFont,
  StoredSignature
} from '@shared/types'

const SETTINGS_KEY = 'pdf-studio:settings'
const SIGNATURES_KEY = 'pdf-studio:signatures'

const DEFAULT_SETTINGS: AppSettings = { theme: 'system', sidecar: true, recent: [] }

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStore(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore quota errors in browser preview mode.
  }
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.position = 'fixed'
    input.style.left = '-1000px'
    document.body.appendChild(input)
    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null
      input.remove()
      resolve(file)
    })
    input.addEventListener('cancel', () => {
      input.remove()
      resolve(null)
    })
    input.click()
  })
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function readAsBytes(file: Blob): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer()
  return new Uint8Array(buffer)
}

function download(data: BlobPart, name: string, type: string): void {
  const blob = new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function projectKey(path: string): string {
  return `pdf-studio:project:${path}`
}

export const webApi: DesktopApi = {
  platform: 'web',

  async openPdfDialog(): Promise<OpenedDocument | null> {
    const file = await pickFile('application/pdf,.pdf')
    if (!file) return null
    return { path: file.name, name: file.name, data: await readAsBytes(file) }
  },

  async openPdfAtPath(): Promise<OpenedDocument | null> {
    return null
  },

  async readPdfAtPath(): Promise<OpenedDocument | null> {
    return null
  },

  async savePdf({ data, suggestedName }) {
    download(data as BlobPart, suggestedName, 'application/pdf')
    return { path: suggestedName }
  },

  async writeProject(pdfPath, json) {
    writeStore(projectKey(pdfPath), json)
    return true
  },

  async readProject(pdfPath) {
    const raw = localStorage.getItem(projectKey(pdfPath))
    return raw ?? null
  },

  async getSettings() {
    return { ...DEFAULT_SETTINGS, ...readStore<Partial<AppSettings>>(SETTINGS_KEY, {}) }
  },

  async updateSettings(patch) {
    const next = { ...(await webApi.getSettings()), ...patch }
    writeStore(SETTINGS_KEY, next)
    return next
  },

  async listSignatures() {
    return readStore<StoredSignature[]>(SIGNATURES_KEY, [])
  },

  async addSignature({ name, png }) {
    const list = await webApi.listSignatures()
    const next = [
      { id: `sig-${Date.now()}`, name: name || 'Signature', png, createdAt: Date.now() },
      ...list
    ]
    writeStore(SIGNATURES_KEY, next)
    return next
  },

  async renameSignature(id, name) {
    const list = (await webApi.listSignatures()).map((sig) =>
      sig.id === id ? { ...sig, name } : sig
    )
    writeStore(SIGNATURES_KEY, list)
    return list
  },

  async deleteSignature(id) {
    const list = (await webApi.listSignatures()).filter((sig) => sig.id !== id)
    writeStore(SIGNATURES_KEY, list)
    return list
  },

  async pickFont(): Promise<ImportedFont | null> {
    const file = await pickFile('.ttf,.otf')
    if (!file) return null
    const bytes = await readAsBytes(file)
    const id = `font-${Date.now()}`
    writeStore(`pdf-studio:font:${id}`, toBase64(bytes))
    const fonts = readStore<StoredFont[]>('pdf-studio:fonts', [])
    const next = [
      ...fonts,
      { id, family: file.name.replace(/\.(ttf|otf)$/i, ''), fileName: file.name, addedAt: Date.now() }
    ]
    writeStore('pdf-studio:fonts', next)
    return { id, family: file.name, dataBase64: toBase64(bytes) }
  },

  async listFonts() {
    return readStore<StoredFont[]>('pdf-studio:fonts', [])
  },

  async readFont(id) {
    const raw = localStorage.getItem(`pdf-studio:font:${id}`)
    if (!raw) return null
    const meta = readStore<StoredFont[]>('pdf-studio:fonts', []).find((font) => font.id === id)
    return { id, family: meta?.family ?? 'Imported font', dataBase64: raw }
  },

  async deleteFont(id) {
    localStorage.removeItem(`pdf-studio:font:${id}`)
    const next = readStore<StoredFont[]>('pdf-studio:fonts', []).filter((font) => font.id !== id)
    writeStore('pdf-studio:fonts', next)
    return next
  },

  async pickImage(): Promise<ImportedImage | null> {
    const file = await pickFile('image/*')
    if (!file) return null
    return { name: file.name, mime: file.type, dataUrl: await readAsDataUrl(file) }
  },

  setDocumentState(state: DocumentState) {
    document.title = `${state.dirty ? '• ' : ''}${state.title}`
  },

  closeReady() {
    window.close()
  },


  onOpenFile() {
    return () => undefined
  },
  onMenuCommand() {
    return () => undefined
  },
  onRequestSave() {
    return () => undefined
  }
}
