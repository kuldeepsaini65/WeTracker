import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../components/Toast'
import { TeamSettingsCard } from '../components/TeamCards'
import { Button, Card, Field, Input } from '../components/ui'
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
    </div>
  )
}
