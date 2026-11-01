import { create } from 'zustand'
import type { ImportedFont, StoredFont } from '@shared/types'
import { CUSTOM_CSS_PREFIX } from '@/pdf/textLayout'
import { desk } from '@/platform'

interface LoadedFont {
  family: string
  bytes: Uint8Array
}

interface FontStore {
  fonts: StoredFont[]
  loaded: Record<string, LoadedFont>
  refresh(): Promise<void>
  ensureLoaded(id: string): Promise<LoadedFont | null>
  importFont(): Promise<ImportedFont | null>
  removeFont(id: string): Promise<void>
  labelFor(familyRef: string): string
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function registerFontFace(id: string, bytes: Uint8Array): Promise<string> {
  const family = `${CUSTOM_CSS_PREFIX}${id}`
  try {
    const face = new FontFace(family, bytes.buffer as ArrayBuffer)
    await face.load()
    document.fonts.add(face)
  } catch (error) {
    console.warn('[fonts] could not register preview font', error)
  }
  return family
}

export const useFontStore = create<FontStore>((set, get) => ({
  fonts: [],
  loaded: {},

  refresh: async () => {
    try {
      const fonts = await desk.listFonts()
      set({ fonts })
    } catch (error) {
      console.warn('[fonts] list failed', error)
    }
  },

  ensureLoaded: async (id) => {
    const existing = get().loaded[id]
    if (existing) return existing
    const imported = await desk.readFont(id)
    if (!imported) return null
    const bytes = base64ToBytes(imported.dataBase64)
    const family = await registerFontFace(id, bytes)
    const entry: LoadedFont = { family, bytes }
    set((state) => ({ loaded: { ...state.loaded, [id]: entry } }))
    return entry
  },

  importFont: async () => {
    const imported = await desk.pickFont()
    if (!imported) return null
    const bytes = base64ToBytes(imported.dataBase64)
    const family = await registerFontFace(imported.id, bytes)
    set((state) => ({
      loaded: { ...state.loaded, [imported.id]: { family, bytes } },
      fonts: [
        ...state.fonts.filter((font) => font.id !== imported.id),
        { id: imported.id, family: imported.family, fileName: '', addedAt: Date.now() }
      ]
    }))
    await get().refresh()
    return imported
  },

  removeFont: async (id) => {
    const fonts = await desk.deleteFont(id)
    set((state) => {
      const loaded = { ...state.loaded }
      delete loaded[id]
      return { fonts, loaded }
    })
  },

  labelFor: (familyRef) => {
    if (!familyRef.startsWith('custom:')) return familyRef
    const id = familyRef.slice('custom:'.length)
    return get().fonts.find((font) => font.id === id)?.family ?? 'Imported font'
  }
}))
