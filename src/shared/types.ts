export type Align = 'left' | 'center' | 'right'
export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow'
export type ThemeMode = 'system' | 'light' | 'dark'

/** Built-in font families available without embedding a font file. */
export type StandardFontFamily = 'Helvetica' | 'Times' | 'Courier'
/** `Helvetica`, `Times`, `Courier`, or `custom:<id>` for a user-imported TTF/OTF. */
export type FontFamilyRef = StandardFontFamily | `custom:${string}`

/** Geometry is stored in PDF points with a bottom-left origin, independent of zoom and view rotation. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface OverlayBase extends Rect {
  id: string
  pageId: string
  /** Degrees, clockwise. */
  rotation: number
  /** 0..1 */
  opacity: number
  locked: boolean
}

export interface TextStyle {
  text: string
  fontFamily: FontFamilyRef
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  /** `#rrggbb` */
  color: string
  align: Align
  /** Multiplier of the font size. */
  lineHeight: number
  bgColor: string | null
  borderColor: string | null
  borderWidth: number
}

export interface TextOverlay extends OverlayBase, TextStyle {
  type: 'text'
}

/** A replacement for a text run that already exists in the source PDF. */
export interface TextEditOverlay extends OverlayBase, TextStyle {
  type: 'text-edit'
  /** Colour of the rectangle painted over the original run before drawing the new text. */
  patchColor: string
  /** Rectangle covering the original run, in page points. */
  patch: Rect
}

export interface SignatureOverlay extends OverlayBase {
  type: 'signature'
  /** PNG data URL with a transparent background. */
  png: string
  label?: string
}

export interface ImageOverlay extends OverlayBase {
  type: 'image'
  dataUrl: string
  mime: 'image/png' | 'image/jpeg'
}

export interface StampOverlay extends OverlayBase {
  type: 'stamp'
  stampId: string
  color: string
}

export interface ShapeOverlay extends OverlayBase {
  type: 'shape'
  shape: ShapeKind
  stroke: string
  fill: string | null
  strokeWidth: number
}

export type Overlay =
  | TextOverlay
  | TextEditOverlay
  | SignatureOverlay
  | ImageOverlay
  | StampOverlay
  | ShapeOverlay

export type TextCapableOverlay = TextOverlay | TextEditOverlay

export const isTextOverlay = (o: Overlay): o is TextCapableOverlay =>
  o.type === 'text' || o.type === 'text-edit'

export const isTextEditOverlay = (o: Overlay): o is TextEditOverlay => o.type === 'text-edit'

/** A page of the working document. Blank pages have `sourceIndex === null`. */
export interface PageModel {
  id: string
  sourceIndex: number | null
  /** Extra rotation in degrees added to the source page rotation. */
  rotation: number
  /** The `/Rotate` value the source page already had. */
  sourceRotation: number
  /** Source page size in points, before view rotation. */
  width: number
  height: number
}

export interface ProjectFile {
  version: 1
  sourceName: string
  pages: PageModel[]
  overlays: Record<string, Overlay[]>
}

export interface StoredSignature {
  id: string
  name: string
  png: string
  createdAt: number
}

export interface StoredFont {
  id: string
  family: string
  fileName: string
  addedAt: number
}

export interface RecentFile {
  path: string
  name: string
  openedAt: number
}

export interface AppSettings {
  theme: ThemeMode
  /** Write a `.pdfed.json` sidecar next to the PDF so edits stay re-editable. */
  sidecar: boolean
  recent: RecentFile[]
}

export interface OpenedDocument {
  path: string
  name: string
  data: Uint8Array
}

export interface ImportedFont {
  id: string
  family: string
  /** Raw font file bytes, base64 encoded. */
  dataBase64: string
}

export interface ImportedImage {
  name: string
  dataUrl: string
  mime: string
}

export interface DocumentState {
  title: string
  dirty: boolean
  path: string | null
}

export type MenuCommand =
  | 'file:open'
  | 'file:save'
  | 'file:export'
  | 'file:save-as'
  | 'file:close'
  | 'edit:undo'
  | 'edit:redo'
  | 'edit:delete'
  | 'edit:duplicate'
  | 'edit:select-all'
  | 'view:zoom-in'
  | 'view:zoom-out'
  | 'view:zoom-reset'
  | 'view:fit-width'
  | 'view:fit-page'
  | 'page:rotate-cw'
  | 'page:rotate-ccw'
  | 'page:delete'
  | 'page:insert-blank'
  | 'page:duplicate'
  | 'tool:select'
  | 'tool:text'
  | 'tool:signature'
  | 'tool:stamp'
  | 'tool:edit-text'
  | 'help:shortcuts'
  | 'help:about'

export interface DesktopApi {
  platform: string
  openPdfDialog(): Promise<OpenedDocument | null>
  openPdfAtPath(path: string): Promise<OpenedDocument | null>
  savePdf(payload: {
    data: Uint8Array
    suggestedName: string
    forceDialog: boolean
    path: string | null
  }): Promise<{ path: string } | null>
  readPdfAtPath(path: string): Promise<OpenedDocument | null>
  writeProject(pdfPath: string, json: string): Promise<boolean>
  readProject(pdfPath: string): Promise<string | null>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  listSignatures(): Promise<StoredSignature[]>
  addSignature(payload: { name: string; png: string }): Promise<StoredSignature[]>
  renameSignature(id: string, name: string): Promise<StoredSignature[]>
  deleteSignature(id: string): Promise<StoredSignature[]>
  pickFont(): Promise<ImportedFont | null>
  listFonts(): Promise<StoredFont[]>
  readFont(id: string): Promise<ImportedFont | null>
  deleteFont(id: string): Promise<StoredFont[]>
  pickImage(): Promise<ImportedImage | null>
  setDocumentState(state: DocumentState): void
  closeReady(): void
  onOpenFile(handler: (path: string) => void): () => void
  onMenuCommand(handler: (command: MenuCommand) => void): () => void
  onRequestSave(handler: () => void): () => void
}
