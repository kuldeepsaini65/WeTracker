import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api, qs, TZ, type Category, type Expense, type Frequent, type Paginated, type QuickPreview, type Summary, type Team,
  type TeamExpense, type TeamSummary, type User,
} from './api'

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories/'), staleTime: 60_000 })
}

export function useFrequent() {
  return useQuery({ queryKey: ['expenses', 'frequent'], queryFn: () => api<Frequent[]>('/expenses/frequent/?limit=8') })
}

export function useSummary(start: Date, end: Date) {
  return useQuery({
    queryKey: ['expenses', 'summary', start.toISOString(), end.toISOString()],
    queryFn: () => api<Summary>(`/stats/summary/${qs({ start: start.toISOString(), end: end.toISOString(), tz: TZ })}`),
    placeholderData: keepPreviousData,
  })
}

export interface ExpenseFilters {
  search?: string
  category?: number
  uncategorized?: boolean
  start?: string
  end?: string
  limit?: number
}

export function useExpenses(f: ExpenseFilters) {
  return useQuery({
    queryKey: ['expenses', 'list', f],
    queryFn: () => api<Paginated<Expense>>(`/expenses/${qs({ ...f, limit: f.limit ?? 100 })}`),
    placeholderData: keepPreviousData,
  })
}

export function useQuickPreview(text: string) {
  const t = text.trim()
  return useQuery({
    queryKey: ['quick-preview', t],
    queryFn: () => api<QuickPreview>('/expenses/quick/preview/', { method: 'POST', json: { text: t } }),
    enabled: t.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

function useInvalidateExpenses() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['expenses'] })
}

export function useQuickAdd() {
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: (v: { text: string; client_id: string }) => api<Expense>('/expenses/quick/', { method: 'POST', json: v }),
    onSettled: invalidate,
  })
}

export type ExpenseInput = { amount: string; note: string; category: number | null; spent_at?: string; client_id?: string }

export function useCreateExpense() {
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: (v: ExpenseInput) => api<Expense>('/expenses/', { method: 'POST', json: v }),
    onSettled: invalidate,
  })
}

export function useUpdateExpense() {
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: ({ id, ...v }: Partial<ExpenseInput> & { id: number }) =>
      api<Expense>(`/expenses/${id}/`, { method: 'PATCH', json: v }),
    onSettled: invalidate,
  })
}

export function useDeleteExpense() {
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/expenses/${id}/`, { method: 'DELETE' }),
    onSettled: invalidate,
  })
}

export function useBulkCategorize() {
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: (v: { ids: number[]; category: number | null }) =>
      api<{ updated: number }>('/expenses/bulk-categorize/', { method: 'POST', json: v }),
    onSettled: invalidate,
  })
}

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...v }: Partial<Category>) =>
      id ? api<Category>(`/categories/${id}/`, { method: 'PATCH', json: v }) : api<Category>('/categories/', { method: 'POST', json: v }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/categories/${id}/`, { method: 'DELETE' }),
    onSettled: () => qc.invalidateQueries(),
  })
}

// ---------- Team (seniors) ----------

export function useTeam(enabled = true) {
  return useQuery({
    queryKey: ['team'],
    // "This month" per member = the viewer's local calendar month
    queryFn: () => {
      const now = new Date()
      return api<Team>(`/team/${qs({ start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), tz: TZ })}`)
    },
    enabled,
  })
}

export function useTeamSummary(start: Date, end: Date, member?: number) {
  return useQuery({
    queryKey: ['team', 'summary', start.toISOString(), end.toISOString(), member],
    queryFn: () => api<TeamSummary>(`/team/summary/${qs({ start: start.toISOString(), end: end.toISOString(), tz: TZ, member })}`),
    placeholderData: keepPreviousData,
  })
}

export function useTeamExpenses(f: ExpenseFilters & { member?: number }) {
  return useQuery({
    queryKey: ['team', 'expenses', f],
    queryFn: () => api<Paginated<TeamExpense>>(`/team/expenses/${qs({ ...f, limit: f.limit ?? 100 })}`),
    placeholderData: keepPreviousData,
  })
}

/** Team actions that change the current user: refresh "me", categories and everything expense-related. */
export function useTeamAction<V = void>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data) => {
      if (data && typeof data === 'object' && 'can_manage_categories' in data) qc.setQueryData(['me'], data as User)
      else await qc.invalidateQueries({ queryKey: ['me'] })
      await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    },
  })
}
