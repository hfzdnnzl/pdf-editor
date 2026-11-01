import { useState } from 'react'
import type { ShapeKind } from '@shared/types'
import { insertImageFromDisk } from '@/state/fileActions'
import { useDocumentStore, type Tool } from '@/state/documentStore'
import { useUiStore } from '@/state/uiStore'
import {
  CursorIcon,
  EditTextIcon,
  ImageIcon,
  PenIcon,
  ShapeIcon,
  StampIcon,
  TextIcon
} from './Icons'

const SHAPES: Array<{ kind: ShapeKind; label: string }> = [
  { kind: 'rect', label: 'Rectangle' },
  { kind: 'ellipse', label: 'Ellipse' },
  { kind: 'line', label: 'Line' },
  { kind: 'arrow', label: 'Arrow' }
]

export function ToolRail() {
  const tool = useDocumentStore((state) => state.tool)
  const shapeKind = useDocumentStore((state) => state.shapeKind)
  const setTool = useDocumentStore((state) => state.setTool)
  const setShapeKind = useDocumentStore((state) => state.setShapeKind)
  const openDialog = useUiStore((state) => state.openDialog)
  const [shapesOpen, setShapesOpen] = useState(false)

  const button = (id: Tool, label: string, icon: React.ReactNode, onClick?: () => void) => (
    <button
      className={`rail__btn${tool === id ? ' is-active' : ''}`}
      title={label}
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick ?? (() => setTool(id))}
    >
      {icon}
    </button>
  )

  return (
    <nav className="rail" onPointerDown={(event) => event.stopPropagation()}>
      {button('select', 'Select (V)', <CursorIcon />)}
      {button('text', 'Text box (T)', <TextIcon />)}
      {button('edit-text', 'Edit existing text (X)', <EditTextIcon />)}

      <div style={{ position: 'relative' }}>
        <button
          className={`rail__btn${tool === 'shape' ? ' is-active' : ''}`}
          title="Shapes"
          onClick={() => setShapesOpen((open) => !open)}
        >
          <ShapeIcon />
        </button>
        {shapesOpen && (
          <div
            style={{
              position: 'absolute',
              left: 44,
              top: 0,
              zIndex: 30,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 9,
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              width: 130,
              boxShadow: '0 10px 24px rgba(0,0,0,0.3)'
            }}
          >
            {SHAPES.map((shape) => (
              <button
                key={shape.kind}
                className="recent-item"
                onClick={() => {
                  setShapeKind(shape.kind)
                  setShapesOpen(false)
                }}
              >
                {shape.label}
                {shapeKind === shape.kind && ' ✓'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rail__divider" />
      <button
        className={`rail__btn${tool === 'signature' ? ' is-active' : ''}`}
        title="Signature (S)"
        onClick={() => openDialog('signatures')}
      >
        <PenIcon />
      </button>
      <button
        className={`rail__btn${tool === 'stamp' ? ' is-active' : ''}`}
        title="Stamp / icon (I)"
        onClick={() => openDialog('stamps')}
      >
        <StampIcon />
      </button>
      <button className="rail__btn" title="Image" onClick={() => void insertImageFromDisk()}>
        <ImageIcon />
      </button>
      <div className="rail__spacer" />
    </nav>
  )
}
