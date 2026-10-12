import clsx from 'clsx'
import { Inbox, LayoutDashboard, ListOrdered, LogOut, Moon, Plus, Settings, Sun, Tags, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useSummary } from '../lib/queries'
import { periodRange } from '../lib/format'
import { QuickAdd } from './QuickAdd'
import { Modal } from './ui'

type NavItem = { to: string; label: string; icon: typeof Inbox; end?: boolean; badge?: boolean }

const HOME: NavItem = { to: '/', label: 'Home', icon: LayoutDashboard, end: true }
const EXPENSES: NavItem = { to: '/expenses', label: 'Expenses', icon: ListOrdered }
const INBOX: NavItem = { to: '/inbox', label: 'Inbox', icon: Inbox, badge: true }
const TEAM: NavItem = { to: '/team', label: 'Team', icon: Users }
const CATEGORIES: NavItem = { to: '/categories', label: 'Categories', icon: Tags }
const SETTINGS: NavItem = { to: '/settings', label: 'Settings', icon: Settings }

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }
  return { dark, toggle }
}

export function Layout() {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [quickOpen, setQuickOpen] = useState(params.get('add') === '1')
  const { start, end } = periodRange('month')
  const { data: summary } = useSummary(start, end)
  const inboxCount = summary?.uncategorized_count ?? 0
  const isSenior = user?.role === 'senior'
  const nav = isSenior ? [HOME, TEAM, EXPENSES, INBOX, CATEGORIES, SETTINGS] : [HOME, EXPENSES, INBOX, CATEGORIES, SETTINGS]
  // Mobile bottom bar: 4 links around the add button. Seniors swap Expenses for Team; Settings moves to the header.
  const mobileNav = isSenior ? [HOME, TEAM, INBOX, EXPENSES] : [HOME, EXPENSES, INBOX, SETTINGS]

  const closeQuick = useCallback(() => {
    setQuickOpen(false)
    if (params.has('add')) {
      params.delete('add')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  // Press "N" (or "/") anywhere to add an expense.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'n' || e.key === 'N' || e.key === '/') {
        e.preventDefault()
        setQuickOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Invite link opened while signed in: if they can still join, go to Settings with the code filled in;
  // otherwise (already a senior or in a team, e.g. just signed up with it) drop the code from the URL.
  const invite = params.get('invite')
  if (invite) {
    const canJoin = !isSenior && !user?.senior
    if (!canJoin) return <Navigate to={location.pathname} replace />
    if (location.pathname !== '/settings') return <Navigate to={`/settings?invite=${encodeURIComponent(invite)}`} replace />
  }

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-zinc-200/70 px-4 py-6 md:flex dark:border-zinc-800">
        <Logo />
        <button
          onClick={() => setQuickOpen(true)}
          className="mt-8 flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500"
        >
          <Plus className="size-4" /> Add expense
          <kbd className="ml-auto rounded-md bg-white/20 px-1.5 text-xs">N</kbd>
        </button>
        <nav className="mt-6 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:text-white',
                )
              }
            >
              <n.icon className="size-[18px]" />
              {n.label}
              {n.badge && inboxCount > 0 && (
                <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">{inboxCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-zinc-200/70 pt-4 dark:border-zinc-800">
          <p className="truncate px-3 text-xs text-zinc-500">{user?.email}</p>
          <p className="truncate px-3 pb-2 text-xs text-zinc-400">
            {isSenior ? 'Senior' : user?.senior ? `${user.senior.name}'s team` : 'Personal'}
          </p>
          <button onClick={toggle} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />} {dark ? 'Light' : 'Dark'} mode
          </button>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <LogOut className="size-[18px]" /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200/70 bg-zinc-50/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="py-3">
          <Logo />
        </div>
        <div className="flex items-center">
          <button onClick={toggle} className="rounded-xl p-2 text-zinc-500" aria-label="Toggle theme">
            {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
          {isSenior && (
            <NavLink to="/settings" className="rounded-xl p-2 text-zinc-500" aria-label="Settings">
              <Settings className="size-5" />
            </NavLink>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-32 md:px-8 md:py-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav with central add button */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="grid grid-cols-5 items-center">
          {mobileNav.slice(0, 2).map((n) => <MobileLink key={n.to} {...n} count={n.badge ? inboxCount : 0} />)}
          <div className="flex justify-center">
            <button
              onClick={() => setQuickOpen(true)}
              aria-label="Add expense"
              className="-mt-7 grid size-16 place-items-center rounded-full bg-violet-600 text-white shadow-xl shadow-violet-600/40 ring-4 ring-zinc-50 transition active:scale-95 dark:ring-zinc-950"
            >
              <Plus className="size-7" strokeWidth={2.5} />
            </button>
          </div>
          {mobileNav.slice(2).map((n) => <MobileLink key={n.to} {...n} count={n.badge ? inboxCount : 0} />)}
        </div>
      </nav>

      <Modal open={quickOpen} onClose={closeQuick} title="Quick add" wide>
        <QuickAdd autoFocus onAdded={closeQuick} compact />
      </Modal>
    </div>
  )
}

function MobileLink({ to, label, icon: Icon, end, count = 0 }: NavItem & { count?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-500')
      }
    >
      <Icon className="size-[22px]" />
      {label}
      {count > 0 && <span className="absolute top-1.5 left-1/2 ml-2 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{count}</span>}
    </NavLink>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className="text-lg font-bold tracking-tight">WeTracker</span>
    </div>
  )
}
