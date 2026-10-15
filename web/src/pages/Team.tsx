import clsx from 'clsx'
import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Avatar, Breakdown, PeriodPicker } from '../components/Breakdown'
import { DailyChart } from '../components/DailyChart'
import { ExpenseList } from '../components/ExpenseList'
import { InviteCard } from '../components/TeamCards'
import { useToast } from '../components/Toast'
import { Button, Card, CategoryIcon, Empty, Input, LoadError } from '../components/ui'
import { api } from '../lib/api'
import { useAuth, useCurrency } from '../lib/auth'
import { money, periodRange, relativeDay, type Period } from '../lib/format'
import { useTeam, useTeamAction, useTeamExpenses, useTeamSummary } from '../lib/queries'

export function TeamPage() {
  const { user } = useAuth()
  if (user?.role !== 'senior') return <Navigate to="/settings" replace />
  return <SeniorTeam inviteCode={user.invite_code ?? ''} />
}

function SeniorTeam({ inviteCode }: { inviteCode: string }) {
  const currency = useCurrency()
  const [period, setPeriod] = useState<Period>('month')
  const [offset, setOffset] = useState(0)
  const [member, setMember] = useState<number | undefined>()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const range = useMemo(() => periodRange(period, offset), [period, offset])
  const { data: team } = useTeam()
  const { data: s, error: summaryError, refetch: refetchSummary } = useTeamSummary(range.start, range.end, member)
  const { data: feed } = useTeamExpenses({
    member,
    search: debounced || undefined,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  })

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const members = team?.members ?? []
  const selected = members.find((m) => m.id === member)
  const total = Number(s?.total ?? 0)
  const prev = Number(s?.previous_total ?? 0)
  const delta = prev > 0 ? ((total - prev) / prev) * 100 : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {members.length - 1} {members.length - 1 === 1 ? 'user' : 'users'} + you. Read-only view of everything your team spends.
        </p>
      </div>

      {members.length <= 1 && <InviteCard code={inviteCode} />}

      <PeriodPicker period={period} label={range.label} offset={offset} onPeriod={setPeriod} onOffset={setOffset} />

      {selected && (
        <div className="flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm dark:border-violet-500/30 dark:bg-violet-500/10">
          <Avatar name={selected.name} size="sm" />
          <span className="flex-1">
            Showing <b>{selected.name}</b>{selected.is_senior && ' (you)'}
          </span>
          <button onClick={() => setMember(undefined)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-500/20">
            <X className="size-4" /> Everyone
          </button>
        </div>
      )}

      {summaryError && <LoadError error={summaryError} onRetry={() => refetchSummary()} what="team totals" />}

      <div className={summaryError ? 'pointer-events-none grid gap-4 opacity-40 md:grid-cols-3' : 'grid gap-4 md:grid-cols-3'}>
        <Card>
          <p className="text-sm text-zinc-500">{selected ? `${selected.name} spent` : 'Team spent'}</p>
          <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{money(total, currency)}</p>
          <p className="mt-1 text-sm text-zinc-500">{s?.count ?? 0} {s?.count === 1 ? 'expense' : 'expenses'}</p>
          {delta !== null && (
            <p className="mt-3 inline-flex rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium dark:bg-zinc-800">
              {Math.abs(delta).toFixed(0)}% {delta >= 0 ? 'more' : 'less'} than previous {period}
            </p>
          )}
        </Card>
        <Card className="md:col-span-2">
          <p className="mb-3 text-sm font-medium">Daily spending</p>
          <DailyChart daily={s?.daily ?? []} start={range.start} end={range.end} period={period} currency={currency} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-2 text-sm font-medium">By person <span className="font-normal text-zinc-400">· tap to filter</span></p>
          {s && s.by_member.length > 0 ? (
            <Breakdown
              total={total}
              currency={currency}
              selected={member ?? null}
              onSelect={(k) => setMember(member === k ? undefined : Number(k))}
              rows={s.by_member.map((r) => ({
                key: r.member.id,
                label: r.member.name + (members.find((m) => m.id === r.member.id)?.is_senior ? ' (you)' : ''),
                icon: <Avatar name={r.member.name} size="sm" />,
                total: r.total,
              }))}
            />
          ) : (
            <Empty icon="👥" title="No spending in this period" />
          )}
        </Card>
        <Card>
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
            <Empty icon="📊" title="Nothing yet" />
          )}
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Expenses</h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes…" className="pl-10" />
          </div>
        </div>
        {feed?.results.length ? (
          <>
            <ExpenseList expenses={feed.results} readOnly />
            {feed.next && <p className="text-center text-sm text-zinc-500">Showing the latest {feed.results.length} of {feed.count}</p>}
          </>
        ) : (
          feed && <Card><Empty icon="🧾" title="No expenses in this period" /></Card>
        )}
      </section>

      <MembersTable />
      {members.length > 1 && <InviteCard code={inviteCode} />}
    </div>
  )
}

function MembersTable() {
  const currency = useCurrency()
  const toast = useToast()
  const { data: team } = useTeam()
  const [confirm, setConfirm] = useState<number | null>(null)
  const remove = useTeamAction((id: number) => api<void>(`/team/members/${id}/`, { method: 'DELETE' }))
  const members = team?.members ?? []

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Members</h2>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200/70 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 text-right font-medium">This month</th>
              <th className="px-4 py-3 font-medium">Last expense</th>
              <th className="px-4 py-3 text-right font-medium">Uncategorized</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.name}{m.is_senior && <span className="ml-1.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">Senior</span>}</p>
                      <p className="truncate text-xs text-zinc-500">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {money(m.month_total, currency)}
                  <span className="block text-xs font-normal text-zinc-500">{m.month_count} {m.month_count === 1 ? 'expense' : 'expenses'}</span>
                </td>
                <td className="px-4 py-3 text-zinc-500">{m.last_spent_at ? relativeDay(m.last_spent_at) : 'Never'}</td>
                <td className={clsx('px-4 py-3 text-right tabular-nums', m.uncategorized_count > 0 && 'font-medium text-amber-600 dark:text-amber-400')}>
                  {m.uncategorized_count}
                </td>
                <td className="px-4 py-3 text-zinc-500">{m.is_senior ? '—' : m.joined_at ? relativeDay(m.joined_at) : '—'}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {!m.is_senior &&
                    (confirm === m.id ? (
                      <span className="inline-flex gap-1">
                        <Button
                          variant="danger"
                          className="px-3 py-1.5"
                          disabled={remove.isPending}
                          onClick={() =>
                            remove.mutate(m.id, {
                              onSuccess: () => {
                                setConfirm(null)
                                toast({ tone: 'success', message: `${m.name} removed from your team` })
                              },
                            })
                          }
                        >
                          Remove
                        </Button>
                        <Button variant="ghost" className="px-3 py-1.5" onClick={() => setConfirm(null)}>Cancel</Button>
                      </span>
                    ) : (
                      <Button variant="ghost" className="px-3 py-1.5 text-zinc-500" onClick={() => setConfirm(m.id)}>Remove</Button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">"This month" is the calendar month. Removed users keep their expenses and get their own categories back.</p>
    </section>
  )
}
