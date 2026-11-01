import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  AppSettings,
  DocumentState,
  RecentFile,
  StoredFont,
  StoredSignature
} from '@shared/types'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  sidecar: true,
  recent: []
}

export function userDataDir(): string {
  return app.getPath('userData')
}

function settingsFile(): string {
  return path.join(userDataDir(), 'settings.json')
}

function signaturesFile(): string {
  return path.join(userDataDir(), 'signatures.json')
}

function fontsIndexFile(): string {
  return path.join(userDataDir(), 'fonts', 'index.json')
}

export function fontsDir(): string {
  return path.join(userDataDir(), 'fonts')
}

export function backupsDir(): string {
  return path.join(userDataDir(), 'backups')
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw) as T
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

/** Writes to a sibling temp file first so a crash can never truncate user data. */
export async function atomicWrite(file: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(temp, data)
  await fs.rename(temp, file)
}

export async function getSettings(): Promise<AppSettings> {
  const stored = await readJson<Partial<AppSettings>>(settingsFile(), {})
  return { ...DEFAULT_SETTINGS, ...stored, recent: stored.recent ?? [] }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  const next: AppSettings = {
    ...current,
    ...patch,
    recent: patch.recent ?? current.recent
  }
  if (next.recent.length > 20) next.recent = next.recent.slice(0, 20)
  await atomicWrite(settingsFile(), JSON.stringify(next, null, 2))
  return next
}

export async function addRecent(file: { path: string; name: string }): Promise<void> {
  const settings = await getSettings()
  const recent: RecentFile[] = [
    { path: file.path, name: file.name, openedAt: Date.now() },
    ...settings.recent.filter((entry) => entry.path !== file.path)
  ]
  await updateSettings({ recent: recent.slice(0, 20) })
}

export async function listSignatures(): Promise<StoredSignature[]> {
  const list = await readJson<StoredSignature[]>(signaturesFile(), [])
  return [...list].sort((a, b) => b.createdAt - a.createdAt)
}

async function writeSignatures(list: StoredSignature[]): Promise<StoredSignature[]> {
  await atomicWrite(signaturesFile(), JSON.stringify(list, null, 2))
  return [...list].sort((a, b) => b.createdAt - a.createdAt)
}

export async function addSignature(name: string, png: string): Promise<StoredSignature[]> {
  const list = await listSignatures()
  const signature: StoredSignature = {
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    png,
    createdAt: Date.now()
  }
  return writeSignatures([signature, ...list])
}

export async function renameSignature(id: string, name: string): Promise<StoredSignature[]> {
  const list = await listSignatures()
  return writeSignatures(list.map((sig) => (sig.id === id ? { ...sig, name } : sig)))
}

export async function deleteSignature(id: string): Promise<StoredSignature[]> {
  const list = await listSignatures()
  return writeSignatures(list.filter((sig) => sig.id !== id))
}

export async function listFonts(): Promise<StoredFont[]> {
  return readJson<StoredFont[]>(fontsIndexFile(), [])
}

export async function saveFont(meta: StoredFont): Promise<StoredFont[]> {
  const list = await listFonts()
  const next = [...list.filter((font) => font.id !== meta.id), meta]
  await atomicWrite(fontsIndexFile(), JSON.stringify(next, null, 2))
  return next
}

export async function deleteFont(id: string): Promise<StoredFont[]> {
  const list = await listFonts()
  const target = list.find((font) => font.id === id)
  const next = list.filter((font) => font.id !== id)
  await atomicWrite(fontsIndexFile(), JSON.stringify(next, null, 2))
  if (target) {
    await fs.rm(path.join(fontsDir(), target.fileName), { force: true })
  }
  return next
}

/**
 * Keeps one backup per original file per app session so an overwrite is always recoverable
 * without filling the disk with copies.
 */
const backedUpThisSession = new Set<string>()

export async function backupExisting(file: string): Promise<void> {
  if (backedUpThisSession.has(file)) return
  try {
    await fs.access(file)
  } catch {
    return
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = path.join(backupsDir(), `${stamp}-${path.basename(file)}`)
  try {
    await fs.mkdir(backupsDir(), { recursive: true })
    await fs.copyFile(file, target)
    backedUpThisSession.add(file)
  } catch {
    // A missing backup must never block the save itself.
  }
}

export interface WindowDocState extends DocumentState {
  forceClose: boolean
}

const docStates = new Map<number, WindowDocState>()

export function setDocState(webContentsId: number, state: DocumentState): WindowDocState {
  const existing = docStates.get(webContentsId)
  const next: WindowDocState = {
    title: state.title,
    dirty: state.dirty,
    path: state.path,
    forceClose: existing?.forceClose ?? false
  }
  docStates.set(webContentsId, next)
  return next
}

export function getDocState(webContentsId: number): WindowDocState | undefined {
  return docStates.get(webContentsId)
}

export function markForceClose(webContentsId: number): void {
  const state = docStates.get(webContentsId)
  if (state) state.forceClose = true
  else docStates.set(webContentsId, { title: 'PDF Studio', dirty: false, path: null, forceClose: true })
}

export function forgetWindow(webContentsId: number): void {
  docStates.delete(webContentsId)
}
