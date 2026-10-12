const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export interface Person {
  id: number
  name: string
  email: string
}

export type Role = 'user' | 'senior'

export interface User {
  id: number
  email: string
  first_name: string
  currency: string
  monthly_budget: string | null
  role: Role
  /** The senior this user joined, if any. */
  senior: Person | null
  /** Seniors only. */
  invite_code: string | null
  can_manage_categories: boolean
}

export interface TeamMember extends Person {
  joined_at: string | null
  month_total: string
  month_count: number
  uncategorized_count: number
  last_spent_at: string | null
  is_senior: boolean
}

export interface Team {
  role: Role
  invite_code: string | null
  senior: Person | null
  members: TeamMember[]
}

export interface Category {
  id: number
  name: string
  icon: string
  color: string
  keywords: string
  position: number
}

export type CategoryBrief = Pick<Category, 'id' | 'name' | 'icon' | 'color'>

export interface Expense {
  id: number
  amount: string
  note: string
  category: number | null
  category_detail: CategoryBrief | null
  spent_at: string
  client_id: string | null
  created_at: string
  updated_at: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface QuickPreview {
  amount: string | null
  note: string
  category: CategoryBrief | null
  days_ago: number
}

export interface Frequent {
  amount: string
  note: string
  category: CategoryBrief | null
  count: number
}

export interface TeamExpense extends Expense {
  member: Person
}

export interface TeamSummary extends Summary {
  by_member: { member: Person; total: string; count: number }[]
}

export interface Summary {
  start: string
  end: string
  total: string
  count: number
  uncategorized_count: number
  previous_total: string
  by_category: { category: CategoryBrief | null; total: string; count: number }[]
  daily: { date: string; total: string }[]
}

interface Tokens {
  access: string
  refresh: string
}

const TOKENS_KEY = 'wt_tokens'

export const tokenStore = {
  get(): Tokens | null {
    try {
      return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? 'null')
    } catch {
      return null
    }
  },
  set(t: Tokens | null) {
    try {
      if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t))
      else localStorage.removeItem(TOKENS_KEY)
    } catch {
      /* storage unavailable */
    }
  },
}

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown) {
    super(ApiError.messageFrom(data) ?? `Request failed (${status})`)
    this.status = status
    this.data = data
  }
  static messageFrom(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined
    const d = data as Record<string, unknown>
    if (typeof d.detail === 'string') return d.detail
    for (const v of Object.values(d)) {
      if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
      if (typeof v === 'string') return v
    }
    return undefined
  }
}

let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

let refreshing: Promise<boolean> | null = null
async function refreshTokens(): Promise<boolean> {
  const t = tokenStore.get()
  if (!t) return false
  refreshing ??= fetch(`${BASE}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: t.refresh }),
  })
    .then(async (r) => {
      if (!r.ok) return false
      const data = await r.json()
      tokenStore.set({ access: data.access, refresh: data.refresh ?? t.refresh })
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  const t = tokenStore.get()
  if (t) headers.set('Authorization', `Bearer ${t.access}`)
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers, body })
  if (res.status === 401 && t && retry) {
    if (await refreshTokens()) return api<T>(path, init, false)
    tokenStore.set(null)
    onUnauthorized()
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
