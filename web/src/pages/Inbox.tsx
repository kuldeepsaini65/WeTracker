import { useMemo, useState } from 'react'
import { ExpenseList } from '../components/ExpenseList'
import { useToast } from '../components/Toast'
import { Button, Card, Chip, Empty } from '../components/ui'
import { useBulkCategorize, useCategories, useExpenses } from '../lib/queries'

/** Uncategorized expenses: select some (or all), tap a category, done. */
export function InboxPage() {
  const toast = useToast()
  const { data } = useExpenses({ uncategorized: true, limit: 200 })
  const { data: categories = [] } = useCategories()
  const bulk = useBulkCategorize()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const items = useMemo(() => data?.results ?? [], [data])

  // When nothing is selected, a category tap applies to the first (most recent) expense — so you can triage one by one.
  const target = selected.size ? [...selected] : items.length ? [items[0].id] : []

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const apply = (categoryId: number) => {
    const cat = categories.find((c) => c.id === categoryId)
    bulk.mutate(
      { ids: target, category: categoryId },
      {
        onSuccess: (r) => {
          toast({ tone: 'success', message: `${r.updated} moved to ${cat?.icon} ${cat?.name}` })
          setSelected(new Set())
        },
        onError: (e) => toast({ tone: 'error', message: e.message }),
      },
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Expenses saved without a category. Select a few, then tap a category — or just tap a category to file the top one.
        </p>
      </div>

      {items.length === 0 && data ? (
        <Card>
          <Empty icon="🎉" title="All sorted!">Every expense has a category.</Empty>
        </Card>
      ) : (
        <>
          <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 space-y-3 border-b border-zinc-200/70 bg-zinc-50/90 px-4 py-3 backdrop-blur-xl md:top-0 md:mx-0 md:rounded-2xl md:border dark:border-zinc-800 dark:bg-zinc-950/90">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {selected.size ? `${selected.size} selected` : items.length ? 'Filing the top expense' : ''}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => setSelected(new Set(items.map((e) => e.id)))}>Select all</Button>
                {selected.size > 0 && <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => setSelected(new Set())}>Clear</Button>}
              </div>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
              {categories.map((c) => (
                <Chip key={c.id} disabled={bulk.isPending || !target.length} onClick={() => apply(c.id)}>
                  {c.icon} {c.name}
                </Chip>
              ))}
            </div>
          </div>
          <ExpenseList expenses={items} selectable selected={selected} onToggle={toggle} />
        </>
      )}
    </div>
  )
}
