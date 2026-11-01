import { useState } from 'react'
import { LABEL_STAMPS, STAMPS, type StampDefinition } from '@/overlays/stamps'
import { useDocumentStore } from '@/state/documentStore'
import { useUiStore } from '@/state/uiStore'
import { Modal } from './Modal'
import { ColorField, Field } from './Controls'

function StampPreview({ stamp, color }: { stamp: StampDefinition; color: string }) {
  return (
    <svg
      viewBox={`0 0 ${stamp.viewBox.w} ${stamp.viewBox.h}`}
      preserveAspectRatio="xMidYMid meet"
      dangerouslySetInnerHTML={{ __html: stamp.body(color) }}
    />
  )
}

export function StampPicker() {
  const close = useUiStore((state) => state.closeDialog)
  const setPendingStamp = useDocumentStore((state) => state.setPendingStamp)
  const [color, setColor] = useState('#c92a2a')

  const choose = (stamp: StampDefinition) => {
    setPendingStamp(stamp.id)
    close()
  }

  return (
    <Modal
      title="Stamps & icons"
      wide
      onClose={close}
      footer={
        <button className="btn" onClick={close}>
          Cancel
        </button>
      }
    >
      <Field label="Stamp colour">
        <ColorField value={color} onChange={setColor} />
      </Field>

      <div className="panel__section-title">Icons</div>
      <div className="stamp-grid">
        {STAMPS.map((stamp) => (
          <button key={stamp.id} className="stamp-cell" onClick={() => choose(stamp)} title={stamp.label}>
            <StampPreview stamp={stamp} color={color} />
            <span>{stamp.label}</span>
          </button>
        ))}
      </div>

      <div className="panel__section-title">Label stamps</div>
      <div className="stamp-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {LABEL_STAMPS.map((stamp) => (
          <button
            key={stamp.id}
            className="stamp-cell stamp-cell--label"
            onClick={() => choose(stamp)}
          >
            <StampPreview stamp={stamp} color={color} />
            <span>{stamp.label}</span>
          </button>
        ))}
      </div>

      <p className="hint">Pick a stamp, then click on the page to place it.</p>
    </Modal>
  )
}
