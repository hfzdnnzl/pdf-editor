import { BrowserWindow, Menu, app, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { IPC } from '@shared/ipc'
import type { MenuCommand } from '@shared/types'

function send(command: MenuCommand): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(IPC.menuCommandEvent, command)
}

const item = (
  label: string,
  command: MenuCommand,
  accelerator?: string
): MenuItemConstructorOptions => ({
  label,
  accelerator,
  click: () => send(command)
})

export function buildApplicationMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        item('Open…', 'file:open', 'CmdOrCtrl+O'),
        { type: 'separator' },
        item('Save', 'file:save', 'CmdOrCtrl+S'),
        item('Save As…', 'file:save-as', 'Shift+CmdOrCtrl+S'),
        item('Export Flattened Copy…', 'file:export'),
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        item('Undo', 'edit:undo', 'CmdOrCtrl+Z'),
        item('Redo', 'edit:redo', 'Shift+CmdOrCtrl+Z'),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { type: 'separator' },
        item('Duplicate', 'edit:duplicate', 'CmdOrCtrl+D'),
        item('Delete', 'edit:delete'),
        item('Select All', 'edit:select-all', 'CmdOrCtrl+A')
      ]
    },
    {
      label: 'View',
      submenu: [
        item('Zoom In', 'view:zoom-in', 'CmdOrCtrl+Plus'),
        item('Zoom Out', 'view:zoom-out', 'CmdOrCtrl+-'),
        item('Actual Size', 'view:zoom-reset', 'CmdOrCtrl+0'),
        item('Fit Width', 'view:fit-width', 'CmdOrCtrl+1'),
        item('Fit Page', 'view:fit-page', 'CmdOrCtrl+2'),
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged
          ? []
          : ([{ type: 'separator' }, { role: 'toggleDevTools' }] as MenuItemConstructorOptions[]))
      ]
    },
    {
      label: 'Page',
      submenu: [
        item('Rotate Clockwise', 'page:rotate-cw', 'CmdOrCtrl+]'),
        item('Rotate Counter-clockwise', 'page:rotate-ccw', 'CmdOrCtrl+['),
        { type: 'separator' },
        item('Insert Blank Page', 'page:insert-blank'),
        item('Duplicate Page', 'page:duplicate'),
        item('Delete Page', 'page:delete')
      ]
    },
    {
      label: 'Tools',
      submenu: [
        item('Select', 'tool:select', 'V'),
        item('Text Box', 'tool:text', 'T'),
        item('Edit Existing Text', 'tool:edit-text', 'X'),
        item('Signature', 'tool:signature', 'S'),
        item('Stamp / Icon', 'tool:stamp', 'I')
      ]
    },
    {
      label: 'Help',
      submenu: [
        item('Keyboard Shortcuts', 'help:shortcuts', 'CmdOrCtrl+/'),
        item('About PDF Studio', 'help:about'),
        { type: 'separator' },
        {
          label: 'pdf.js project',
          click: () => void shell.openExternal('https://mozilla.github.io/pdf.js/')
        }
      ]
    }
  ]

  // `S` is used both by "Save" (as ⌘S) and the signature tool; keep tools accelerator-free on
  // macOS where bare letters would swallow typing in text fields.
  if (isMac) {
    const tools = template.find((entry) => entry.label === 'Tools')
    if (tools && Array.isArray(tools.submenu)) {
      tools.submenu = tools.submenu.map((entry) => ({ ...entry, accelerator: undefined }))
    }
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
