import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ExpenseFormModal } from '../components/ExpenseForm'
import { ExpenseList } from '../components/ExpenseList'
import { Button, Card, Chip, Empty, Input } from '../components/ui'
import { useCurrency } from '../lib/auth'
import { money } from '../lib/format'
import { useCategories, useExpenses } from '../lib/queries'

export function Expenses() {
  const currency = useCurrency()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState<number | 'none' | null>(null)
  const [limit, setLimit] = useState(100)
  const [adding, setAdding] = useState(false)
  const { data: categories = [] } = useCategories()

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data, isFetching } = useExpenses({
    search: debounced || undefined,
    category: typeof category === 'number' ? category : undefined,
    uncategorized: category === 'none' ? true : undefined,
    limit,
  })
  const shownTotal = data?.results.reduce((s, e) => s + Number(e.amount), 0) ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
        <Button variant="soft" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Detailed add
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes…" className="pl-10" />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Chip active={category === null} onClick={() => setCategory(null)}>All</Chip>
        <Chip active={category === 'none'} color="#d97706" onClick={() => setCategory('none')}>Uncategorized</Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={category === c.id} color={c.color} onClick={() => setCategory(c.id)}>
            {c.icon} {c.name}
          </Chip>
        ))}
      </div>

      {data && (
        <p className="px-1 text-sm text-zinc-500">
          {data.count} {data.count === 1 ? 'expense' : 'expenses'}
          {data.results.length < data.count ? ` · showing ${data.results.length}` : ''} · {money(shownTotal, currency)}
          {isFetching && ' · updating…'}
        </p>
      )}

      {data?.results.length ? (
        <>
          <ExpenseList expenses={data.results} />
          {data.next && (
            <div className="flex justify-center">
              <Button variant="soft" onClick={() => setLimit((l) => l + 100)}>Load more</Button>
            </div>
          )}
        </>
      ) : (
        data && (
          <Card>
            <Empty icon="🔍" title="No expenses found">Try a different search or filter.</Empty>
          </Card>
        )
      )}
      <ExpenseFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
