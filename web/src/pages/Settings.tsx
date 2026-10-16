import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../components/Toast'
import { TeamSettingsCard } from '../components/TeamCards'
import { Button, Card, Field, Input } from '../components/ui'
import { Link } from 'react-router-dom'
import { api, type User } from '../lib/api'
import { useAuth } from '../lib/auth'

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']

export function SettingsPage() {
  const { user, logout } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(user?.first_name ?? '')
  const [currency, setCurrency] = useState(user?.currency ?? 'INR')
  const [budget, setBudget] = useState(user?.monthly_budget ? String(Number(user.monthly_budget)) : '')
  const [saving, setSaving] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const u = await api<User>('/auth/me/', {
        method: 'PATCH',
        json: { first_name: name, currency, monthly_budget: budget ? budget : null },
      })
      qc.setQueryData(['me'], u)
      toast({ tone: 'success', message: 'Settings saved' })
    } catch (err) {
      toast({ tone: 'error', message: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Card>
        <form onSubmit={save} className="space-y-4">
          <Field label="Email">
            <Input value={user?.email ?? ''} disabled />
          </Field>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Currency">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Monthly budget" hint="Optional. Shows a progress bar on the home screen.">
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="No budget" />
          </Field>
          <Button type="submit" disabled={saving}>Save</Button>
        </form>
      </Card>
      <TeamSettingsCard />
      <Card>
        <p className="font-medium">Keyboard shortcuts</p>
        <ul className="mt-2 space-y-1.5 text-sm text-zinc-500">
          <li><kbd className="kbd">N</kbd> or <kbd className="kbd">/</kbd> — quick add from anywhere</li>
          <li><kbd className="kbd">Enter</kbd> — save · <kbd className="kbd">Esc</kbd> — close</li>
        </ul>
      </Card>
      <Button variant="soft" onClick={logout} className="md:hidden">Log out</Button>
      <DeleteAccountCard />
      <p className="pb-4 text-center text-xs text-zinc-500">
        <Link to="/privacy" className="underline">Privacy policy</Link>
      </p>
    </div>
  )
}

function DeleteAccountCard() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(() => window.location.hash === '#delete')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const remove = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api<void>('/auth/delete-account/', { method: 'POST', json: { password } })
      logout()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Card className="border-rose-200 dark:border-rose-500/30">
      <div id="delete" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Delete account</p>
          <p className="text-sm text-zinc-500">Permanently delete your account, expenses and categories.</p>
        </div>
        {!open && <Button variant="ghost" className="text-rose-600 dark:text-rose-400" onClick={() => setOpen(true)}>Delete account…</Button>}
      </div>
      {open && (
        <form onSubmit={remove} className="mt-4 space-y-3">
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            This can't be undone.
            {user?.role === 'senior' && ' Your users will be removed from your team but keep their own expenses.'}
          </p>
          <Field label="Enter your password to confirm">
            <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={busy || !password}>Delete my account</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </Card>
  )
}
