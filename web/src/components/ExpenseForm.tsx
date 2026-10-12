import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Expense } from '../lib/api'
import { useCurrency } from '../lib/auth'
import { toLocalInput, uid } from '../lib/format'
import { useCategories, useCreateExpense, useDeleteExpense, useUpdateExpense } from '../lib/queries'
import { useToast } from './Toast'
import { Button, Chip, Field, Input, Modal } from './ui'

/** Full form for editing (or adding with all fields). Quick add covers the common case. */
export function ExpenseFormModal({ expense, open, onClose }: { expense?: Expense | null; open: boolean; onClose(): void }) {
  return (
    <Modal open={open} onClose={onClose} title={expense ? 'Edit expense' : 'New expense'}>
      {open && <ExpenseForm key={expense?.id ?? 'new'} expense={expense} onDone={onClose} />}
    </Modal>
  )
}

function ExpenseForm({ expense, onDone }: { expense?: Expense | null; onDone(): void }) {
  const currency = useCurrency()
  const toast = useToast()
  const { data: categories = [] } = useCategories()
  const [amount, setAmount] = useState(expense ? String(Number(expense.amount)) : '')
  const [note, setNote] = useState(expense?.note ?? '')
  const [category, setCategory] = useState<number | null>(expense?.category ?? null)
  const [when, setWhen] = useState(toLocalInput(expense ? new Date(expense.spent_at) : new Date()))
  const create = useCreateExpense()
  const update = useUpdateExpense()
  const del = useDeleteExpense()
  const busy = create.isPending || update.isPending

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { amount, note, category, spent_at: new Date(when).toISOString() }
    const opts = {
      onSuccess: () => {
        toast({ tone: 'success', message: expense ? 'Expense updated' : 'Expense added' })
        onDone()
      },
      onError: (err: Error) => toast({ tone: 'error', message: err.message }),
    }
    if (expense) update.mutate({ id: expense.id, ...payload }, opts)
    else create.mutate({ ...payload, client_id: uid() }, opts)
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label={`Amount (${currency})`}>
        <Input
          autoFocus
          required
          inputMode="decimal"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="text-2xl font-semibold tabular-nums"
        />
      </Field>
      <Field label="Note">
        <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="What was it for?" />
      </Field>
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-zinc-500">Category</span>
        <div className="flex flex-wrap gap-2">
          <Chip active={category === null} color="#71717a" onClick={() => setCategory(null)}>
            Uncategorized
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={category === c.id} color={c.color} onClick={() => setCategory(c.id)}>
              {c.icon} {c.name}
            </Chip>
          ))}
        </div>
      </div>
      <Field label="Date & time">
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
      </Field>
      <div className="flex items-center gap-2 pt-2">
        {expense && (
          <Button
            type="button"
            variant="ghost"
            className="text-rose-600 dark:text-rose-400"
            onClick={() =>
              del.mutate(expense.id, {
                onSuccess: () => {
                  toast({ tone: 'success', message: 'Expense deleted' })
                  onDone()
                },
              })
            }
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
        <Button type="submit" disabled={busy} className="ml-auto min-w-28">
          {expense ? 'Save' : 'Add'}
        </Button>
      </div>
    </form>
  )
}
