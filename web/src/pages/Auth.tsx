import clsx from 'clsx'
import { useState } from 'react'
import { Button, Field, Input, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { CURRENCIES } from './Settings'

type AccountType = 'personal' | 'join' | 'senior'

const ACCOUNT_TYPES: { value: AccountType; title: string; hint: string }[] = [
  { value: 'personal', title: 'Just me', hint: 'Track your own spending' },
  { value: 'join', title: 'Join a senior', hint: 'I have an invite code' },
  { value: 'senior', title: "I'm a senior", hint: 'Invite users & see their spending' },
]

function inviteFromUrl() {
  return new URLSearchParams(window.location.search).get('invite')?.toUpperCase() ?? ''
}

export function AuthPage() {
  const { login, register } = useAuth()
  const [invite, setInvite] = useState(inviteFromUrl)
  const [mode, setMode] = useState<'login' | 'register'>(invite ? 'register' : 'login')
  const [accountType, setAccountType] = useState<AccountType>(invite ? 'join' : 'personal')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await login(email, password)
      else
        await register({
          email,
          password,
          first_name: name,
          currency,
          account_type: accountType === 'senior' ? 'senior' : 'personal',
          invite_code: accountType === 'join' ? invite.trim() : undefined,
        })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-violet-700 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-fuchsia-500/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-indigo-500/50 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="size-9 rounded-xl ring-2 ring-white/30" />
          <span className="text-xl font-bold">WeTracker</span>
        </div>
        <div className="relative my-auto max-w-md space-y-6">
          <h1 className="text-5xl leading-tight font-bold tracking-tight">Log every expense in two seconds.</h1>
          <p className="text-lg text-violet-100">Type "250 coffee", hit Enter, done. Categories are figured out for you.</p>
          <div className="space-y-2 rounded-2xl bg-white/10 p-4 font-mono text-sm backdrop-blur ring-1 ring-white/20">
            <p><span className="text-violet-300">›</span> 250 coffee <span className="text-violet-300">→ ☕ Coffee & Tea</span></p>
            <p><span className="text-violet-300">›</span> uber 180 <span className="text-violet-300">→ 🚕 Transport</span></p>
            <p><span className="text-violet-300">›</span> 1.2k groceries yesterday <span className="text-violet-300">→ 🛒 Groceries</span></p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="space-y-2 text-center lg:text-left">
            <img src="/favicon.svg" alt="" className="mx-auto size-12 lg:hidden" />
            <h2 className="text-2xl font-bold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="text-sm text-zinc-500">{mode === 'login' ? 'Log in to keep tracking.' : 'Takes 20 seconds. Default categories included.'}</p>
          </div>
          {mode === 'register' && (
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Account type">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={accountType === t.value}
                  onClick={() => setAccountType(t.value)}
                  className={clsx(
                    'rounded-2xl border-2 p-3 text-left transition',
                    accountType === t.value
                      ? 'border-violet-600 bg-violet-50 dark:bg-violet-500/10'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600',
                  )}
                >
                  <span className="block text-sm font-semibold">{t.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-zinc-500">{t.hint}</span>
                </button>
              ))}
            </div>
          )}
          {mode === 'register' && accountType === 'join' && (
            <Field label="Invite code" hint="Your senior will see your expenses and manage your categories.">
              <Input
                required
                value={invite}
                onChange={(e) => setInvite(e.target.value.toUpperCase())}
                maxLength={12}
                placeholder="e.g. K7M2QX9P"
                className="font-mono tracking-widest uppercase"
              />
            </Field>
          )}
          {mode === 'register' && (
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
            </Field>
          )}
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          {mode === 'register' && (
            <Field label="Currency">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          )}
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full py-3">
            {busy && <Spinner />}
            {mode === 'login' ? 'Log in' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-zinc-500">
            {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            <button type="button" className="font-semibold text-violet-600 hover:underline dark:text-violet-400" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </p>
          <p className="text-center text-xs text-zinc-400">
            By continuing you agree to our{' '}
            <a href="/privacy" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">Privacy Policy</a>.
          </p>
        </form>
      </div>
    </div>
  )
}
