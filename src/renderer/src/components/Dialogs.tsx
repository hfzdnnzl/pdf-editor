import { useEffect, useState } from 'react'
import type { ThemeMode } from '@shared/types'
import { desk } from '@/platform'
import { useFontStore } from '@/state/fontStore'
import { useUiStore } from '@/state/uiStore'
import { Modal } from './Modal'
import { Field, SelectField, Switch } from './Controls'
import { TrashIcon } from './Icons'
import { SignatureDialog } from './SignatureDialog'
import { StampPicker } from './StampPicker'

export function DialogHost() {
  const dialog = useUiStore((state) => state.dialog)
  switch (dialog) {
    case 'shortcuts':
      return <ShortcutsDialog />
    case 'about':
      return <AboutDialog />
    case 'settings':
      return <SettingsDialog />
    case 'signatures':
      return <SignatureDialog />
    case 'stamps':
      return <StampPicker />
    default:
      return null
  }
}

const SHORTCUTS: Array<[string, string]> = [
  ['⌘/Ctrl + O', 'Open a PDF'],
  ['⌘/Ctrl + S', 'Save (writes edits into the PDF)'],
  ['⇧⌘/Ctrl + S', 'Save as…'],
  ['⌘/Ctrl + Z', 'Undo'],
  ['⇧⌘/Ctrl + Z', 'Redo'],
  ['⌘/Ctrl + D', 'Duplicate selection'],
  ['Delete / Backspace', 'Delete selection'],
  ['⌘/Ctrl + A', 'Select all text in a field'],
  ['⌘/Ctrl + = / −', 'Zoom in / out'],
  ['⌘/Ctrl + 0', 'Actual size'],
  ['⌘/Ctrl + 1', 'Fit width'],
  ['⌘/Ctrl + 2', 'Fit page'],
  ['V / T / X / S / I', 'Select · Text · Edit text · Signature · Stamp'],
  ['Arrow keys', 'Nudge selection (⇧ = 10 pt)'],
  ['⇧ while resizing', 'Keep aspect ratio'],
  ['⇧ while rotating', 'Snap to 15°'],
  ['Double-click text', 'Edit text inline'],
  ['Esc', 'Finish editing / close dialog']
]

function ShortcutsDialog() {
  const close = useUiStore((state) => state.closeDialog)
  return (
    <Modal
      title="Keyboard shortcuts"
      onClose={close}
      footer={
        <button className="btn" onClick={close}>
          Done
        </button>
      }
    >
      <dl className="kbd-table">
        {SHORTCUTS.map(([keys, description]) => (
          <div key={keys} style={{ display: 'contents' }}>
            <dt>
              {keys.split(' / ').map((part) => (
                <span key={part} style={{ marginRight: 4 }}>
                  <span className="kbd">{part}</span>
                </span>
              ))}
            </dt>
            <dd style={{ margin: 0 }}>{description}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}

function AboutDialog() {
  const close = useUiStore((state) => state.closeDialog)
  return (
    <Modal
      title="About PDF Studio"
      onClose={close}
      footer={
        <button className="btn" onClick={close}>
          Close
        </button>
      }
    >
      <div className="about">
        <p>
          <strong>PDF Studio</strong> is a local-first desktop PDF editor. Everything you open stays
          on this machine — there are no uploads, accounts or telemetry.
        </p>
        <p>Built with Electron, pdf.js (rendering) and pdf-lib (writing).</p>
        <ul>
          <li>Text boxes with font family, size, bold, italic, underline, strike and colour</li>
          <li>Rewriting text that already exists in the document</li>
          <li>Drawn, typed and scanned signatures with a reusable library</li>
          <li>Icons and label stamps, images, shapes</li>
          <li>Page reorder, rotate, duplicate, delete and insert blank pages</li>
        </ul>
      </div>
    </Modal>
  )
}

function SettingsDialog() {
  const close = useUiStore((state) => state.closeDialog)
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const fonts = useFontStore((state) => state.fonts)
  const removeFont = useFontStore((state) => state.removeFont)
  const importFont = useFontStore((state) => state.importFont)
  const [sidecar, setSidecar] = useState(true)

  useEffect(() => {
    desk
      .getSettings()
      .then((settings) => setSidecar(settings.sidecar))
      .catch(() => undefined)
    void useFontStore.getState().refresh()
  }, [])

  const updateSidecar = async (enabled: boolean) => {
    setSidecar(enabled)
    await desk.updateSettings({ sidecar: enabled })
  }

  return (
    <Modal
      title="Settings"
      onClose={close}
      footer={
        <button className="btn" onClick={close}>
          Done
        </button>
      }
    >
      <Field label="Appearance">
        <SelectField value={theme} onChange={(value) => setTheme(value as ThemeMode)}>
          <option value="system">Match system</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </SelectField>
      </Field>

      <Switch
        label="Keep a project sidecar (.pdfed.json) next to saved PDFs"
        checked={sidecar}
        onChange={(enabled) => void updateSidecar(enabled)}
      />
      <p className="hint">
        The sidecar stores your edits so they stay editable the next time you open the PDF. Turn it
        off if you only want the flattened PDF.
      </p>

      <div className="panel__section-title">Imported fonts</div>
      {fonts.length === 0 ? (
        <p className="hint">No fonts imported. Add a TTF or OTF to use it in text boxes.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fonts.map((font) => (
            <div key={font.id} className="field__row" style={{ justifyContent: 'space-between' }}>
              <span>{font.family}</span>
              <button className="iconbtn" title="Remove font" onClick={() => void removeFont(font.id)}>
                <TrashIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="btn" onClick={() => void importFont()} style={{ justifyContent: 'center' }}>
        Import a font…
      </button>

      <p className="hint">
        Signatures, imported fonts and settings live in the app data folder and never leave this
        computer.
      </p>
    </Modal>
  )
}
