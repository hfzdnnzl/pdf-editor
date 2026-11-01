"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("node:path");
const node_url = require("node:url");
const node_fs = require("node:fs");
const IPC = {
  openPdfDialog: "pdf:open-dialog",
  openPdfAtPath: "pdf:open-path",
  savePdf: "pdf:save",
  readPdfAtPath: "pdf:read",
  writeProject: "project:write",
  readProject: "project:read",
  getSettings: "settings:get",
  updateSettings: "settings:update",
  listSignatures: "signatures:list",
  addSignature: "signatures:add",
  renameSignature: "signatures:rename",
  deleteSignature: "signatures:delete",
  pickFont: "fonts:pick",
  listFonts: "fonts:list",
  readFont: "fonts:read",
  deleteFont: "fonts:delete",
  pickImage: "images:pick",
  setDocumentState: "doc:state",
  closeReady: "doc:close-ready",
  openFileEvent: "app:open-file",
  menuCommandEvent: "app:menu-command",
  requestSaveEvent: "app:request-save"
};
const PROJECT_SUFFIX = ".pdfed.json";
const MAX_PDF_BYTES = 512 * 1024 * 1024;
const DEFAULT_SETTINGS = {
  theme: "system",
  sidecar: true,
  recent: []
};
function userDataDir() {
  return electron.app.getPath("userData");
}
function settingsFile() {
  return path.join(userDataDir(), "settings.json");
}
function signaturesFile() {
  return path.join(userDataDir(), "signatures.json");
}
function fontsIndexFile() {
  return path.join(userDataDir(), "fonts", "index.json");
}
function fontsDir() {
  return path.join(userDataDir(), "fonts");
}
function backupsDir() {
  return path.join(userDataDir(), "backups");
}
async function readJson(file, fallback) {
  try {
    const raw = await node_fs.promises.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
async function atomicWrite(file, data) {
  await node_fs.promises.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await node_fs.promises.writeFile(temp, data);
  await node_fs.promises.rename(temp, file);
}
async function getSettings() {
  const stored = await readJson(settingsFile(), {});
  return { ...DEFAULT_SETTINGS, ...stored, recent: stored.recent ?? [] };
}
async function updateSettings(patch) {
  const current = await getSettings();
  const next = {
    ...current,
    ...patch,
    recent: patch.recent ?? current.recent
  };
  if (next.recent.length > 20) next.recent = next.recent.slice(0, 20);
  await atomicWrite(settingsFile(), JSON.stringify(next, null, 2));
  return next;
}
async function addRecent(file) {
  const settings = await getSettings();
  const recent = [
    { path: file.path, name: file.name, openedAt: Date.now() },
    ...settings.recent.filter((entry) => entry.path !== file.path)
  ];
  await updateSettings({ recent: recent.slice(0, 20) });
}
async function listSignatures() {
  const list = await readJson(signaturesFile(), []);
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}
async function writeSignatures(list) {
  await atomicWrite(signaturesFile(), JSON.stringify(list, null, 2));
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}
async function addSignature(name, png) {
  const list = await listSignatures();
  const signature = {
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    png,
    createdAt: Date.now()
  };
  return writeSignatures([signature, ...list]);
}
async function renameSignature(id, name) {
  const list = await listSignatures();
  return writeSignatures(list.map((sig) => sig.id === id ? { ...sig, name } : sig));
}
async function deleteSignature(id) {
  const list = await listSignatures();
  return writeSignatures(list.filter((sig) => sig.id !== id));
}
async function listFonts() {
  return readJson(fontsIndexFile(), []);
}
async function saveFont(meta) {
  const list = await listFonts();
  const next = [...list.filter((font) => font.id !== meta.id), meta];
  await atomicWrite(fontsIndexFile(), JSON.stringify(next, null, 2));
  return next;
}
async function deleteFont(id) {
  const list = await listFonts();
  const target = list.find((font) => font.id === id);
  const next = list.filter((font) => font.id !== id);
  await atomicWrite(fontsIndexFile(), JSON.stringify(next, null, 2));
  if (target) {
    await node_fs.promises.rm(path.join(fontsDir(), target.fileName), { force: true });
  }
  return next;
}
const backedUpThisSession = /* @__PURE__ */ new Set();
async function backupExisting(file) {
  if (backedUpThisSession.has(file)) return;
  try {
    await node_fs.promises.access(file);
  } catch {
    return;
  }
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const target = path.join(backupsDir(), `${stamp}-${path.basename(file)}`);
  try {
    await node_fs.promises.mkdir(backupsDir(), { recursive: true });
    await node_fs.promises.copyFile(file, target);
    backedUpThisSession.add(file);
  } catch {
  }
}
const docStates = /* @__PURE__ */ new Map();
function setDocState(webContentsId, state) {
  const existing = docStates.get(webContentsId);
  const next = {
    title: state.title,
    dirty: state.dirty,
    path: state.path,
    forceClose: existing?.forceClose ?? false
  };
  docStates.set(webContentsId, next);
  return next;
}
function getDocState(webContentsId) {
  return docStates.get(webContentsId);
}
function markForceClose(webContentsId) {
  const state = docStates.get(webContentsId);
  if (state) state.forceClose = true;
  else docStates.set(webContentsId, { title: "PDF Studio", dirty: false, path: null, forceClose: true });
}
function forgetWindow(webContentsId) {
  docStates.delete(webContentsId);
}
function requireString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}
function optionalString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function toBuffer(data) {
  if (data instanceof Uint8Array) {
    if (data.byteLength > MAX_PDF_BYTES) throw new Error("File is too large");
    return Buffer.from(data);
  }
  if (data instanceof ArrayBuffer) {
    if (data.byteLength > MAX_PDF_BYTES) throw new Error("File is too large");
    return Buffer.from(new Uint8Array(data));
  }
  throw new Error("Invalid binary payload");
}
function senderWindow(sender) {
  return electron.BrowserWindow.fromWebContents(sender);
}
function showOpenDialog(win, options) {
  return win ? electron.dialog.showOpenDialog(win, options) : electron.dialog.showOpenDialog(options);
}
function showSaveDialog(win, options) {
  return win ? electron.dialog.showSaveDialog(win, options) : electron.dialog.showSaveDialog(options);
}
function projectPathFor(pdfPath) {
  return pdfPath.toLowerCase().endsWith(".pdf") ? `${pdfPath.slice(0, -4)}${PROJECT_SUFFIX}` : `${pdfPath}${PROJECT_SUFFIX}`;
}
async function openDocument(filePath) {
  const info = await node_fs.promises.stat(filePath);
  if (!info.isFile()) return null;
  if (info.size > MAX_PDF_BYTES) throw new Error("PDF is larger than the 512 MB limit");
  const data = await node_fs.promises.readFile(filePath);
  await addRecent({ path: filePath, name: path.basename(filePath) });
  return {
    path: filePath,
    name: path.basename(filePath),
    data: new Uint8Array(data)
  };
}
async function readFontFamily(fontBytes, fallback) {
  try {
    const fontkit = (await import("@pdf-lib/fontkit")).default;
    const font = fontkit.create(fontBytes);
    const family = font?.familyName ?? font?.name?.familyName;
    if (typeof family === "string" && family.trim().length > 0) return family.trim();
  } catch {
  }
  return fallback;
}
function registerIpcHandlers() {
  electron.ipcMain.handle(IPC.openPdfDialog, async (event) => {
    const win = senderWindow(event.sender);
    const result = await showOpenDialog(win, {
      title: "Open PDF",
      properties: ["openFile"],
      filters: [{ name: "PDF documents", extensions: ["pdf"] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return openDocument(result.filePaths[0]);
  });
  electron.ipcMain.handle(
    IPC.openPdfAtPath,
    async (_event, filePath) => openDocument(requireString(filePath, "path"))
  );
  electron.ipcMain.handle(
    IPC.readPdfAtPath,
    async (_event, filePath) => openDocument(requireString(filePath, "path"))
  );
  electron.ipcMain.handle(IPC.savePdf, async (event, payload) => {
    const input = payload ?? {};
    const buffer = toBuffer(input.data);
    const suggestedName = typeof input.suggestedName === "string" && input.suggestedName.trim().length > 0 ? input.suggestedName : "document.pdf";
    let target = optionalString(input.path);
    const forceDialog = input.forceDialog !== false;
    if (forceDialog || !target) {
      const win = senderWindow(event.sender);
      const result = await showSaveDialog(win, {
        title: "Save PDF",
        defaultPath: target ?? path.join(electron.app.getPath("documents"), suggestedName),
        filters: [{ name: "PDF documents", extensions: ["pdf"] }],
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });
      if (result.canceled || !result.filePath) return null;
      target = result.filePath.toLowerCase().endsWith(".pdf") ? result.filePath : `${result.filePath}.pdf`;
    }
    await backupExisting(target);
    await atomicWrite(target, buffer);
    await addRecent({ path: target, name: path.basename(target) });
    return { path: target };
  });
  electron.ipcMain.handle(IPC.writeProject, async (_event, pdfPath, json) => {
    const target = projectPathFor(requireString(pdfPath, "path"));
    if (typeof json !== "string") throw new Error("project payload must be a string");
    await atomicWrite(target, json);
    return true;
  });
  electron.ipcMain.handle(IPC.readProject, async (_event, pdfPath) => {
    const target = projectPathFor(requireString(pdfPath, "path"));
    try {
      return await node_fs.promises.readFile(target, "utf8");
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle(IPC.getSettings, () => getSettings());
  electron.ipcMain.handle(IPC.updateSettings, async (_event, patch) => {
    const input = patch ?? {};
    return updateSettings(input);
  });
  electron.ipcMain.handle(IPC.listSignatures, () => listSignatures());
  electron.ipcMain.handle(IPC.addSignature, async (_event, payload) => {
    const input = payload ?? {};
    const name = typeof input.name === "string" && input.name.trim().length > 0 ? input.name.trim() : "Signature";
    const png = requireString(input.png, "signature image");
    if (!png.startsWith("data:image/png;base64,")) throw new Error("Signature must be a PNG");
    return addSignature(name, png);
  });
  electron.ipcMain.handle(
    IPC.renameSignature,
    async (_event, id, name) => renameSignature(requireString(id, "id"), requireString(name, "name").trim())
  );
  electron.ipcMain.handle(
    IPC.deleteSignature,
    async (_event, id) => deleteSignature(requireString(id, "id"))
  );
  electron.ipcMain.handle(IPC.listFonts, () => listFonts());
  electron.ipcMain.handle(IPC.pickFont, async (event) => {
    const win = senderWindow(event.sender);
    const result = await showOpenDialog(win, {
      title: "Import font",
      properties: ["openFile"],
      filters: [{ name: "Fonts", extensions: ["ttf", "otf"] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const source = result.filePaths[0];
    const info = await node_fs.promises.stat(source);
    if (info.size > 20 * 1024 * 1024) throw new Error("Font files must be smaller than 20 MB");
    const bytes = await node_fs.promises.readFile(source);
    const id = `font-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `${id}${path.extname(source).toLowerCase()}`;
    await node_fs.promises.mkdir(fontsDir(), { recursive: true });
    await node_fs.promises.writeFile(path.join(fontsDir(), fileName), bytes);
    const family = await readFontFamily(bytes, path.basename(source, path.extname(source)));
    await saveFont({ id, family, fileName, addedAt: Date.now() });
    return { id, family, dataBase64: bytes.toString("base64") };
  });
  electron.ipcMain.handle(IPC.readFont, async (_event, id) => {
    const fonts = await listFonts();
    const meta = fonts.find((font) => font.id === id);
    if (!meta) return null;
    try {
      const bytes = await node_fs.promises.readFile(path.join(fontsDir(), meta.fileName));
      return { id: meta.id, family: meta.family, dataBase64: bytes.toString("base64") };
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle(IPC.deleteFont, async (_event, id) => deleteFont(requireString(id, "id")));
  electron.ipcMain.handle(IPC.pickImage, async (event) => {
    const win = senderWindow(event.sender);
    const result = await showOpenDialog(win, {
      title: "Insert image",
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const source = result.filePaths[0];
    const info = await node_fs.promises.stat(source);
    if (info.size > 25 * 1024 * 1024) throw new Error("Images must be smaller than 25 MB");
    const bytes = await node_fs.promises.readFile(source);
    const ext = path.extname(source).toLowerCase().replace(".", "");
    const mime = ext === "jpg" ? "image/jpeg" : `image/${ext || "png"}`;
    return {
      name: path.basename(source),
      mime,
      dataUrl: `data:${mime};base64,${bytes.toString("base64")}`
    };
  });
  electron.ipcMain.on(IPC.setDocumentState, (event, state) => {
    const input = state ?? {};
    const next = setDocState(event.sender.id, {
      title: typeof input.title === "string" ? input.title : "PDF Studio",
      dirty: Boolean(input.dirty),
      path: optionalString(input.path)
    });
    const win = senderWindow(event.sender);
    if (win && !win.isDestroyed()) {
      win.setTitle(`${next.dirty ? "• " : ""}${next.title}`);
      if (process.platform === "darwin") win.setDocumentEdited(next.dirty);
      win.setRepresentedFilename(next.path ?? "");
    }
  });
  electron.ipcMain.on(IPC.closeReady, (event) => {
    const win = senderWindow(event.sender);
    if (!win || win.isDestroyed()) return;
    markForceClose(event.sender.id);
    win.close();
  });
}
function send(command) {
  const win = electron.BrowserWindow.getFocusedWindow() ?? electron.BrowserWindow.getAllWindows()[0];
  win?.webContents.send(IPC.menuCommandEvent, command);
}
const item = (label, command, accelerator) => ({
  label,
  accelerator,
  click: () => send(command)
});
function buildApplicationMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...isMac ? [
      {
        label: electron.app.name,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" }
        ]
      }
    ] : [],
    {
      label: "File",
      submenu: [
        item("Open…", "file:open", "CmdOrCtrl+O"),
        { type: "separator" },
        item("Save", "file:save", "CmdOrCtrl+S"),
        item("Save As…", "file:save-as", "Shift+CmdOrCtrl+S"),
        item("Export Flattened Copy…", "file:export"),
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        item("Undo", "edit:undo", "CmdOrCtrl+Z"),
        item("Redo", "edit:redo", "Shift+CmdOrCtrl+Z"),
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { type: "separator" },
        item("Duplicate", "edit:duplicate", "CmdOrCtrl+D"),
        item("Delete", "edit:delete"),
        item("Select All", "edit:select-all", "CmdOrCtrl+A")
      ]
    },
    {
      label: "View",
      submenu: [
        item("Zoom In", "view:zoom-in", "CmdOrCtrl+Plus"),
        item("Zoom Out", "view:zoom-out", "CmdOrCtrl+-"),
        item("Actual Size", "view:zoom-reset", "CmdOrCtrl+0"),
        item("Fit Width", "view:fit-width", "CmdOrCtrl+1"),
        item("Fit Page", "view:fit-page", "CmdOrCtrl+2"),
        { type: "separator" },
        { role: "togglefullscreen" },
        ...electron.app.isPackaged ? [] : [{ type: "separator" }, { role: "toggleDevTools" }]
      ]
    },
    {
      label: "Page",
      submenu: [
        item("Rotate Clockwise", "page:rotate-cw", "CmdOrCtrl+]"),
        item("Rotate Counter-clockwise", "page:rotate-ccw", "CmdOrCtrl+["),
        { type: "separator" },
        item("Insert Blank Page", "page:insert-blank"),
        item("Duplicate Page", "page:duplicate"),
        item("Delete Page", "page:delete")
      ]
    },
    {
      label: "Tools",
      submenu: [
        item("Select", "tool:select", "V"),
        item("Text Box", "tool:text", "T"),
        item("Edit Existing Text", "tool:edit-text", "X"),
        item("Signature", "tool:signature", "S"),
        item("Stamp / Icon", "tool:stamp", "I")
      ]
    },
    {
      label: "Help",
      submenu: [
        item("Keyboard Shortcuts", "help:shortcuts", "CmdOrCtrl+/"),
        item("About PDF Studio", "help:about"),
        { type: "separator" },
        {
          label: "pdf.js project",
          click: () => void electron.shell.openExternal("https://mozilla.github.io/pdf.js/")
        }
      ]
    }
  ];
  if (isMac) {
    const tools = template.find((entry) => entry.label === "Tools");
    if (tools && Array.isArray(tools.submenu)) {
      tools.submenu = tools.submenu.map((entry) => ({ ...entry, accelerator: void 0 }));
    }
  }
  electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(template));
}
let closeDialogOpen = false;
async function guardUnsavedChanges(win, event) {
  if (win.isDestroyed()) return;
  const webContentsId = win.webContents.id;
  const state = getDocState(webContentsId);
  if (!state || !state.dirty || state.forceClose) return;
  event.preventDefault();
  if (closeDialogOpen) return;
  closeDialogOpen = true;
  try {
    const { response } = await electron.dialog.showMessageBox(win, {
      type: "warning",
      buttons: ["Save", "Don't Save", "Cancel"],
      // "Cancel" is both the default and the cancel button on purpose: if the dialog is dismissed
      // implicitly (e.g. the process is being terminated), the safe outcome must be "do nothing".
      // Any implicit resolution to "Save" would silently rewrite the user's file.
      defaultId: 2,
      cancelId: 2,
      noLink: true,
      message: `Do you want to save the changes you made to “${state.title}”?`,
      detail: "Your changes will be lost if you don't save them."
    });
    if (response === 0) {
      if (!win.isDestroyed()) win.webContents.send(IPC.requestSaveEvent);
    } else if (response === 1) {
      markForceClose(webContentsId);
      if (!win.isDestroyed()) win.close();
    }
  } finally {
    closeDialogOpen = false;
  }
}
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: "PDF Studio",
    backgroundColor: electron.nativeTheme.shouldUseDarkColors ? "#111418" : "#f4f5f7",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 18 } : void 0,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      webSecurity: true
    }
  });
  const webContentsId = win.webContents.id;
  win.once("ready-to-show", () => win.show());
  win.on("close", (event) => void guardUnsavedChanges(win, event));
  win.on("closed", () => forgetWindow(webContentsId));
  if (!electron.app.isPackaged) {
    win.webContents.on("console-message", (event) => {
      if (event.level === "warning" || event.level === "error") {
        console.log(`[renderer:${event.level}] ${event.message}`);
      }
    });
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void electron.shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    const isDevServer = process.env["ELECTRON_RENDERER_URL"];
    if (isDevServer && url.startsWith(isDevServer)) return;
    event.preventDefault();
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void win.loadURL("app://bundle/index.html");
  }
  return win;
}
const pendingOpenPaths = [];
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);
function registerAppProtocol() {
  const rendererDir = path.join(__dirname, "../renderer");
  electron.protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const filePath = path.normalize(path.join(rendererDir, relative || "index.html"));
    if (!filePath.startsWith(rendererDir)) {
      return new Response("Not found", { status: 404 });
    }
    return electron.net.fetch(node_url.pathToFileURL(filePath).toString());
  });
}
function pdfFromArgv(argv) {
  for (const arg of argv.slice(1)) {
    if (arg.startsWith("-")) continue;
    if (arg.toLowerCase().endsWith(".pdf")) return path.resolve(arg);
  }
  return null;
}
function deliverOpenPath(filePath) {
  const win = electron.BrowserWindow.getAllWindows()[0];
  if (!win) {
    pendingOpenPaths.push(filePath);
    return;
  }
  const contents = win.webContents;
  if (contents.isLoading()) {
    contents.once("did-finish-load", () => {
      if (!contents.isDestroyed()) contents.send(IPC.openFileEvent, filePath);
    });
  } else {
    contents.send(IPC.openFileEvent, filePath);
    win.focus();
  }
}
const gotLock = electron.app.requestSingleInstanceLock();
if (!gotLock) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", (_event, argv) => {
    const win = electron.BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    } else {
      createWindow();
    }
    const filePath = pdfFromArgv(argv);
    if (filePath) deliverOpenPath(filePath);
  });
  electron.app.on("open-file", (event, filePath) => {
    event.preventDefault();
    if (electron.app.isReady()) deliverOpenPath(filePath);
    else pendingOpenPaths.push(filePath);
  });
  electron.app.whenReady().then(() => {
    electron.nativeTheme.themeSource = "system";
    electron.app.setAboutPanelOptions({
      applicationName: "PDF Studio",
      applicationVersion: electron.app.getVersion(),
      copyright: "Built with Electron, pdf.js and pdf-lib",
      credits: "View and edit PDFs locally — nothing leaves your machine."
    });
    registerAppProtocol();
    registerIpcHandlers();
    buildApplicationMenu();
    const initialPath = pdfFromArgv(process.argv);
    if (initialPath) pendingOpenPaths.push(initialPath);
    const win = createWindow();
    const contents = win.webContents;
    contents.on("did-fail-load", (_event, code, description, url) => {
      console.error("[main] renderer failed to load", code, description, url);
    });
    contents.once("did-finish-load", () => {
      for (const filePath of pendingOpenPaths.splice(0)) {
        if (contents.isDestroyed()) break;
        contents.send(IPC.openFileEvent, filePath);
      }
    });
    electron.app.on("activate", () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") electron.app.quit();
  });
}
