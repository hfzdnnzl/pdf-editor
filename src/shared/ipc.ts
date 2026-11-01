export const IPC = {
  openPdfDialog: 'pdf:open-dialog',
  openPdfAtPath: 'pdf:open-path',
  savePdf: 'pdf:save',
  readPdfAtPath: 'pdf:read',
  writeProject: 'project:write',
  readProject: 'project:read',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  listSignatures: 'signatures:list',
  addSignature: 'signatures:add',
  renameSignature: 'signatures:rename',
  deleteSignature: 'signatures:delete',
  pickFont: 'fonts:pick',
  listFonts: 'fonts:list',
  readFont: 'fonts:read',
  deleteFont: 'fonts:delete',
  pickImage: 'images:pick',
  setDocumentState: 'doc:state',
  closeReady: 'doc:close-ready',
  openFileEvent: 'app:open-file',
  menuCommandEvent: 'app:menu-command',
  requestSaveEvent: 'app:request-save'
} as const

export const PDF_EXTENSIONS = ['pdf']
export const PROJECT_SUFFIX = '.pdfed.json'
export const MAX_PDF_BYTES = 512 * 1024 * 1024
