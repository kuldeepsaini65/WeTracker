import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../components/Toast'
import { Button, CategoryIcon, Field, Input, Modal } from '../components/ui'
import type { Category } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCategories, useDeleteCategory, useSaveCategory } from '../lib/queries'

const COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#65a30d', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#475569']
const ICONS = ['🍔', '☕', '🛒', '🚕', '⛽', '🛍️', '💡', '💊', '🎬', '📦', '🏠', '✈️', '🎁', '📚', '🐶', '👶', '💼', '🏋️', '🍺', '💇', '🔧', '📱', '🎓', '💰']

export function Categories() {
  const { user } = useAuth()
  const { data: categories = [] } = useCategories()
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const canManage = user?.can_manage_categories ?? true

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {canManage
              ? user?.role === 'senior'
                ? 'Your whole team uses these. Keywords let quick add pick the category for you.'
                : 'Keywords let quick add pick the category for you.'
              : `Managed by ${user?.senior?.name ?? 'your senior'} — ask them to add or change one.`}
          </p>
        </div>
        {canManage && <Button onClick={() => setEditing({ icon: '🏷️', color: COLORS[0], keywords: '' })}>
          <Plus className="size-4" /> New
        </Button>}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => canManage && setEditing(c)}
              disabled={!canManage}
              className="group flex w-full items-center gap-3 rounded-2xl border border-zinc-200/70 bg-white p-4 text-left transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
            >
              <CategoryIcon category={c} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.name}</p>
                <p className="truncate text-xs text-zinc-500">{c.keywords || 'No keywords'}</p>
              </div>
              {canManage && <Pencil className="size-4 text-zinc-400 opacity-0 transition group-hover:opacity-100" />}
            </button>
          </li>
        ))}
      </ul>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit category' : 'New category'}>
        {editing && <CategoryForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  )
}

function CategoryForm({ initial, onDone }: { initial: Partial<Category>; onDone(): void }) {
  const toast = useToast()
  const [c, setC] = useState(initial)
  const save = useSaveCategory()
  const del = useDeleteCategory()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(c, { onSuccess: onDone, onError: (err) => toast({ tone: 'error', message: err.message }) })
      }}
    >
      <div className="flex items-center gap-3">
        <CategoryIcon category={{ id: 0, name: c.name ?? '', icon: c.icon ?? '🏷️', color: c.color ?? COLORS[0] }} size="lg" />
        <Input autoFocus required maxLength={50} placeholder="Name" value={c.name ?? ''} onChange={(e) => setC({ ...c, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-zinc-500">Icon</span>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button
              type="button"
              key={i}
              onClick={() => setC({ ...c, icon: i })}
              className={`grid size-10 place-items-center rounded-xl text-lg transition ${c.icon === i ? 'bg-violet-100 ring-2 ring-violet-500 dark:bg-violet-500/20' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-zinc-500">Color</span>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((col) => (
            <button
              type="button"
              key={col}
              aria-label={col}
              onClick={() => setC({ ...c, color: col })}
              className={`size-8 rounded-full transition ${c.color === col ? 'ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-900' : ''}`}
              style={{ backgroundColor: col }}
            />
          ))}
        </div>
      </div>
      <Field label="Keywords" hint="Comma separated. Typing one of these in quick add picks this category.">
        <Input value={c.keywords ?? ''} onChange={(e) => setC({ ...c, keywords: e.target.value })} placeholder="e.g. rent, maintenance" />
      </Field>
      <div className="flex items-center gap-2 pt-2">
        {c.id &&
          (confirmDelete ? (
            <Button type="button" variant="danger" onClick={() => del.mutate(c.id!, { onSuccess: onDone })}>
              Confirm delete
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="text-rose-600 dark:text-rose-400" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ))}
        {confirmDelete && <span className="text-xs text-zinc-500">Its expenses become uncategorized.</span>}
        <Button type="submit" disabled={save.isPending} className="ml-auto min-w-24">Save</Button>
      </div>
    </form>
  )
}
