import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, tokenStore, type User } from './api'

interface AuthResponse {
  access: string
  refresh: string
  user: User
}

interface AuthCtx {
  user: User | null | undefined
  login(email: string, password: string): Promise<void>
  register(data: {
    email: string
    password: string
    first_name: string
    currency: string
    account_type: 'personal' | 'senior'
    invite_code?: string
  }): Promise<void>
  logout(): void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { data: user, isPending } = useQuery({
    queryKey: ['me'],
    queryFn: () => (tokenStore.get() ? api<User>('/auth/me/') : Promise.resolve(null)),
    retry: false,
    staleTime: Infinity,
  })

  const logout = useCallback(() => {
    tokenStore.set(null)
    qc.clear()
    qc.setQueryData(['me'], null)
  }, [qc])

  useEffect(() => setUnauthorizedHandler(logout), [logout])

  const accept = useCallback(
    (r: AuthResponse) => {
      tokenStore.set({ access: r.access, refresh: r.refresh })
      qc.setQueryData(['me'], r.user)
    },
    [qc],
  )

  const value = useMemo<AuthCtx>(
    () => ({
      user: isPending ? undefined : (user ?? null),
      login: async (email, password) => accept(await api<AuthResponse>('/auth/login/', { method: 'POST', json: { email, password } })),
      register: async (data) => accept(await api<AuthResponse>('/auth/register/', { method: 'POST', json: data })),
      logout,
    }),
    [user, isPending, accept, logout],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}

export function useCurrency() {
  return useAuth().user?.currency ?? 'INR'
}
