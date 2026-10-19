import clsx from 'clsx'
import { NavLink } from 'react-router-dom'

/** Switch between the Expenses and Credits lists (also reachable on phones, where the bottom bar is full). */
export function MoneyTabs() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'rounded-lg px-4 py-1.5 text-sm font-medium transition',
      isActive ? 'bg-white shadow-sm dark:bg-zinc-700' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
    )
  return (
    <nav className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900" aria-label="Transactions">
      <NavLink to="/expenses" className={tab}>Expenses</NavLink>
      <NavLink to="/credits" className={tab}>Credits</NavLink>
    </nav>
  )
}
