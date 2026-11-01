import type { DesktopApi } from '@shared/types'

declare global {
  interface Window {
    desktop?: DesktopApi
  }
}

import { webApi } from './web'

const electronApi = typeof window !== 'undefined' ? window.desktop : undefined

export const isDesktop = Boolean(electronApi)

/** Electron IPC when packaged, an in-browser shim for previewing the UI in a browser. */
export const desk: DesktopApi = electronApi ?? webApi
