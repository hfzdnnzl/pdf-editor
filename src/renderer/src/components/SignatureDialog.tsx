import { useEffect, useRef, useState } from 'react'
import type { StoredSignature } from '@shared/types'
import { desk } from '@/platform'
import {
  SIGNATURE_FONTS,
  cleanScannedSignature,
  renderTypedSignature
} from '@/overlays/signatureUtils'
import { useDocumentStore } from '@/state/documentStore'
import { useUiStore } from '@/state/uiStore'
import { Modal } from './Modal'
import { SignaturePad, type SignaturePadHandle } from './SignaturePad'
import { ColorField, Field, NumberInput, Segmented, SelectField } from './Controls'
import { TrashIcon, UploadIcon } from './Icons'

type Mode = 'draw' | 'type' | 'upload'

export function SignatureDialog() {
  const close = useUiStore((state) => state.closeDialog)
  const showToast = useUiStore((state) => state.showToast)
  const setPendingSignature = useDocumentStore((state) => state.setPendingSignature)

  const padRef = useRef<SignaturePadHandle>(null)
  const [mode, setMode] = useState<Mode>('draw')
  const [inkColor, setInkColor] = useState('#101820')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [hasInk, setHasInk] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [typedFont, setTypedFont] = useState(SIGNATURE_FONTS[0].id)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [signatures, setSignatures] = useState<StoredSignature[]>([])

  useEffect(() => {
    desk
      .listSignatures()
      .then(setSignatures)
      .catch(() => undefined)
  }, [])

  const preview = async (): Promise<string | null> => {
    if (mode === 'draw') return padRef.current?.toPng() ?? null
    if (mode === 'upload') return uploaded
    if (!typedName.trim()) return null
    return renderTypedSignature(typedName.trim(), typedFont, inkColor)
  }

  const insert = async () => {
    setBusy(true)
    try {
      const png = await preview()
      if (!png) {
        showToast(
          mode === 'draw'
            ? 'Draw a signature first'
            : mode === 'upload'
              ? 'Choose an image first'
              : 'Type a name first',
          'error'
        )
        return
      }
      const name = label.trim() || typedName.trim() || `Signature ${signatures.length + 1}`
      const list = await desk.addSignature({ name, png })
      setSignatures(list)
      const created = list[0]
      setPendingSignature({ id: created.id, png, label: created.name })
      showToast('Click on the page to place your signature', 'success')
      close()
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const upload = async () => {
    try {
      const image = await desk.pickImage()
      if (!image) return
      const cleaned = await cleanScannedSignature(image.dataUrl)
      setUploaded(cleaned)
      if (!label) setLabel(image.name.replace(/\.[a-z0-9]+$/i, ''))
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  const insertStored = (signature: StoredSignature) => {
    setPendingSignature({ id: signature.id, png: signature.png, label: signature.name })
    showToast('Click on the page to place your signature', 'success')
    close()
  }

  const removeStored = async (signature: StoredSignature) => {
    if (!window.confirm(`Remove “${signature.name}” from your signature library?`)) return
    const list = await desk.deleteSignature(signature.id)
    setSignatures(list)
  }

  const renameStored = async (signature: StoredSignature) => {
    const name = window.prompt('Signature name', signature.name)
    if (!name) return
    setSignatures(await desk.renameSignature(signature.id, name))
  }

  return (
    <Modal
      title="Signatures"
      wide
      onClose={close}
      footer={
        <>
          {mode === 'draw' && (
            <>
              <button className="btn btn--ghost" onClick={() => padRef.current?.undo()}>
                Undo stroke
              </button>
              <button className="btn btn--ghost" onClick={() => padRef.current?.clear()}>
                Clear
              </button>
            </>
          )}
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={() => void insert()} disabled={busy}>
            Save &amp; place
          </button>
        </>
      }
    >
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'draw', label: 'Draw' },
          { value: 'type', label: 'Type' },
          { value: 'upload', label: 'Upload' }
        ]}
      />

      {mode === 'draw' && (
        <>
          <SignaturePad
            ref={padRef}
            color={inkColor}
            strokeWidth={strokeWidth}
            onChange={setHasInk}
          />
          <div className="field__row">
            <Field label="Ink" inline>
              <ColorField value={inkColor} onChange={setInkColor} />
            </Field>
            <Field label="Thickness" inline>
              <NumberInput value={strokeWidth} min={1} max={8} step={0.5} onChange={setStrokeWidth} />
            </Field>
            <span className="hint" style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
              {hasInk ? 'Ready to save' : 'Empty'}
            </span>
          </div>
        </>
      )}

      {mode === 'type' && (
        <>
          <Field label="Name">
            <input
              className="input"
              value={typedName}
              placeholder="e.g. Alex Morgan"
              onChange={(event) => setTypedName(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Script style">
            <SelectField value={typedFont} onChange={setTypedFont}>
              {SIGNATURE_FONTS.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Ink">
            <ColorField value={inkColor} onChange={setInkColor} />
          </Field>
          <div
            style={{
              minHeight: 96,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              borderRadius: 10,
              padding: '8px 16px'
            }}
          >
            <span
              style={{
                fontFamily: SIGNATURE_FONTS.find((f) => f.id === typedFont)?.css,
                fontSize: 46,
                color: inkColor,
                lineHeight: 1.2
              }}
            >
              {typedName || 'Your signature'}
            </span>
          </div>
        </>
      )}

      {mode === 'upload' && (
        <>
          <button className="btn" onClick={() => void upload()} style={{ justifyContent: 'center' }}>
            <UploadIcon size={15} /> Choose a scanned signature image
          </button>
          <p className="hint">
            Light backgrounds are made transparent and the image is trimmed automatically. A clean
            scan on plain white paper works best.
          </p>
          {uploaded && (
            <div
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: 10,
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <img src={uploaded} alt="Signature preview" style={{ maxHeight: 120 }} />
            </div>
          )}
        </>
      )}

      <Field label="Library name (optional)">
        <input
          className="input"
          value={label}
          placeholder="e.g. Initials"
          onChange={(event) => setLabel(event.target.value)}
        />
      </Field>

      <div className="panel__section-title" style={{ marginTop: 4 }}>
        Saved signatures
      </div>
      {signatures.length === 0 ? (
        <p className="hint">Nothing saved yet. Signatures you save here are reused across documents.</p>
      ) : (
        <div className="sig-list">
          {signatures.map((signature) => (
            <div key={signature.id} className="sig-card">
              <button
                className="sig-card__preview"
                onClick={() => insertStored(signature)}
                title="Place this signature"
              >
                <img src={signature.png} alt={signature.name} />
              </button>
              <button
                className="sig-card__name"
                onClick={() => void renameStored(signature)}
                title="Rename"
              >
                {signature.name}
              </button>
              <button
                className="sig-card__remove"
                title="Delete"
                onClick={(event) => {
                  event.stopPropagation()
                  void removeStored(signature)
                }}
              >
                <TrashIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
