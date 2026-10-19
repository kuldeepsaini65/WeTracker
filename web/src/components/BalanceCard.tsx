import clsx from 'clsx'
import { ArrowDownLeft, ArrowUpRight, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCurrency } from '../lib/auth'
import { money } from '../lib/format'
import { useBalance } from '../lib/queries'
import { CreditFormModal } from './CreditForm'
import { Button, LoadError } from './ui'

/** Home-screen "balance remaining" — only rendered when balance tracking is on. */
export function BalanceCard() {
  const currency = useCurrency()
  const { data: b, error, refetch } = useBalance(true)
  const [adding, setAdding] = useState(false)

  if (error && !b) return <LoadError error={error} onRetry={() => refetch()} what="your balance" />

  const balance = Number(b?.balance ?? 0)
  const since = b?.since ? new Date(b.since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null

  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 p-5 text-white shadow-lg shadow-violet-600/20 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-violet-100">
            <Wallet className="size-4" /> Balance remaining
          </p>
          <p className={clsx('mt-1 text-4xl font-bold tracking-tight tabular-nums md:text-5xl', !b && 'opacity-50')}>
            {balance < 0 && '−'}
            {money(Math.abs(balance), currency)}
          </p>
          {balance < 0 && <p className="mt-1 text-sm font-medium text-rose-200">You've spent more than you've received</p>}
        </div>
        <Button onClick={() => setAdding(true)} className="bg-white/15 shadow-none ring-1 ring-white/25 hover:bg-white/25">
          <Plus className="size-4" /> Add credit
        </Button>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/15 pt-4 text-sm">
        <Stat label="Opening" value={money(b?.opening_balance ?? 0, currency)} />
        <Stat label="Credits" value={`+${money(b?.credits ?? 0, currency)}`} icon={<ArrowDownLeft className="size-3.5" />} />
        <Stat label="Expenses" value={`−${money(b?.expenses ?? 0, currency)}`} icon={<ArrowUpRight className="size-3.5" />} />
      </div>
      <p className="mt-3 text-xs text-violet-100/80">
        {since ? `Counting since ${since}. ` : ''}
        <Link to="/credits" className="underline underline-offset-2 hover:text-white">See credits</Link>
        {' · '}
        <Link to="/settings#balance" className="underline underline-offset-2 hover:text-white">Change</Link>
      </p>
      <CreditFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-xs text-violet-100/80">{icon}{label}</p>
      <p className="truncate font-semibold tabular-nums">{value}</p>
    </div>
  )
}
