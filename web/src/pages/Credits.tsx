import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditForm, CreditFormModal } from '../components/CreditForm'
import { MoneyTabs } from '../components/MoneyTabs'
import { Button, Card, Empty, Input, LoadError } from '../components/ui'
import type { Credit } from '../lib/api'
import { useAuth, useCurrency } from '../lib/auth'
import { creditSource } from '../lib/credits'
import { money, periodRange, relativeDay, timeOf } from '../lib/format'
import { useCredits } from '../lib/queries'

export function CreditsPage() {
  const { user } = useAuth()
  const currency = useCurrency()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [limit, setLimit] = useState(100)
  const [editing, setEditing] = useState<Credit | null>(null)
  const month = useMemo(() => periodRange('month'), [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, error, refetch } = useCredits({ search: debounced || undefined, limit })
  const { data: thisMonth } = useCredits({ start: month.start.toISOString(), end: month.end.toISOString(), limit: 1000 })
  const monthTotal = thisMonth?.results.reduce((s, c) => s + Number(c.amount), 0) ?? 0

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; items: Credit[] }>()
    for (const c of data?.results ?? []) {
      const key = new Date(c.received_at).toDateString()
      let g = map.get(key)
      if (!g) map.set(key, (g = { label: relativeDay(c.received_at), total: 0, items: [] }))
      g.total += Number(c.amount)
      g.items.push(c)
    }
    return [...map.values()]
  }, [data])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Money you received — salary, refunds, gifts. Received this month:{' '}
            <b className="text-emerald-600 tabular-nums dark:text-emerald-400">+{money(monthTotal, currency)}</b>
          </p>
        </div>
        <MoneyTabs />
      </div>

      {!user?.balance_tracking && (
        <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm dark:border-violet-500/30 dark:bg-violet-500/10">
          Want to see how much money you have left? Turn on{' '}
          <Link to="/settings#balance" className="font-semibold text-violet-700 underline dark:text-violet-300">Balance tracking</Link>{' '}
          in Settings. Your expenses stay exactly as they are.
        </p>
      )}

      <Card>
        <p className="mb-4 font-semibold">Add credit</p>
        <CreditForm compact />
      </Card>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search credits…" className="pl-10" />
      </div>

      {error && !data ? (
        <LoadError error={error} onRetry={() => refetch()} what="your credits" />
      ) : groups.length ? (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.label}>
              <div className="mb-1.5 flex items-baseline justify-between px-2 text-xs font-medium text-zinc-500">
                <span className="tracking-wide uppercase">{g.label}</span>
                <span className="tabular-nums">+{money(g.total, currency)}</span>
              </div>
              <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60">
                {g.items.map((c) => {
                  const src = creditSource(c.source)
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setEditing(c)}
                        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-lg dark:bg-emerald-500/15">{src.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{c.note || src.label}</p>
                          <p className="truncate text-xs text-zinc-500">{src.label} · {timeOf(c.received_at)}</p>
                        </div>
                        <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">+{money(c.amount, currency)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {data?.next && (
            <div className="flex justify-center">
              <Button variant="soft" onClick={() => setLimit((l) => l + 100)}>Load more</Button>
            </div>
          )}
        </div>
      ) : (
        data && (
          <Card>
            <Empty icon="💰" title={debounced ? 'No credits found' : 'No credits yet'}>
              {debounced ? 'Try a different search.' : 'Add your salary or any money you receive above.'}
            </Empty>
          </Card>
        )
      )}
      <CreditFormModal open={!!editing} credit={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
