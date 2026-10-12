import clsx from 'clsx'
import { CornerDownLeft, Sparkles, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Expense } from '../lib/api'
import { useCurrency } from '../lib/auth'
import { money, uid } from '../lib/format'
import { useCategories, useCreateExpense, useDeleteExpense, useFrequent, useQuickAdd, useQuickPreview } from '../lib/queries'
import { useToast } from './Toast'
import { Chip, Spinner } from './ui'

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

const EXAMPLES = ['250 coffee', 'uber 180', '1.2k groceries', '99 netflix #entertainment', '40 chai yesterday']

/**
 * One-line expense entry. Type "250 coffee" and press Enter — amount, note and category are
 * worked out by the server. Category chips override the guess; frequent chips add with one tap.
 */
export function QuickAdd({ autoFocus, onAdded, compact }: { autoFocus?: boolean; onAdded?: () => void; compact?: boolean }) {
  const currency = useCurrency()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [override, setOverride] = useState<number | null>(null)
  const debounced = useDebounced(text, 180)
  const preview = useQuickPreview(debounced)
  const { data: categories = [] } = useCategories()
  const { data: frequent = [] } = useFrequent()
  const quick = useQuickAdd()
  const create = useCreateExpense()
  const del = useDeleteExpense()
  const [placeholder] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const p = text.trim() ? preview.data : undefined
  const overrideCat = categories.find((c) => c.id === override)
  const shownCategory = overrideCat ?? p?.category ?? null
  const hasAmount = !!p?.amount && Number(p.amount) > 0

  const added = (e: Expense) => {
    toast({
      tone: 'success',
      message: (
        <span>
          Added <b>{money(e.amount, currency)}</b>
          {e.note && <> · {e.note}</>}
          <span className="text-zinc-400"> → {e.category_detail ? `${e.category_detail.icon} ${e.category_detail.name}` : 'Uncategorized'}</span>
        </span>
      ),
      action: { label: 'Undo', onClick: () => del.mutate(e.id) },
    })
    onAdded?.()
  }

  const submit = () => {
    const t = text.trim()
    if (!t) return
    const tag = overrideCat ? ` #${overrideCat.name.replace(/\s+/g, '')}` : ''
    // Clear immediately so the next expense can be typed while this one saves.
    setText('')
    setOverride(null)
    quick.mutate(
      { text: t + tag, client_id: uid() },
      {
        onSuccess: added,
        onError: (err) => {
          setText(t)
          toast({ tone: 'error', message: err.message })
          inputRef.current?.focus()
        },
      },
    )
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className={clsx(
          'group flex items-center gap-2 rounded-2xl border-2 bg-white pl-4 transition dark:bg-zinc-900',
          'border-zinc-200 focus-within:border-violet-500 focus-within:shadow-[0_0_0_6px] focus-within:shadow-violet-500/10 dark:border-zinc-700',
        )}
      >
        <Zap className="size-5 shrink-0 text-violet-500" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Try "${placeholder}"`}
          enterKeyHint="done"
          autoComplete="off"
          aria-label="Quick add expense"
          className={clsx('min-w-0 flex-1 bg-transparent py-4 outline-none placeholder:text-zinc-400', compact ? 'text-base' : 'text-lg')}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="m-1.5 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800"
        >
          {quick.isPending ? <Spinner /> : <CornerDownLeft className="size-4" />}
          Add
        </button>
      </form>

      {/* Live preview of what will be saved */}
      <div className="flex min-h-7 flex-wrap items-center gap-2 px-1 text-sm">
        {text.trim() ? (
          <>
            <span className={clsx('font-semibold tabular-nums', hasAmount ? 'text-zinc-900 dark:text-white' : 'text-rose-500')}>
              {hasAmount ? money(p!.amount!, currency) : 'Add an amount'}
            </span>
            {p?.note && <span className="text-zinc-500">· {p.note}</span>}
            <span className="text-zinc-400">→</span>
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: shownCategory?.color }}>
              {shownCategory ? (
                <>
                  {shownCategory.icon} {shownCategory.name}
                  {!overrideCat && <Sparkles className="size-3.5 opacity-70" aria-label="auto-detected" />}
                </>
              ) : (
                <span className="text-zinc-400">Uncategorized — tap a category or just save</span>
              )}
            </span>
            {p?.days_ago ? <span className="rounded-md bg-amber-100 px-1.5 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">yesterday</span> : null}
          </>
        ) : (
          <span className="text-zinc-400">
            Amount + note, anywhere in the line. <kbd className="kbd">#tag</kbd> picks a category, <kbd className="kbd">yesterday</kbd> backdates.
          </span>
        )}
      </div>

      {/* Category override chips — shown while typing */}
      {text.trim() && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={override === c.id || (!override && p?.category?.id === c.id)}
              color={c.color}
              onClick={() => {
                setOverride(override === c.id ? null : c.id)
                inputRef.current?.focus()
              }}
            >
              <span>{c.icon}</span>
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      {/* One-tap repeats */}
      {!text.trim() && frequent.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium tracking-wide text-zinc-400 uppercase">One-tap repeat</p>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {frequent.map((f) => (
              <Chip
                key={`${f.note}-${f.amount}-${f.category?.id}`}
                disabled={create.isPending}
                onClick={() =>
                  create.mutate(
                    { amount: f.amount, note: f.note, category: f.category?.id ?? null, client_id: uid() },
                    { onSuccess: added, onError: (err) => toast({ tone: 'error', message: err.message }) },
                  )
                }
              >
                <span>{f.category?.icon ?? '•'}</span>
                {f.note}
                <span className="text-zinc-400 tabular-nums">{money(f.amount, currency)}</span>
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
