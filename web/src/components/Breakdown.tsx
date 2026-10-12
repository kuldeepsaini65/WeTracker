import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { money, type Period } from '../lib/format'

export function PeriodPicker({ period, label, offset, onPeriod, onOffset }: {
  period: Period
  label: string
  offset: number
  onPeriod(p: Period): void
  onOffset(o: number): void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {(['week', 'month', 'year'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              onPeriod(p)
              onOffset(0)
            }}
            className={clsx(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium capitalize transition',
              period === p ? 'bg-white shadow-sm dark:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onOffset(offset - 1)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Previous period">
          <ChevronLeft className="size-5" />
        </button>
        <span className="min-w-36 text-center text-sm font-medium">{label}</span>
        <button
          onClick={() => onOffset(Math.min(offset + 1, 0))}
          disabled={offset === 0}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
          aria-label="Next period"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  )
}

export interface BreakdownRow {
  key: string | number
  label: string
  icon: ReactNode
  total: string | number
}

/** Ranked, direct-labelled bars in a single hue — identity comes from the label, not the colour. */
export function Breakdown({ rows, total, currency, selected, onSelect }: {
  rows: BreakdownRow[]
  total: number
  currency: string
  selected?: string | number | null
  onSelect?(key: string | number): void
}) {
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const pct = total > 0 ? (Number(r.total) / total) * 100 : 0
        const body = (
          <>
            {r.icon}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{r.label}</span>
                <span className="font-semibold tabular-nums">{money(r.total, currency)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-violet-600 dark:bg-violet-400" style={{ width: `${Math.max(pct, 1.5)}%` }} />
                </div>
                <span className="w-9 text-right text-xs text-zinc-500 tabular-nums">{pct.toFixed(0)}%</span>
              </div>
            </div>
          </>
        )
        return (
          <li key={r.key}>
            {onSelect ? (
              <button
                onClick={() => onSelect(r.key)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
                  selected === r.key && 'bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:ring-violet-500/30',
                )}
              >
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-2 py-2">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  // Neutral initials badge — people are identified by name, not colour.
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span
      className={clsx(
        'inline-grid shrink-0 place-items-center rounded-full bg-zinc-200 font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100',
        size === 'sm' ? 'size-7 text-[11px]' : 'size-10 text-sm',
      )}
    >
      {initials || '?'}
    </span>
  )
}
