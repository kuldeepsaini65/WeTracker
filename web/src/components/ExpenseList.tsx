import clsx from 'clsx'
import { useMemo, useState } from 'react'
import type { Expense, TeamExpense } from '../lib/api'
import { useCurrency } from '../lib/auth'
import { money, relativeDay, timeOf } from '../lib/format'
import { ExpenseFormModal } from './ExpenseForm'
import { CategoryIcon } from './ui'

export function ExpenseList({ expenses, selectable, selected, onToggle, readOnly }: {
  expenses: (Expense | TeamExpense)[]
  /** Team view: rows show who spent it and can't be edited. */
  readOnly?: boolean
  selectable?: boolean
  selected?: Set<number>
  onToggle?(id: number): void
}) {
  const currency = useCurrency()
  const [editing, setEditing] = useState<Expense | null>(null)

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; items: (Expense | TeamExpense)[] }>()
    for (const e of expenses) {
      const key = new Date(e.spent_at).toDateString()
      let g = map.get(key)
      if (!g) map.set(key, (g = { label: relativeDay(e.spent_at), total: 0, items: [] }))
      g.total += Number(e.amount)
      g.items.push(e)
    }
    return [...map.values()]
  }, [expenses])

  return (
    <>
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.label}>
            <div className="mb-1.5 flex items-baseline justify-between px-2 text-xs font-medium text-zinc-500">
              <span className="tracking-wide uppercase">{g.label}</span>
              <span className="tabular-nums">{money(g.total, currency)}</span>
            </div>
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60">
              {g.items.map((e) => {
                const isSel = selected?.has(e.id)
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => (selectable ? onToggle?.(e.id) : readOnly ? undefined : setEditing(e))}
                      className={clsx(
                        'flex w-full items-center gap-3 px-3 py-3 text-left transition',
                        readOnly ? 'cursor-default' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
                        isSel && 'bg-violet-50 dark:bg-violet-500/10',
                      )}
                    >
                      {selectable && (
                        <span
                          className={clsx(
                            'grid size-5 shrink-0 place-items-center rounded-md border-2 text-[10px] text-white',
                            isSel ? 'border-violet-600 bg-violet-600' : 'border-zinc-300 dark:border-zinc-600',
                          )}
                        >
                          {isSel && '✓'}
                        </span>
                      )}
                      <CategoryIcon category={e.category_detail} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.note || <span className="text-zinc-400">No note</span>}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {'member' in e && <span className="font-medium text-zinc-700 dark:text-zinc-300">{e.member.name} · </span>}
                          {e.category_detail?.name ?? <span className="text-amber-600 dark:text-amber-400">Uncategorized</span>} · {timeOf(e.spent_at)}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">{money(e.amount, currency)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <ExpenseFormModal open={!!editing} expense={editing} onClose={() => setEditing(null)} />
    </>
  )
}
