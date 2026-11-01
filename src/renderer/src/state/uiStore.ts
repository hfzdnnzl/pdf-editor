import { create } from 'zustand'
import type { ThemeMode } from '@shared/types'

export type DialogId = 'shortcuts' | 'about' | 'settings' | 'signatures' | 'stamps' | null

export interface ToastMessage {
  id: number
  message: string
  tone: 'info' | 'success' | 'error'
}

interface UiStore {
  theme: ThemeMode
  systemDark: boolean
  sidebarOpen: boolean
  propertiesOpen: boolean
  dialog: DialogId
  toast: ToastMessage | null
  setTheme(theme: ThemeMode): void
  setSystemDark(dark: boolean): void
  toggleSidebar(): void
  toggleProperties(): void
  openDialog(dialog: DialogId): void
  closeDialog(): void
  showToast(message: string, tone?: ToastMessage['tone']): void
  dismissToast(id: number): void
}

let toastId = 0

export const useUiStore = create<UiStore>((set) => ({
  theme: 'system',
  systemDark: true,
  sidebarOpen: true,
  propertiesOpen: true,
  dialog: null,
  toast: null,
  setTheme: (theme) => set({ theme }),
  setSystemDark: (systemDark) => set({ systemDark }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleProperties: () => set((state) => ({ propertiesOpen: !state.propertiesOpen })),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  showToast: (message, tone = 'info') => {
    toastId += 1
    const id = toastId
    set({ toast: { id, message, tone } })
    setTimeout(() => {
      set((state) => (state.toast?.id === id ? { toast: null } : state))
    }, 4200)
  },
  dismissToast: (id) => set((state) => (state.toast?.id === id ? { toast: null } : state))
}))

export const resolvedTheme = (theme: ThemeMode, systemDark: boolean): 'light' | 'dark' =>
  theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
