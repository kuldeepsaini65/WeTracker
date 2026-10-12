import { CheckCircle2, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  message: ReactNode
  tone: 'success' | 'error'
  action?: { label: string; onClick: () => void }
}

type Show = (t: Omit<Toast, 'id'>, ms?: number) => void
const Ctx = createContext<Show>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const show = useCallback<Show>(
    (t, ms = 4500) => {
      const id = nextId.current++
      // Only the latest toast is shown so rapid entries never pile up over the input.
      setToasts([{ ...t, id }])
      setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] md:top-auto flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-2xl ring-1 ring-white/10 dark:bg-zinc-800"
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="size-5 shrink-0 text-rose-400" />
            )}
            <div className="min-w-0 flex-1">{t.message}</div>
            {t.action && (
              <button
                className="shrink-0 rounded-lg px-2 py-1 font-semibold text-violet-300 hover:bg-white/10"
                onClick={() => {
                  t.action!.onClick()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
