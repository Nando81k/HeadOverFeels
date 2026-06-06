'use client'

import { useEffect, useState } from 'react'

interface SaleItem {
  id: string
  orderNumber: string
  customerName: string
  total: number
  itemCount: number
  createdAt: string
  status: string
}

export interface LiveFeedSidebarProps {
  refreshIntervalMs?: number
  maxItems?: number
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function formatTimeAgo(isoStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function LiveFeedSidebar({ refreshIntervalMs = 5000, maxItems = 20 }: LiveFeedSidebarProps) {
  const [sales, setSales] = useState<SaleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchOnce = async () => {
      try {
        const res = await fetch('/api/admin/sales/recent')
        if (!res.ok) return
        const json = (await res.json()) as { sales: SaleItem[] }
        if (cancelled) return
        setSales((json.sales ?? []).slice(0, maxItems))
      } catch {
        // network error — keep current sales
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchOnce()
    const id = setInterval(fetchOnce, refreshIntervalMs)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [refreshIntervalMs, maxItems])

  return (
    <div className="bg-neutral-900/60 border border-white/8 rounded-md">
      {/* Mobile accordion toggle — hidden on sm+ */}
      <button
        type="button"
        className="w-full sm:hidden flex items-center justify-between px-3 py-2 text-xs text-white/60"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span>Live feed</span>
        <span>{expanded ? '−' : '+'}</span>
      </button>

      {/* Content: always visible on sm+, accordion-controlled on mobile */}
      <div className={`${expanded ? 'block' : 'hidden'} sm:block`}>
        {/* Header */}
        <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
          <span className="text-xs font-medium tracking-wide text-white/40 uppercase">Live Feed</span>
          <span className="text-[10px] text-white/30">
            {loading ? 'Loading…' : `${sales.length} order${sales.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Sales list */}
        <ul className="divide-y divide-white/8 max-h-[480px] overflow-y-auto">
          {loading && sales.length === 0 ? (
            <li className="px-3 py-4 text-xs text-white/40">Loading…</li>
          ) : sales.length === 0 ? (
            <li className="px-3 py-4 text-xs text-white/40">No recent sales</li>
          ) : (
            sales.map((s) => (
              <li
                key={s.id}
                className="px-3 py-2 text-xs text-white/80 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">#{s.orderNumber}</div>
                  <div className="text-white/50 truncate">
                    {s.customerName} · {s.itemCount} item{s.itemCount === 1 ? '' : 's'}
                  </div>
                  <div className="text-white/30 mt-0.5">{formatTimeAgo(s.createdAt)}</div>
                </div>
                <div className="ml-3 text-right shrink-0">
                  <div className="font-semibold text-white">{fmt.format(s.total)}</div>
                  <div
                    className={`text-[10px] uppercase tracking-wide mt-0.5 ${
                      s.status === 'CONFIRMED'
                        ? 'text-emerald-400'
                        : s.status === 'PENDING'
                          ? 'text-amber-400'
                          : 'text-white/40'
                    }`}
                  >
                    {s.status}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>

        {/* Footer total */}
        {sales.length > 0 && (
          <div className="px-3 py-2 border-t border-white/8 flex items-center justify-between text-xs">
            <span className="text-white/40">Total ({sales.length})</span>
            <span className="font-semibold text-white">
              {fmt.format(sales.reduce((sum, s) => sum + s.total, 0))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
