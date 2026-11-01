import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { DesktopApi, DocumentState, ImportedImage, MenuCommand, OpenedDocument } from '@shared/types'

const api: DesktopApi = {
  platform: process.platform,
  openPdfDialog: () => ipcRenderer.invoke(IPC.openPdfDialog) as Promise<OpenedDocument | null>,
  openPdfAtPath: (filePath) =>
    ipcRenderer.invoke(IPC.openPdfAtPath, filePath) as Promise<OpenedDocument | null>,
  readPdfAtPath: (filePath) =>
    ipcRenderer.invoke(IPC.readPdfAtPath, filePath) as Promise<OpenedDocument | null>,
  savePdf: (payload) => ipcRenderer.invoke(IPC.savePdf, payload),
  writeProject: (pdfPath, json) => ipcRenderer.invoke(IPC.writeProject, pdfPath, json),
  readProject: (pdfPath) => ipcRenderer.invoke(IPC.readProject, pdfPath) as Promise<string | null>,
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch),
  listSignatures: () => ipcRenderer.invoke(IPC.listSignatures),
  addSignature: (payload) => ipcRenderer.invoke(IPC.addSignature, payload),
  renameSignature: (id, name) => ipcRenderer.invoke(IPC.renameSignature, id, name),
  deleteSignature: (id) => ipcRenderer.invoke(IPC.deleteSignature, id),
  pickFont: () => ipcRenderer.invoke(IPC.pickFont),
  listFonts: () => ipcRenderer.invoke(IPC.listFonts),
  readFont: (id) => ipcRenderer.invoke(IPC.readFont, id),
  deleteFont: (id) => ipcRenderer.invoke(IPC.deleteFont, id),
  pickImage: () => ipcRenderer.invoke(IPC.pickImage) as Promise<ImportedImage | null>,
  setDocumentState: (state: DocumentState) => ipcRenderer.send(IPC.setDocumentState, state),
  closeReady: () => ipcRenderer.send(IPC.closeReady),
  onOpenFile: (handler) => {
    const listener = (_event: unknown, filePath: string) => handler(filePath)
    ipcRenderer.on(IPC.openFileEvent, listener)
    return () => ipcRenderer.removeListener(IPC.openFileEvent, listener)
  },
  onMenuCommand: (handler) => {
    const listener = (_event: unknown, command: MenuCommand) => handler(command)
    ipcRenderer.on(IPC.menuCommandEvent, listener)
    return () => ipcRenderer.removeListener(IPC.menuCommandEvent, listener)
  },
  onRequestSave: (handler) => {
    const listener = () => handler()
    ipcRenderer.on(IPC.requestSaveEvent, listener)
    return () => ipcRenderer.removeListener(IPC.requestSaveEvent, listener)
  }
}

contextBridge.exposeInMainWorld('desktop', api)
