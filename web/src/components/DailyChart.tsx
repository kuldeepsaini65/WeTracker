import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money, startOfDay, type Period } from '../lib/format'

export function DailyChart({ daily, start, end, period, currency }: {
  daily: { date: string; total: string }[]
  start: Date
  end: Date
  period: Period
  currency: string
}) {
  const data = useMemo(() => {
    const byDate = new Map(daily.map((d) => [d.date, Number(d.total)]))
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (period === 'year') {
      // Monthly buckets for the year view
      const months = Array.from({ length: 12 }, (_, m) => ({ label: new Date(start.getFullYear(), m, 1).toLocaleDateString(undefined, { month: 'short' }), full: new Date(start.getFullYear(), m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), total: 0 }))
      for (const [date, total] of byDate) months[Number(date.slice(5, 7)) - 1].total += total
      return months
    }
    const out = []
    for (let d = startOfDay(start); d < end; d.setDate(d.getDate() + 1)) {
      out.push({
        label: period === 'week' ? d.toLocaleDateString(undefined, { weekday: 'short' }) : String(d.getDate()),
        full: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        total: byDate.get(key(d)) ?? 0,
      })
    }
    return out
  }, [daily, start, end, period])

  return (
    <div className="h-52 text-violet-600 dark:text-violet-400">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} interval="preserveStartEnd" minTickGap={6} />
          <YAxis width={48} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} tickFormatter={(v) => money(v, currency, true)} />
          <Tooltip
            cursor={{ fill: 'rgba(124,58,237,.08)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-xl bg-zinc-900 px-3 py-2 text-xs text-white shadow-xl">
                  <p className="text-zinc-400">{payload[0].payload.full}</p>
                  <p className="text-sm font-semibold tabular-nums">{money(payload[0].payload.total, currency)}</p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
