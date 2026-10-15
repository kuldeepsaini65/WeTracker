import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import type { CategoryBrief } from '../lib/api'

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'danger' }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'bg-violet-600 text-white shadow-sm shadow-violet-600/30 hover:bg-violet-500',
        variant === 'soft' && 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
        variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-500',
        className,
      )}
    />
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15 dark:border-zinc-700 dark:bg-zinc-900',
        className,
      )}
    />
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-400">{hint}</span>}
    </label>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx('rounded-3xl border border-zinc-200/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60', className)}>
      {children}
    </div>
  )
}

export function CategoryIcon({ category, size = 'md' }: { category: CategoryBrief | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={clsx(
        'inline-grid shrink-0 place-items-center rounded-xl',
        size === 'sm' && 'size-7 text-sm',
        size === 'md' && 'size-10 text-lg',
        size === 'lg' && 'size-12 text-xl',
        !category && 'border border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-600',
      )}
      style={category ? { backgroundColor: `${category.color}22` } : undefined}
    >
      {category ? category.icon : '?'}
    </span>
  )
}

export function Chip({
  active,
  color,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; color?: string }) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition active:scale-95',
        active
          ? 'border-transparent text-white shadow-sm'
          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800',
        className,
      )}
      style={active ? { backgroundColor: color ?? '#7c3aed' } : undefined}
    >
      {children}
    </button>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose(): void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:p-4 sm:pt-[12vh]">
      <div className="fade-in absolute inset-0 bg-zinc-950/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'sheet-in relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-5 dark:bg-zinc-900',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-zinc-100 text-2xl dark:bg-zinc-800">{icon}</div>
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-zinc-500">{children}</div>}
    </div>
  )
}

/** Shown instead of zeros when data failed to load, so a failure never looks like "you spent ₹0". */
export function LoadError({ error, onRetry, what = 'your numbers' }: { error: unknown; onRetry(): void; what?: string }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm dark:border-rose-500/30 dark:bg-rose-500/10">
      <span className="flex-1 text-rose-800 dark:text-rose-200">
        Couldn't load {what}.{' '}
        <span className="text-rose-600/80 dark:text-rose-300/80">{error instanceof Error ? error.message : ''}</span>
      </span>
      <Button variant="soft" className="px-3 py-1.5" onClick={onRetry}>Try again</Button>
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />
}
