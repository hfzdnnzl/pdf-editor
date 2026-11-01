import { BrowserWindow, app, nativeTheme, net, protocol } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC } from '@shared/ipc'
import { registerIpcHandlers } from './ipc'
import { buildApplicationMenu } from './menu'
import { createWindow } from './windows'

const pendingOpenPaths: string[] = []

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

function registerAppProtocol(): void {
  const rendererDir = path.join(__dirname, '../renderer')
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const filePath = path.normalize(path.join(rendererDir, relative || 'index.html'))
    if (!filePath.startsWith(rendererDir)) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function pdfFromArgv(argv: string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('-')) continue
    if (arg.toLowerCase().endsWith('.pdf')) return path.resolve(arg)
  }
  return null
}

function deliverOpenPath(filePath: string): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) {
    pendingOpenPaths.push(filePath)
    return
  }
  // Keep a reference to the webContents: `win.webContents` throws once the window is destroyed.
  const contents = win.webContents
  if (contents.isLoading()) {
    contents.once('did-finish-load', () => {
      if (!contents.isDestroyed()) contents.send(IPC.openFileEvent, filePath)
    })
  } else {
    contents.send(IPC.openFileEvent, filePath)
    win.focus()
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    } else {
      createWindow()
    }
    const filePath = pdfFromArgv(argv)
    if (filePath) deliverOpenPath(filePath)
  })

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (app.isReady()) deliverOpenPath(filePath)
    else pendingOpenPaths.push(filePath)
  })

  app.whenReady().then(() => {
    nativeTheme.themeSource = 'system'
    app.setAboutPanelOptions({
      applicationName: 'PDF Studio',
      applicationVersion: app.getVersion(),
      copyright: 'Built with Electron, pdf.js and pdf-lib',
      credits: 'View and edit PDFs locally — nothing leaves your machine.'
    })

    registerAppProtocol()
    registerIpcHandlers()
    buildApplicationMenu()

    const initialPath = pdfFromArgv(process.argv)
    if (initialPath) pendingOpenPaths.push(initialPath)

    const win = createWindow()
    const contents = win.webContents
    contents.on('did-fail-load', (_event, code, description, url) => {
      console.error('[main] renderer failed to load', code, description, url)
    })
    contents.once('did-finish-load', () => {
      for (const filePath of pendingOpenPaths.splice(0)) {
        if (contents.isDestroyed()) break
        contents.send(IPC.openFileEvent, filePath)
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
