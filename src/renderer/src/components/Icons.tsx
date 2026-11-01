import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const base = ({ size = 18, ...props }: IconProps) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props
})

export const CursorIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 3l7.5 17 2.3-6.6 6.7-2.3z" />
  </svg>
)

export const TextIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 6V4h16v2M12 4v16M9 20h6" />
  </svg>
)

export const EditTextIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 6V4h9M12 4v9M8 13h5M15 20l5-5-2-2-5 5v2h2z" />
  </svg>
)

export const PenIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3 21c2-1 3-3 4-6 1.4-4.2 3.7-8 7-9.5 1.9-.9 4 .4 4 2.4 0 3.6-5 7.4-8.5 9.5" />
    <path d="M14.5 6.5l3 3" />
  </svg>
)

export const StampIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.3l5-.7z" />
  </svg>
)

export const ImageIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M4 17l4.5-4.5L12 16l2.5-2.5L20 19" />
  </svg>
)

export const ShapeIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3.5" y="8.5" width="10" height="10" rx="1.5" />
    <circle cx="16.5" cy="7.5" r="4" />
  </svg>
)

export const UndoIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h8.5A6.5 6.5 0 0120 15.5v.5" />
  </svg>
)

export const RedoIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9h-8.5A6.5 6.5 0 004 15.5v.5" />
  </svg>
)

export const ZoomInIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5M11 8.5v5M8.5 11h5" />
  </svg>
)

export const ZoomOutIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5M8.5 11h5" />
  </svg>
)

export const ChevronLeftIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M14 5l-7 7 7 7" />
  </svg>
)

export const ChevronRightIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M10 5l7 7-7 7" />
  </svg>
)

export const ChevronDownIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export const SidebarIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </svg>
)

export const PanelRightIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M15 4v16" />
  </svg>
)

export const TrashIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
)

export const CopyIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
  </svg>
)

export const LockIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 018 0v3" />
  </svg>
)

export const UnlockIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 017.5-1.8" />
  </svg>
)

export const SaveIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 4v6h7V4M8 20v-5h8v5" />
  </svg>
)

export const FolderIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
)

export const DownloadIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
  </svg>
)

export const RotateCwIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20 11a8 8 0 10-3 6.2" />
    <path d="M20 4v7h-7" />
  </svg>
)

export const RotateCcwIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 11a8 8 0 113 6.2" />
    <path d="M4 4v7h7" />
  </svg>
)

export const PlusIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const MinusIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M5 12h14" />
  </svg>
)

export const SunIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
  </svg>
)

export const MoonIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M20 14.5A8.5 8.5 0 019.5 4a7 7 0 1010.5 10.5z" />
  </svg>
)

export const CloseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const CheckIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
)

export const AlertIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17.2v.1" />
  </svg>
)

export const FilePdfIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v5h4" />
    <path d="M9 17v-4h1.4a1.3 1.3 0 010 2.6H9M14 17v-4h1.2a2 2 0 010 4z" />
  </svg>
)

export const LayersIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
)

export const BoldIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M7 5h6a4 4 0 010 8H7zM7 13h7a4 4 0 010 8H7z" />
  </svg>
)

export const ItalicIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M10 5h8M6 19h8M14 5l-4 14" />
  </svg>
)

export const UnderlineIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M7 4v7a5 5 0 0010 0V4M5 20h14" />
  </svg>
)

export const StrikeIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M7 4h7a4 4 0 010 8M5 12h14M9 20h6" />
  </svg>
)

export const AlignLeftIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 6h16M4 12h10M4 18h13" />
  </svg>
)

export const AlignCenterIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 6h16M7 12h10M6 18h12" />
  </svg>
)

export const AlignRightIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4 6h16M10 12h10M7 18h13" />
  </svg>
)

export const BringForwardIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="4" y="4" width="10" height="10" rx="1.5" />
    <path d="M10 20h10V10" />
  </svg>
)

export const SendBackwardIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="10" y="10" width="10" height="10" rx="1.5" />
    <path d="M14 4H4v10" />
  </svg>
)

export const KeyboardIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M9.5 13.5h.01M13 13.5h.01M16.5 13.5h.01M8 16.5h8" />
  </svg>
)

export const InfoIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.1" />
  </svg>
)

export const UploadIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 16V6M8 9l4-4 4 4M5 19h14" />
  </svg>
)

export const EraserIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M8 20H4l9-9 5 5-4 4z" />
    <path d="M13 11l4-4a2 2 0 013 0l1 1a2 2 0 010 3l-4 4" />
  </svg>
)

export const GridIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </svg>
)
