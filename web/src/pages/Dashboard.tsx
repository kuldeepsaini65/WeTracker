import clsx from 'clsx'
import { ArrowRight, Inbox, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Breakdown, PeriodPicker } from '../components/Breakdown'
import { DailyChart } from '../components/DailyChart'
import { ExpenseList } from '../components/ExpenseList'
import { QuickAdd } from '../components/QuickAdd'
import { Card, CategoryIcon, Empty, LoadError } from '../components/ui'
import { useAuth, useCurrency } from '../lib/auth'
import { money, periodRange, type Period } from '../lib/format'
import { useExpenses, useSummary } from '../lib/queries'

export function Dashboard() {
  const { user } = useAuth()
  const currency = useCurrency()
  const [period, setPeriod] = useState<Period>('month')
  const [offset, setOffset] = useState(0)
  const range = useMemo(() => periodRange(period, offset), [period, offset])
  const { data: s, error: summaryError, refetch: refetchSummary } = useSummary(range.start, range.end)
  const recent = useExpenses({ limit: 8 })
  const recentFailed = recent.isError && !recent.data

  const total = Number(s?.total ?? 0)
  const prev = Number(s?.previous_total ?? 0)
  const delta = prev > 0 ? ((total - prev) / prev) * 100 : null
  const budget = period === 'month' && user?.monthly_budget ? Number(user.monthly_budget) : null
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">{greeting}{user?.first_name ? `, ${user.first_name}` : ''} 👋</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">What did you spend?</h1>
      </div>

      <Card className="p-4 md:p-5">
        <QuickAdd />
      </Card>

      {!!s?.uncategorized_count && (
        <Link
          to="/inbox"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm transition hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
        >
          <Inbox className="size-5 text-amber-600 dark:text-amber-400" />
          <span className="flex-1">
            <b>{s.uncategorized_count}</b> uncategorized {s.uncategorized_count === 1 ? 'expense' : 'expenses'} — sort them in a few taps
          </span>
          <ArrowRight className="size-4 text-amber-600 dark:text-amber-400" />
        </Link>
      )}

      <PeriodPicker period={period} label={range.label} offset={offset} onPeriod={setPeriod} onOffset={setOffset} />

      {summaryError && <LoadError error={summaryError} onRetry={() => refetchSummary()} />}

      <div className={summaryError ? 'pointer-events-none grid gap-4 opacity-40 md:grid-cols-3' : 'grid gap-4 md:grid-cols-3'}>
        <Card className="md:col-span-1">
          <p className="text-sm text-zinc-500">Spent</p>
          <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{money(total, currency)}</p>
          <p className="mt-1 text-sm text-zinc-500">{s?.count ?? 0} expenses</p>
          {delta !== null && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium dark:bg-zinc-800">
              {delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {Math.abs(delta).toFixed(0)}% {delta >= 0 ? 'more' : 'less'} than previous {period}
            </p>
          )}
          {budget !== null && <BudgetBar spent={total} budget={budget} currency={currency} />}
        </Card>

        <Card className="md:col-span-2">
          <p className="mb-3 text-sm font-medium">Daily spending</p>
          <DailyChart daily={s?.daily ?? []} start={range.start} end={range.end} period={period} currency={currency} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <p className="mb-2 text-sm font-medium">By category</p>
          {s && s.by_category.length > 0 ? (
            <Breakdown
              total={total}
              currency={currency}
              rows={s.by_category.map((r) => ({
                key: r.category?.id ?? 'none',
                label: r.category?.name ?? 'Uncategorized',
                icon: <CategoryIcon category={r.category} size="sm" />,
                total: r.total,
              }))}
            />
          ) : (
            <Empty icon="📊" title="Nothing yet">Add an expense to see the breakdown.</Empty>
          )}
        </Card>

        <div className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-sm font-medium">Recent</p>
            <Link to="/expenses" className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400">
              See all
            </Link>
          </div>
          {recentFailed ? (
            <LoadError error={recent.error} onRetry={() => recent.refetch()} what="recent expenses" />
          ) : recent.data?.results.length ? (
            <ExpenseList expenses={recent.data.results} />
          ) : (
            <Card>
              <Empty icon="⚡" title="Your first expense takes 2 seconds">
                Type <b>250 coffee</b> above and press Enter.
              </Empty>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function BudgetBar({ spent, budget, currency }: { spent: number; budget: number; currency: string }) {
  const pct = (spent / budget) * 100
  const over = pct > 100
  return (
    <div className="mt-5">
      <div className="flex justify-between text-xs text-zinc-500">
        <span>Budget {money(budget, currency)}</span>
        <span className={clsx('font-medium', over ? 'text-rose-600 dark:text-rose-400' : '')}>
          {over ? `⚠ Over by ${money(spent - budget, currency)}` : `${money(budget - spent, currency)} left`}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className={clsx('h-full rounded-full', over ? 'bg-rose-500' : 'bg-violet-600 dark:bg-violet-400')} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}
