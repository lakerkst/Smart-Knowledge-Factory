import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '~/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

// ── Global toast dispatcher ────────────────────────────────────────────────
// Call toast.success('…') / toast.error('…') / toast('…') from anywhere.
function dispatch(message: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<Toast>('app:toast', {
      detail: { id: crypto.randomUUID(), message, type },
    })
  )
}

export const toast = Object.assign(
  (message: string) => dispatch(message, 'info'),
  {
    success: (message: string) => dispatch(message, 'success'),
    error: (message: string) => dispatch(message, 'error'),
  }
)

// ── Toaster component ──────────────────────────────────────────────────────
// Mount this once in __root.tsx; it renders a fixed portal in the top-right.
const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const STYLES: Record<ToastType, string> = {
  success: 'border-success/20 bg-white text-success',
  error: 'border-danger/20 bg-white text-danger',
  info: 'border-border bg-white text-text',
}

const ICON_STYLES: Record<ToastType, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-primary',
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const toast = (e as CustomEvent<Toast>).detail
      setToasts((prev) => [...prev, toast])
      setTimeout(() => remove(toast.id), 4000)
    }
    window.addEventListener('app:toast', handler)
    return () => window.removeEventListener('app:toast', handler)
  }, [remove])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.type]
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-3 shadow-card-hover',
              'min-w-[260px] max-w-[380px] pointer-events-auto animate-fade-in',
              STYLES[t.type]
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', ICON_STYLES[t.type])} />
            <p className="flex-1 text-sm font-medium text-text">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="shrink-0 rounded p-0.5 hover:bg-surface-dim transition-colors"
            >
              <X className="h-3.5 w-3.5 text-text-muted" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
