import clsx from 'clsx'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Credit, CreditSource } from '../lib/api'
import { useCurrency } from '../lib/auth'
import { CREDIT_SOURCES } from '../lib/credits'
import { money, toLocalInput, uid } from '../lib/format'
import { useDeleteCredit, useSaveCredit } from '../lib/queries'
import { useToast } from './Toast'
import { Button, Chip, Field, Input, Modal } from './ui'

/** Add (no `credit`) or edit a credit. `compact` = inline card on the Credits page. */
export function CreditForm({ credit, onDone, compact }: { credit?: Credit | null; onDone?(): void; compact?: boolean }) {
  const currency = useCurrency()
  const toast = useToast()
  const [amount, setAmount] = useState(credit ? String(Number(credit.amount)) : '')
  const [note, setNote] = useState(credit?.note ?? '')
  const [source, setSource] = useState<CreditSource>(credit?.source ?? 'salary')
  const [initialWhen] = useState(() => toLocalInput(credit ? new Date(credit.received_at) : new Date()))
  const [when, setWhen] = useState(initialWhen)
  const save = useSaveCredit()
  const del = useDeleteCredit()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // The picker only has minutes; if the time wasn't touched on a new credit, use the exact current moment.
    const receivedAt = !credit && when === initialWhen ? new Date() : new Date(when)
    const payload = { amount, note: note.trim(), source, received_at: receivedAt.toISOString() }
    save.mutate(credit ? { id: credit.id, ...payload } : { ...payload, client_id: uid() }, {
      onSuccess: (c) => {
        toast({ tone: 'success', message: credit ? 'Credit updated' : <span>Added <b className="text-emerald-300">+{money(c.amount, currency)}</b>{c.note && <> · {c.note}</>}</span> })
        if (!credit) {
          setAmount('')
          setNote('')
          setWhen(toLocalInput(new Date()))
        }
        onDone?.()
      },
      onError: (err) => toast({ tone: 'error', message: err.message }),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={clsx('grid gap-3', compact && 'sm:grid-cols-[1fr_1.4fr]')}>
        <Field label={`Amount received (${currency})`}>
          <Input
            autoFocus={!compact}
            required
            inputMode="decimal"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="text-2xl font-semibold tabular-nums"
          />
        </Field>
        <Field label="Note">
          <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. October salary" className="sm:py-3.5" />
        </Field>
      </div>
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-zinc-500">Source</span>
        <div className="flex flex-wrap gap-2">
          {CREDIT_SOURCES.map((s) => (
            <Chip key={s.value} active={source === s.value} color="#059669" onClick={() => setSource(s.value)}>
              {s.icon} {s.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className={clsx('flex flex-wrap items-end gap-3', !compact && 'flex-col items-stretch')}>
        <Field label="Date & time">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
        </Field>
        <div className={clsx('flex items-center gap-2', compact ? 'ml-auto' : 'pt-1')}>
          {credit && (
            <Button
              type="button"
              variant="ghost"
              className="text-rose-600 dark:text-rose-400"
              onClick={() =>
                del.mutate(credit.id, {
                  onSuccess: () => {
                    toast({ tone: 'success', message: 'Credit deleted' })
                    onDone?.()
                  },
                })
              }
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          <Button type="submit" disabled={save.isPending || !amount} className={clsx('min-w-32 bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-500', !compact && 'ml-auto')}>
            {credit ? 'Save' : 'Add credit'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export function CreditFormModal({ credit, open, onClose }: { credit?: Credit | null; open: boolean; onClose(): void }) {
  return (
    <Modal open={open} onClose={onClose} title={credit ? 'Edit credit' : 'Add credit'}>
      {open && <CreditForm key={credit?.id ?? 'new'} credit={credit} onDone={onClose} />}
    </Modal>
  )
}
