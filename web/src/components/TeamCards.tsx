import { Check, Copy, LogOut, RefreshCw, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { api, type Team, type User } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useTeamAction } from '../lib/queries'
import { useToast } from './Toast'
import { Button, Card, Input } from './ui'

export function inviteLink(code: string) {
  return `${window.location.origin}/?invite=${code}`
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      variant="soft"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          /* clipboard blocked — the code is visible to copy by hand */
        }
      }}
    >
      {done ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
      {done ? 'Copied' : label}
    </Button>
  )
}

/** Seniors: the code users enter to join. */
export function InviteCard({ code }: { code: string }) {
  const toast = useToast()
  const regenerate = useTeamAction(() => api<Team>('/team/regenerate-code/', { method: 'POST' }))
  const [confirm, setConfirm] = useState(false)
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          <UserPlus className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Invite users</p>
          <p className="text-sm text-zinc-500">They enter this code when signing up (or in Settings). You'll see everything they spend.</p>
        </div>
      </div>
      <p className="mt-4 rounded-2xl bg-zinc-100 py-3 text-center font-mono text-2xl font-bold tracking-[0.3em] dark:bg-zinc-800">{code}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={code} label="Copy code" />
        <CopyButton text={inviteLink(code)} label="Copy invite link" />
        {confirm ? (
          <Button
            variant="danger"
            disabled={regenerate.isPending}
            onClick={() =>
              regenerate.mutate(undefined, {
                onSuccess: () => {
                  setConfirm(false)
                  toast({ tone: 'success', message: 'New invite code created. The old one no longer works.' })
                },
              })
            }
          >
            Confirm new code
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setConfirm(true)}>
            <RefreshCw className="size-4" /> New code
          </Button>
        )}
      </div>
      {confirm && <p className="mt-2 text-xs text-zinc-500">The current code stops working. People already on your team stay.</p>}
    </Card>
  )
}

/** Settings card: join a senior / become one / leave. */
export function TeamSettingsCard() {
  const { user } = useAuth()
  const toast = useToast()
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('invite')?.toUpperCase() ?? '')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const join = useTeamAction((c: string) => api<User>('/team/join/', { method: 'POST', json: { code: c } }))
  const leave = useTeamAction(() => api<User>('/team/leave/', { method: 'POST' }))
  const becomeSenior = useTeamAction(() => api<Team>('/team/become-senior/', { method: 'POST' }))
  if (!user) return null

  if (user.role === 'senior') return user.invite_code ? <InviteCard code={user.invite_code} /> : null

  if (user.senior) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 size-5 text-violet-600 dark:text-violet-400" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Part of {user.senior.name}'s team</p>
            <p className="text-zinc-500">
              {user.senior.email} can see your expenses and manages the categories you use.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {confirmLeave ? (
            <>
              <Button
                variant="danger"
                disabled={leave.isPending}
                onClick={() => leave.mutate(undefined, { onSuccess: () => toast({ tone: 'success', message: 'You left the team' }) })}
              >
                Confirm leave
              </Button>
              <Button variant="ghost" onClick={() => setConfirmLeave(false)}>Cancel</Button>
              <span className="text-xs text-zinc-500">You'll get your own default categories back.</span>
            </>
          ) : (
            <Button variant="soft" onClick={() => setConfirmLeave(true)}>
              <LogOut className="size-4" /> Leave team
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <p className="font-semibold">Team</p>
      <p className="mt-1 text-sm text-zinc-500">Join a senior with their invite code, or become a senior and invite your users.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          join.mutate(code.trim(), {
            onSuccess: () => {
              setCode('')
              toast({ tone: 'success', message: 'Joined the team' })
            },
            onError: (err) => toast({ tone: 'error', message: err.message }),
          })
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Invite code"
          maxLength={12}
          className="font-mono tracking-widest uppercase"
        />
        <Button type="submit" disabled={!code.trim() || join.isPending}>Join</Button>
      </form>
      <p className="mt-2 text-xs text-zinc-500">Your expenses move to the senior's categories by name; anything without a match lands in your Inbox.</p>
      <div className="mt-4 border-t border-zinc-200/70 pt-4 dark:border-zinc-800">
        <Button
          variant="ghost"
          className="-ml-2"
          disabled={becomeSenior.isPending}
          onClick={() =>
            becomeSenior.mutate(undefined, {
              onSuccess: () => toast({ tone: 'success', message: "You're a senior now — share your invite code" }),
              onError: (err) => toast({ tone: 'error', message: err.message }),
            })
          }
        >
          <UserPlus className="size-4" /> Become a senior
        </Button>
      </div>
    </Card>
  )
}
