import { useUiStore } from '@/state/uiStore'

export function Toast() {
  const toast = useUiStore((state) => state.toast)
  const dismiss = useUiStore((state) => state.dismissToast)
  if (!toast) return null
  return (
    <div
      className={`toast${toast.tone === 'error' ? ' toast--error' : toast.tone === 'success' ? ' toast--success' : ''}`}
      role="status"
      onClick={() => dismiss(toast.id)}
    >
      {toast.message}
    </div>
  )
}
