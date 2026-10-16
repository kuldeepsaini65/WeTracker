import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { useAuth } from './lib/auth'
import { AuthPage } from './pages/Auth'
import { Categories } from './pages/Categories'
import { Dashboard } from './pages/Dashboard'
import { Expenses } from './pages/Expenses'
import { InboxPage } from './pages/Inbox'
import { DeleteAccountInfoPage, PrivacyPage } from './pages/Legal'
import { SettingsPage } from './pages/Settings'
import { TeamPage } from './pages/Team'

export default function App() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  // Public pages (linked from the Play Store listing) — readable without signing in.
  if (pathname === '/privacy') return <PrivacyPage />
  if (pathname === '/delete-account') return <DeleteAccountInfoPage />
  if (user === undefined)
    return (
      <div className="grid min-h-dvh place-items-center text-violet-600">
        <Spinner className="size-6" />
      </div>
    )
  if (!user) return <AuthPage />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="categories" element={<Categories />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
