import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Change this to a mailbox you actually read — it's shown publicly and on the Play Store listing.
export const CONTACT_EMAIL = 'support@wetrackers.website'
const UPDATED = '16 October 2026'

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <article className="mx-auto max-w-2xl space-y-5 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
        <Link to="/" className="flex items-center gap-2.5 text-zinc-900 dark:text-white">
          <img src="/favicon.svg" alt="" className="size-8" />
          <span className="text-lg font-bold">WeTracker</span>
        </Link>
        <h1 className="pt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{title}</h1>
        <p className="text-sm text-zinc-500">Last updated: {UPDATED}</p>
        {children}
      </article>
    </div>
  )
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-3 text-lg font-semibold text-zinc-900 dark:text-white">{children}</h2>
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        WeTracker ("we") is an expense tracker available on the web at wetrackers.website and as an Android app. This
        policy explains what we collect, why, and the choices you have.
      </p>

      <H2>What we collect</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>Account details</b>: your name (optional), email address and password. Passwords are stored only as a secure hash.</li>
        <li><b>Expenses you add</b>: amount, note, category, date and time.</li>
        <li><b>Settings</b>: currency, monthly budget, your categories and their keywords.</li>
        <li><b>Team membership</b>: if you join a senior with an invite code, or invite users as a senior.</li>
      </ul>
      <p>
        We do <b>not</b> collect your location, contacts, photos, device identifiers or payment information, and the app
        contains no ads or third-party analytics.
      </p>

      <H2>How we use it</H2>
      <p>
        Only to run WeTracker: to sign you in, store and sync your expenses across your devices, suggest categories,
        and show your totals and charts. We do not sell or rent your data, and we do not share it with advertisers.
      </p>

      <H2>Who can see your data</H2>
      <p>
        Only you, unless you join a <b>senior</b>. If you join a senior's team with their invite code, that senior can
        see the expenses you add while you are on their team. You can leave the team at any time in Settings.
      </p>

      <H2>Storage and security</H2>
      <p>
        Your data is stored on our servers and sent over encrypted HTTPS connections. The Android app may keep
        expenses on your phone briefly when you are offline, until they are synced.
      </p>

      <H2>Keeping and deleting your data</H2>
      <p>
        We keep your data while your account exists. You can delete your account and all its data at any time — see{' '}
        <Link to="/delete-account" className="font-medium text-violet-600 underline dark:text-violet-400">Delete your account</Link>.
        Deletion is permanent and takes effect immediately.
      </p>

      <H2>Children</H2>
      <p>WeTracker is not directed at children under 13 and we do not knowingly collect their data.</p>

      <H2>Changes and contact</H2>
      <p>
        If this policy changes, we will update the date above. Questions or requests:{' '}
        <span className="font-medium text-zinc-900 dark:text-white">{CONTACT_EMAIL}</span>
      </p>
    </LegalLayout>
  )
}

export function DeleteAccountInfoPage() {
  return (
    <LegalLayout title="Delete your WeTracker account">
      <p>You can permanently delete your WeTracker account and all data linked to it at any time.</p>

      <H2>In the Android app</H2>
      <p>Open WeTracker → <b>Settings</b> → <b>Delete account</b>, enter your password and confirm.</p>

      <H2>On the web</H2>
      <p>
        <Link to="/settings#delete" className="font-medium text-violet-600 underline dark:text-violet-400">Sign in</Link>, open{' '}
        <b>Settings</b> → <b>Delete account</b>, enter your password and confirm.
      </p>

      <H2>What gets deleted</H2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your account (name, email, password).</li>
        <li>All your expenses, categories and settings.</li>
        <li>If you're a senior: your team is closed. Your users keep their own expenses and get their own categories back.</li>
      </ul>
      <p>Deletion happens immediately and cannot be undone. We do not keep copies of deleted data.</p>

      <H2>Can't sign in?</H2>
      <p>
        Email <span className="font-medium text-zinc-900 dark:text-white">{CONTACT_EMAIL}</span> from the address on your
        account and we will delete it within 7 days.
      </p>
    </LegalLayout>
  )
}
