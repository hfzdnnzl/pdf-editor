import type { Overlay, ShapeKind, TextCapableOverlay } from '@shared/types'
import { useDocumentStore } from '@/state/documentStore'
import { useFontStore } from '@/state/fontStore'
import { useUiStore } from '@/state/uiStore'
import { insertImageFromDisk } from '@/state/fileActions'
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BringForwardIcon,
  CopyIcon,
  ItalicIcon,
  LockIcon,
  RotateCwIcon,
  SendBackwardIcon,
  StrikeIcon,
  TrashIcon,
  UnderlineIcon,
  UnlockIcon
} from './Icons'
import {
  ColorField,
  Field,
  IconToggle,
  NumberInput,
  RangeInput,
  Segmented,
  SelectField,
  Switch
} from './Controls'

const isText = (overlay: Overlay | null): overlay is TextCapableOverlay =>
  Boolean(overlay && (overlay.type === 'text' || overlay.type === 'text-edit'))

export function PropertiesPanel() {
  const selected = useDocumentStore((state) => state.selectedOverlay())
  const page = useDocumentStore((state) =>
    state.activePageId ? state.pageById(state.activePageId) : undefined
  )
  const textDefaults = useDocumentStore((state) => state.textDefaults)
  const pageCount = useDocumentStore((state) => state.pages.length)
  const fonts = useFontStore((state) => state.fonts)
  const importFont = useFontStore((state) => state.importFont)
  const openDialog = useUiStore((state) => state.openDialog)
  const showToast = useUiStore((state) => state.showToast)

  const livePatch = (patch: Partial<Overlay>): void => {
    if (!selected) return
    const store = useDocumentStore.getState()
    store.beginHistory()
    store.updateOverlay(selected.id, patch)
  }

  const discretePatch = (patch: Partial<Overlay>): void => {
    if (!selected) return
    const store = useDocumentStore.getState()
    store.beginHistory()
    store.updateOverlay(selected.id, patch)
    store.commitHistory()
  }

  const commit = (): void => useDocumentStore.getState().commitHistory()

  const handleImportFont = async (apply: (family: `custom:${string}`) => void): Promise<void> => {
    try {
      const imported = await importFont()
      if (imported) apply(`custom:${imported.id}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  return (
    <aside className="panel">
      <div className="panel__header">
        <span>{selected ? selectionTitle(selected) : 'Document'}</span>
      </div>

      {!selected && (
        <>
          <section className="panel__section">
            <div className="panel__section-title">Insert</div>
            <div className="panel__actions">
              <button className="btn" onClick={() => useDocumentStore.getState().setTool('text')}>
                Text box
              </button>
              <button className="btn" onClick={() => openDialog('signatures')}>
                Signature
              </button>
            </div>
            <div className="panel__actions">
              <button className="btn" onClick={() => openDialog('stamps')}>
                Stamp / icon
              </button>
              <button className="btn" onClick={() => void insertImageFromDisk()}>
                Image
              </button>
            </div>
            <p className="hint">
              Pick the <strong>Edit text</strong> tool (rail) to rewrite text that is already in the
              PDF, or drag a text box anywhere on the page.
            </p>
          </section>

          <section className="panel__section">
            <div className="panel__section-title">New text style</div>
            <FontControl
              family={textDefaults.fontFamily}
              fonts={fonts}
              onChange={(family) =>
                useDocumentStore.getState().updateTextDefaults({ fontFamily: family })
              }
              onImport={() =>
                void handleImportFont((family) =>
                  useDocumentStore.getState().updateTextDefaults({ fontFamily: family })
                )
              }
            />
            <Field label="Size" inline>
              <NumberInput
                value={textDefaults.fontSize}
                min={4}
                max={400}
                onChange={(fontSize) =>
                  useDocumentStore.getState().updateTextDefaults({ fontSize })
                }
                suffix="pt"
              />
              <div className="field__row" style={{ marginLeft: 'auto' }}>
                <IconToggle
                  title="Bold"
                  active={textDefaults.bold}
                  onClick={() =>
                    useDocumentStore.getState().updateTextDefaults({ bold: !textDefaults.bold })
                  }
                >
                  <BoldIcon size={16} />
                </IconToggle>
                <IconToggle
                  title="Italic"
                  active={textDefaults.italic}
                  onClick={() =>
                    useDocumentStore.getState().updateTextDefaults({ italic: !textDefaults.italic })
                  }
                >
                  <ItalicIcon size={16} />
                </IconToggle>
              </div>
            </Field>
            <Field label="Colour">
              <ColorField
                value={textDefaults.color}
                onChange={(color) => useDocumentStore.getState().updateTextDefaults({ color })}
              />
            </Field>
          </section>

          {page && (
            <section className="panel__section">
              <div className="panel__section-title">Page</div>
              <div className="panel__actions">
                <button
                  className="btn"
                  onClick={() => useDocumentStore.getState().rotatePage(page.id, 90)}
                >
                  <RotateCwIcon size={15} /> Rotate
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    useDocumentStore.getState().insertBlankPage(page.id)
                  }
                >
                  Blank page
                </button>
              </div>
              <div className="panel__actions">
                <button
                  className="btn"
                  onClick={() => useDocumentStore.getState().duplicatePage(page.id)}
                >
                  Duplicate
                </button>
                <button
                  className="btn btn--danger"
                  disabled={pageCount <= 1}
                  onClick={() => useDocumentStore.getState().deletePage(page.id)}
                >
                  Delete page
                </button>
              </div>
              <button className="btn btn--ghost" onClick={() => openDialog('settings')}>
                Document settings
              </button>
            </section>
          )}
        </>
      )}

      {selected && isText(selected) && (
        <>
          <section className="panel__section">
            <Field label="Text">
              <textarea
                className="textarea"
                value={selected.text}
                placeholder="Type here…"
                onChange={(event) => livePatch({ text: event.target.value } as Partial<Overlay>)}
                onFocus={() => useDocumentStore.getState().beginHistory()}
                onBlur={commit}
              />
            </Field>
            {selected.type === 'text-edit' && (
              <p className="hint">
                Replaces a run of text that was already in the document. The original run is covered
                with a colour patch sampled from the page.
              </p>
            )}
          </section>

          <section className="panel__section">
            <div className="panel__section-title">Font</div>
            <FontControl
              family={selected.fontFamily}
              fonts={fonts}
              onChange={(fontFamily) => discretePatch({ fontFamily } as Partial<Overlay>)}
              onImport={() =>
                void handleImportFont((family) =>
                  discretePatch({ fontFamily: family } as Partial<Overlay>)
                )
              }
            />
            <Field label="Size" inline>
              <NumberInput
                value={selected.fontSize}
                min={4}
                max={400}
                onFocus={() => useDocumentStore.getState().beginHistory()}
                onBlur={commit}
                onChange={(fontSize) => livePatch({ fontSize } as Partial<Overlay>)}
                suffix="pt"
              />
              <div className="field__row" style={{ marginLeft: 'auto' }}>
                <IconToggle
                  title="Bold"
                  active={selected.bold}
                  onClick={() => discretePatch({ bold: !selected.bold } as Partial<Overlay>)}
                >
                  <BoldIcon size={16} />
                </IconToggle>
                <IconToggle
                  title="Italic"
                  active={selected.italic}
                  onClick={() => discretePatch({ italic: !selected.italic } as Partial<Overlay>)}
                >
                  <ItalicIcon size={16} />
                </IconToggle>
                <IconToggle
                  title="Underline"
                  active={selected.underline}
                  onClick={() =>
                    discretePatch({ underline: !selected.underline } as Partial<Overlay>)
                  }
                >
                  <UnderlineIcon size={16} />
                </IconToggle>
                <IconToggle
                  title="Strikethrough"
                  active={selected.strike}
                  onClick={() => discretePatch({ strike: !selected.strike } as Partial<Overlay>)}
                >
                  <StrikeIcon size={16} />
                </IconToggle>
              </div>
            </Field>
            <Field label="Alignment">
              <Segmented
                value={selected.align}
                onChange={(align) => discretePatch({ align } as Partial<Overlay>)}
                options={[
                  { value: 'left', icon: <AlignLeftIcon size={15} />, title: 'Left' },
                  { value: 'center', icon: <AlignCenterIcon size={15} />, title: 'Centre' },
                  { value: 'right', icon: <AlignRightIcon size={15} />, title: 'Right' }
                ]}
              />
            </Field>
            <Field label="Line height" inline>
              <NumberInput
                value={selected.lineHeight}
                min={0.8}
                max={3}
                step={0.05}
                onFocus={() => useDocumentStore.getState().beginHistory()}
                onBlur={commit}
                onChange={(lineHeight) => livePatch({ lineHeight } as Partial<Overlay>)}
              />
              <span className="hint">×</span>
            </Field>
            {selected.fontFamily.startsWith('custom:') && (
              <p className="hint">
                Imported fonts are embedded as-is; use a font file that already contains the bold or
                italic weights you need.
              </p>
            )}
          </section>

          <section className="panel__section">
            <div className="panel__section-title">Colour</div>
            <Field label="Text">
              <ColorField
                value={selected.color}
                onChange={(color) => livePatch({ color } as Partial<Overlay>)}
                onCommit={commit}
              />
            </Field>
            <Switch
              label="Background fill"
              checked={Boolean(selected.bgColor)}
              onChange={(on) => discretePatch({ bgColor: on ? '#ffffff' : null } as Partial<Overlay>)}
            />
            {selected.bgColor && (
              <ColorField
                value={selected.bgColor}
                onChange={(bgColor) => livePatch({ bgColor } as Partial<Overlay>)}
                onCommit={commit}
              />
            )}
            <Switch
              label="Border"
              checked={Boolean(selected.borderColor)}
              onChange={(on) =>
                discretePatch({
                  borderColor: on ? '#94a3b4' : null,
                  borderWidth: on ? 1 : 0
                } as Partial<Overlay>)
              }
            />
            {selected.borderColor && (
              <div className="field__row">
                <ColorField
                  value={selected.borderColor}
                  onChange={(borderColor) => livePatch({ borderColor } as Partial<Overlay>)}
                  onCommit={commit}
                />
                <NumberInput
                  value={selected.borderWidth}
                  min={0.2}
                  max={20}
                  step={0.2}
                  onFocus={() => useDocumentStore.getState().beginHistory()}
                  onBlur={commit}
                  onChange={(borderWidth) => livePatch({ borderWidth } as Partial<Overlay>)}
                />
              </div>
            )}
          </section>
        </>
      )}

      {selected && selected.type === 'stamp' && (
        <section className="panel__section">
          <div className="panel__section-title">Stamp colour</div>
          <ColorField
            value={selected.color}
            onChange={(color) => livePatch({ color })}
            onCommit={commit}
          />
          <p className="hint">Stamps are rasterised at 3× on export so they stay sharp when printed.</p>
        </section>
      )}

      {selected && selected.type === 'shape' && (
        <section className="panel__section">
          <div className="panel__section-title">Shape</div>
          <Field label="Type">
            <SelectField
              value={selected.shape}
              onChange={(shape) => discretePatch({ shape: shape as ShapeKind })}
            >
              <option value="rect">Rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="line">Line</option>
              <option value="arrow">Arrow</option>
            </SelectField>
          </Field>
          <Field label="Stroke">
            <ColorField
              value={selected.stroke}
              onChange={(stroke) => livePatch({ stroke })}
              onCommit={commit}
            />
          </Field>
          <Field label="Width" inline>
            <NumberInput
              value={selected.strokeWidth}
              min={0.2}
              max={40}
              step={0.2}
              onFocus={() => useDocumentStore.getState().beginHistory()}
              onBlur={commit}
              onChange={(strokeWidth) => livePatch({ strokeWidth })}
            />
          </Field>
          <Switch
            label="Fill"
            checked={Boolean(selected.fill)}
            onChange={(on) => discretePatch({ fill: on ? '#fde68a' : null })}
          />
          {selected.fill && (
            <ColorField
              value={selected.fill}
              onChange={(fill) => livePatch({ fill })}
              onCommit={commit}
            />
          )}
        </section>
      )}

      {selected && (
        <>
          <section className="panel__section">
            <div className="panel__section-title">Layout</div>
            <div className="field__row">
              <Field label="X" inline>
                <NumberInput
                  value={selected.x}
                  step={1}
                  onFocus={() => useDocumentStore.getState().beginHistory()}
                  onBlur={commit}
                  onChange={(x) => livePatch({ x })}
                />
              </Field>
              <Field label="Y" inline>
                <NumberInput
                  value={selected.y}
                  step={1}
                  onFocus={() => useDocumentStore.getState().beginHistory()}
                  onBlur={commit}
                  onChange={(y) => livePatch({ y })}
                />
              </Field>
            </div>
            <div className="field__row">
              <Field label="Width" inline>
                <NumberInput
                  value={selected.w}
                  min={6}
                  step={1}
                  onFocus={() => useDocumentStore.getState().beginHistory()}
                  onBlur={commit}
                  onChange={(w) => livePatch({ w })}
                />
              </Field>
              <Field label="Rotation" inline>
                <NumberInput
                  value={selected.rotation}
                  step={1}
                  onFocus={() => useDocumentStore.getState().beginHistory()}
                  onBlur={commit}
                  onChange={(rotation) => livePatch({ rotation })}
                />
              </Field>
            </div>
            <Field label="Opacity" inline>
              <RangeInput
                value={selected.opacity}
                min={0.05}
                max={1}
                step={0.01}
                onChange={(opacity) => livePatch({ opacity })}
                onCommit={commit}
              />
            </Field>
          </section>

          <section className="panel__section">
            <div className="panel__section-title">Arrange</div>
            <div className="panel__actions">
              <button
                className="btn"
                onClick={() => useDocumentStore.getState().bringForward(selected.id)}
              >
                <BringForwardIcon size={15} /> Forward
              </button>
              <button
                className="btn"
                onClick={() => useDocumentStore.getState().sendBackward(selected.id)}
              >
                <SendBackwardIcon size={15} /> Back
              </button>
            </div>
            <div className="panel__actions">
              <button
                className="btn"
                onClick={() => discretePatch({ locked: !selected.locked })}
                title={selected.locked ? 'Unlock' : 'Lock'}
              >
                {selected.locked ? <UnlockIcon size={15} /> : <LockIcon size={15} />}
                {selected.locked ? 'Unlock' : 'Lock'}
              </button>
              <button
                className="btn"
                onClick={() => useDocumentStore.getState().duplicateSelected()}
              >
                <CopyIcon size={15} /> Duplicate
              </button>
            </div>
            <button
              className="btn btn--danger"
              style={{ justifyContent: 'center' }}
              onClick={() => useDocumentStore.getState().deleteSelected()}
            >
              <TrashIcon size={15} /> Delete
            </button>
          </section>
        </>
      )}
    </aside>
  )
}

function selectionTitle(overlay: Overlay): string {
  switch (overlay.type) {
    case 'text':
      return 'Text box'
    case 'text-edit':
      return 'Edited text'
    case 'signature':
      return 'Signature'
    case 'image':
      return 'Image'
    case 'stamp':
      return 'Stamp'
    case 'shape':
      return 'Shape'
    default:
      return 'Selection'
  }
}

function FontControl({
  family,
  fonts,
  onChange,
  onImport
}: {
  family: string
  fonts: Array<{ id: string; family: string }>
  onChange: (family: `custom:${string}` | 'Helvetica' | 'Times' | 'Courier') => void
  onImport: () => void
}) {
  return (
    <Field label="Font family">
      <div className="field__row">
        <select
          className="select"
          value={family}
          onChange={(event) => {
            const value = event.target.value
            if (value === '__import') {
              onImport()
              return
            }
            onChange(value as 'Helvetica' | 'Times' | 'Courier' | `custom:${string}`)
          }}
        >
          <option value="Helvetica">Helvetica (sans)</option>
          <option value="Times">Times (serif)</option>
          <option value="Courier">Courier (mono)</option>
          {fonts.length > 0 && (
            <optgroup label="Imported">
              {fonts.map((font) => (
                <option key={font.id} value={`custom:${font.id}`}>
                  {font.family}
                </option>
              ))}
            </optgroup>
          )}
          <option value="__import">Import font…</option>
        </select>
      </div>
    </Field>
  )
}
