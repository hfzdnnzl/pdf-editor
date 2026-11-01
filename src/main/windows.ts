import { BrowserWindow, app, dialog, nativeTheme, shell } from 'electron'
import path from 'node:path'
import { IPC } from '@shared/ipc'
import * as store from './store'

let closeDialogOpen = false

async function guardUnsavedChanges(win: BrowserWindow, event: Electron.Event): Promise<void> {
  if (win.isDestroyed()) return
  // Capture the id up front: the window can be destroyed while the dialog is open, and touching
  // `win.webContents` afterwards throws "Object has been destroyed".
  const webContentsId = win.webContents.id
  const state = store.getDocState(webContentsId)
  if (!state || !state.dirty || state.forceClose) return

  event.preventDefault()
  if (closeDialogOpen) return
  closeDialogOpen = true
  try {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      // "Cancel" is both the default and the cancel button on purpose: if the dialog is dismissed
      // implicitly (e.g. the process is being terminated), the safe outcome must be "do nothing".
      // Any implicit resolution to "Save" would silently rewrite the user's file.
      defaultId: 2,
      cancelId: 2,
      noLink: true,
      message: `Do you want to save the changes you made to “${state.title}”?`,
      detail: "Your changes will be lost if you don't save them."
    })
    if (response === 0) {
      // The renderer saves, then calls `closeReady`, which forces the close.
      if (!win.isDestroyed()) win.webContents.send(IPC.requestSaveEvent)
    } else if (response === 1) {
      store.markForceClose(webContentsId)
      if (!win.isDestroyed()) win.close()
    }
  } finally {
    closeDialogOpen = false
  }
}

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'PDF Studio',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111418' : '#f4f5f7',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 18 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      webSecurity: true
    }
  })

  // `closed` fires after the window is destroyed, so the webContents id has to be captured now.
  const webContentsId = win.webContents.id

  win.once('ready-to-show', () => win.show())
  win.on('close', (event) => void guardUnsavedChanges(win, event))
  win.on('closed', () => store.forgetWindow(webContentsId))

  if (!app.isPackaged) {
    // Surfacing renderer errors in the terminal makes the dev loop far easier to debug.
    win.webContents.on('console-message', (event) => {
      if (event.level === 'warning' || event.level === 'error') {
        console.log(`[renderer:${event.level}] ${event.message}`)
      }
    })
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const isDevServer = process.env['ELECTRON_RENDERER_URL']
    if (isDevServer && url.startsWith(isDevServer)) return
    event.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadURL('app://bundle/index.html')
  }

  return win
}
