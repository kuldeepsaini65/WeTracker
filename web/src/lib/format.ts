const formatters = new Map<string, Intl.NumberFormat>()

export function money(value: string | number, currency = 'INR', compact = false) {
  const key = `${currency}|${compact}`
  let f = formatters.get(key)
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: compact ? 1 : 2,
        minimumFractionDigits: 0,
        notation: compact ? 'compact' : 'standard',
      })
    } catch {
      f = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
    }
    formatters.set(key, f)
  }
  return f.format(Number(value))
}

export function relativeDay(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.round((startOfDay(today).getTime() - startOfDay(d).getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: diff < 7 ? 'long' : undefined,
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

export function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export type Period = 'week' | 'month' | 'year'

export function periodRange(period: Period, offset = 0): { start: Date; end: Date; label: string } {
  const now = new Date()
  if (period === 'week') {
    const s = startOfDay(now)
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7) + offset * 7)
    const e = new Date(s)
    e.setDate(e.getDate() + 7)
    const last = new Date(e.getTime() - 1)
    const label = offset === 0 ? 'This week'
      : `${s.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
    return { start: s, end: e, label }
  }
  if (period === 'year') {
    const y = now.getFullYear() + offset
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), label: offset === 0 ? 'This year' : String(y) }
  }
  const s = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return {
    start: s,
    end: new Date(s.getFullYear(), s.getMonth() + 1, 1),
    label: offset === 0 ? 'This month' : s.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  }
}

/** datetime-local input value for a Date (local time). */
export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function uid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
