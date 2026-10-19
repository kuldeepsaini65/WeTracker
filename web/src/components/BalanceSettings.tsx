import clsx from 'clsx'
import { Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth, useCurrency } from '../lib/auth'
import { money, toLocalInput } from '../lib/format'
import { useUpdateMe } from '../lib/queries'
import { useToast } from './Toast'
import { Button, Card, Field, Input } from './ui'

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange(v: boolean): void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50',
        checked ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-zinc-700',
      )}
    >
      <span className={clsx('inline-block size-5 rounded-full bg-white shadow transition', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  )
}

/** Settings → Balance tracking. Off: expenses only (unchanged app). On: Home also shows balance remaining. */
export function BalanceSettingsCard() {
  const { user } = useAuth()
  const currency = useCurrency()
  const toast = useToast()
  const update = useUpdateMe()
  const on = !!user?.balance_tracking
  const [setup, setSetup] = useState(false) // turning on: ask for the current balance first
  const [editing, setEditing] = useState(false)
  const [opening, setOpening] = useState('')
  const [since, setSince] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  const { hash } = useLocation()

  // Links to /settings#balance (Home, Credits) land right on this card.
  useEffect(() => {
    if (hash === '#balance') cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [hash])

  const save = (payload: Parameters<typeof update.mutate>[0], message: string) =>
    update.mutate(payload, {
      onSuccess: () => {
        toast({ tone: 'success', message })
        setSetup(false)
        setEditing(false)
      },
      onError: (e) => toast({ tone: 'error', message: e.message }),
    })

  const startEdit = () => {
    setOpening(String(Number(user?.opening_balance ?? 0)))
    setSince(toLocalInput(user?.balance_start ? new Date(user.balance_start) : new Date()))
    setEditing(true)
  }

  const sinceLabel = user?.balance_start
    ? new Date(user.balance_start).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <Card>
      <div id="balance" ref={cardRef} className="flex scroll-mt-24 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          <Wallet className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Balance tracking</p>
          <p className="text-sm text-zinc-500">
            {on
              ? 'Home shows your balance remaining: opening balance + credits − expenses.'
              : 'Off: WeTracker shows your expenses only. Turn on to also see how much money you have left.'}
          </p>
        </div>
        <Switch
          label="Balance tracking"
          checked={on || setup}
          disabled={update.isPending}
          onChange={(v) => {
            if (v) {
              // First time: ask for the current balance. Later: just switch back on.
              if (user?.balance_start) save({ balance_tracking: true }, 'Balance tracking on')
              else {
                setOpening('')
                setSetup(true)
              }
            } else if (setup) setSetup(false)
            else save({ balance_tracking: false }, 'Balance tracking off — showing expenses only')
          }}
        />
      </div>

      {setup && (
        <form
          className="mt-4 space-y-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50"
          onSubmit={(e) => {
            e.preventDefault()
            save({ balance_tracking: true, opening_balance: opening || '0' }, 'Balance tracking on')
          }}
        >
          <Field label={`How much money do you have right now? (${currency})`} hint="Your starting point. Expenses and credits from now on are added to or taken from it. You can change this later.">
            <Input autoFocus type="number" inputMode="decimal" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={update.isPending}>Turn on</Button>
            <Button type="button" variant="ghost" onClick={() => setSetup(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {on && !editing && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-800/50">
          <span>
            Opening balance <b className="tabular-nums">{money(user?.opening_balance ?? 0, currency)}</b>
            {sinceLabel && <span className="text-zinc-500"> · counting since {sinceLabel}</span>}
          </span>
          <Button variant="ghost" className="px-3 py-1.5" onClick={startEdit}>Edit</Button>
        </div>
      )}

      {on && editing && (
        <form
          className="mt-4 space-y-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/50"
          onSubmit={(e) => {
            e.preventDefault()
            save({ opening_balance: opening || '0', balance_start: new Date(since).toISOString() }, 'Balance updated')
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Opening balance (${currency})`}>
              <Input type="number" inputMode="decimal" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} />
            </Field>
            <Field label="Count from" hint="Expenses and credits before this aren't included.">
              <Input type="datetime-local" value={since} onChange={(e) => setSince(e.target.value)} required />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={update.isPending}>Save</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </Card>
  )
}
