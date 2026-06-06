'use client'

export interface CohortCell {
  signupMonth: string
  orderBucket: '1' | '2-3' | '4-5' | '6+'
  count: number
}

export interface CohortTableProps {
  cells: CohortCell[]
  monthsToShow?: number
}

const BUCKETS: CohortCell['orderBucket'][] = ['1', '2-3', '4-5', '6+']

export function CohortTable({ cells, monthsToShow = 12 }: CohortTableProps) {
  if (cells.length === 0) {
    return <div className="text-xs text-white/40 py-4">No cohort data for this window.</div>
  }

  const months = Array.from(new Set(cells.map((c) => c.signupMonth)))
    .sort()
    .reverse()
    .slice(0, monthsToShow)

  const max = Math.max(...cells.map((c) => c.count), 1)
  const lookup = new Map<string, number>()
  for (const c of cells) lookup.set(`${c.signupMonth}::${c.orderBucket}`, c.count)

  return (
    <div className="overflow-x-auto border border-white/8 rounded-md">
      <table className="w-full text-xs text-left">
        <thead className="bg-white/[0.04] text-white/50">
          <tr>
            <th className="px-3 py-2">Signup month</th>
            {BUCKETS.map((b) => (
              <th key={b} className="px-3 py-2 text-center">
                {b} order{b === '1' ? '' : 's'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-white/80">
          {months.map((m) => (
            <tr key={m} className="border-t border-white/8">
              <td className="px-3 py-2">{m}</td>
              {BUCKETS.map((b) => {
                const v = lookup.get(`${m}::${b}`) ?? 0
                const opacity = max === 0 ? 0 : Math.min(0.6, v / max)
                return (
                  <td
                    key={b}
                    className="px-3 py-2 text-center"
                    style={{ backgroundColor: `rgba(255,49,49,${opacity})` }}
                  >
                    {v === 0 ? '—' : v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
