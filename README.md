# PDF Studio

A local-first desktop PDF viewer and editor for **macOS** and **Windows**. Add and rewrite text with
real font controls, drop in signatures, stamps, icons and images, then export a flattened PDF that
opens anywhere. Everything runs on your machine — no accounts, uploads or telemetry.

![app icon](build/icon.png)

## Features

**Viewing**
- Continuous multi-page view with fit-width, fit-page, actual-size and custom zoom (10 %–600 %)
- Page thumbnails, click-to-jump, drag-to-reorder, rotate, duplicate, delete and blank-page insertion
- Real text layer from pdf.js, so the page is rendered exactly as a PDF viewer would

**Text**
- Text boxes placed by click or drag, with font family, size, **bold**, *italic*, underline,
  strikethrough, colour, alignment, line height, opacity, background fill and border
- Automatic wrapping and auto-growing height, inline editing, rotation and resize handles
- **Edit existing text**: click a run of text that is already in the PDF; PDF Studio samples its
  size, weight, alignment, colour and background, then covers the original with a matching patch
  and draws the replacement on top

**Signatures**
- Draw with a trackpad/mouse/pen, with velocity-based stroke width and undo
- Type a name in a bundled script font (Caveat, Great Vibes)
- Upload a scan: the background is made transparent, ink is deepened and the image is auto-cropped
- Every signature is stored in a reusable library (rename/delete) in the app data folder

**Icons, stamps and images**
- Built-in vector icon set: tick, tick-in-circle, cross, arrows, star, heart, info, warning,
  circle, square, pointer
- Label stamps: APPROVED, REJECTED, DRAFT, CONFIDENTIAL, PAID, REVIEWED
- Recolourable, resizable, rotatable; stamps are rasterised at 3× so they stay sharp in print
- PNG/JPG/WEBP/GIF/BMP images (other formats are converted to PNG on insertion)

**Shapes**
- Rectangle, ellipse, line and arrow with stroke colour, width and optional fill

**Saving**
- *Save* writes your edits into a real, flattened PDF (atomic write, with a session backup of the
  overwritten original)
- A `.pdfed.json` sidecar next to the PDF keeps your edits re-editable next time you open the file
  (can be switched off in Settings)
- *Export Flattened Copy…* always writes to a new file

**Everywhere else**
- Undo/redo (80 steps), duplicate, copy/paste-free duplication, layer order, lock, nudge with arrow
  keys, page-edge and centre snapping
- Full keyboard shortcut set plus a native macOS/Windows menu bar and file association for `.pdf`
- Light/dark/system theme, drag-and-drop opening, recent files, unsaved-changes protection

## Requirements

- Node.js 20.19+ (or 22.12+) and npm
- macOS 11+ or Windows 10+ to run the packaged app

## Development

```bash
npm install          # installs deps, downloads Electron, copies pdf.js assets
npm run dev          # Electron + Vite dev server with hot reload
npm run typecheck    # strict TypeScript for main/preload and renderer
npm test             # Vitest: geometry, text layout, PDF export round-trip
npm run build        # production bundle into out/
```

## Packaging

```bash
npm run dist:mac     # → release/PDF Studio-1.0.0-arm64.dmg, .zip (arm64 + x64)
npm run dist:win     # → release/PDF Studio-1.0.0-x64.exe (NSIS + portable)
npm run dist         # current platform
npm run icon         # regenerate build/icon.png
```

`.github/workflows/build.yml` builds and uploads both macOS and Windows installers on every push and
tag. Builds are unsigned by default (macOS will ask you to right-click → *Open* the first time);
add `CSC_LINK` / `CSC_KEY_PASSWORD` and the `APPLE_*` secrets to sign and notarise.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + O` | Open a PDF |
| `⌘/Ctrl + S` | Save into the PDF |
| `⇧⌘/Ctrl + S` | Save as… |
| `⌘/Ctrl + Z` / `⇧⌘/Ctrl + Z` | Undo / redo |
| `⌘/Ctrl + D` | Duplicate selection |
| `Delete` / `Backspace` | Delete selection |
| `⌘/Ctrl + =` / `−` / `0` | Zoom in / out / actual size |
| `⌘/Ctrl + 1` / `2` | Fit width / fit page |
| `V` `T` `X` | Select · Text box · Edit existing text |
| Arrow keys (`⇧` = 10 pt) | Nudge selection |
| `⇧` while resizing / rotating | Keep aspect ratio / snap to 15° |
| `Esc` | Finish editing, clear selection |

## How editing works

PDF has no reflowable text model, so PDF Studio keeps your edits as typed overlays on a page model
and only writes them into the PDF when you save:

```ts
{ id, pageId, type: 'text' | 'text-edit' | 'signature' | 'image' | 'stamp' | 'shape',
  x, y, w, h,              // PDF points, bottom-left origin, independent of zoom
  rotation, opacity, locked, ...typeSpecificFields }
```

- Overlays render live as DOM above the pdf.js canvas (crisp at any zoom, editable forever).
- On save, `pdf-lib` copies the source pages in your order, applies page rotation, creates blank
  pages, then draws each overlay: real vector text (embedded fonts), images, rasterised stamps,
  vector shapes, each with its own rotation/opacity.
- Pages are addressed by `sourceIndex` plus an extra `rotation`, so reorder/rotate/duplicate/delete
  are non-destructive until export.

### Fonts

- Built-in PDF standard fonts: **Helvetica**, **Times**, **Courier** in regular, bold, italic and
  bold-italic — no embedding needed, maximum compatibility.
- Import any `.ttf`/`.otf` from the font picker or Settings; it is embedded (subset) into the saved
  PDF. Imported fonts are used as-is, so pick a file that already contains the weight you need.
- The standard fonts are limited to the WinAnsi character set (Latin-1 plus common typographic
  punctuation). Characters outside it are shown with a warning and exported as `?` — import a TTF
  that covers your language instead.

## Data & privacy

Nothing leaves your machine. The app stores only:

| What | Where |
| --- | --- |
| Settings, recent files | `%APPDATA%/PDF Studio` (Windows), `~/Library/Application Support/PDF Studio` (macOS) |
| Signature library | same folder, `signatures.json` |
| Imported fonts | same folder, `fonts/` |
| Backups of overwritten PDFs | same folder, `backups/` |
| Edits sidecar | next to the PDF, `<name>.pdfed.json` |

(Running `npm run dev` uses the same folder names — Electron names the app after `productName` in
packaged builds and `name` in development, so dev data lives in `.../pdf-studio`.)

The renderer is sandboxed (`contextIsolation`, `sandbox`, no `nodeIntegration`), talks to the main
process only through a narrow typed preload API, and is served from a private `app://` protocol.

## Project layout

```
src/main/         Electron main process: window, native menu, IPC, atomic file IO, JSON stores
src/preload/      contextBridge API exposed as window.desktop
src/shared/       Types, IPC channel names, colour helpers shared by all processes
src/renderer/     React app
  pdf/            pdf.js loading/rendering, page views, text layout, pdf-lib export pipeline
  overlays/       Overlay rendering, selection handles, inline editor, stamps, signatures
  components/     Toolbar, rail, thumbnails, properties panel, dialogs, toast
  state/          zustand stores (document + undo history, UI, fonts) and file actions
  platform/       Desktop API plus a browser shim for previewing the UI in a browser
scripts/          pdf.js asset copy + app icon generator
```

## Known limitations

- **Not** included: AcroForm filling, password-protected/encrypted PDFs, OCR, PDF/A export,
  merging other PDFs, certificate-based digital signatures, true text reflow.
- In-place text editing is best-effort: the original run is covered by a colour-matched patch and
  the new text is drawn on top. Replaced text loses the original's exact kerning, glyphs are
  matched to the nearest standard font (Helvetica/Times/Courier) when the source used a custom
  font, and the replaced glyphs still exist in the PDF content stream beneath the patch — so
  select-all/copy in another PDF reader picks up both the old and the new wording. Use the patch
  only for wording you are happy to have hidden rather than removed.
- Rotated or heavily transformed source text runs may be approximated by their bounding box.
- Very large documents render page-by-page; the first scroll through a 1000-page file takes a
  moment, thumbnails are rendered lazily.

## License

MIT
