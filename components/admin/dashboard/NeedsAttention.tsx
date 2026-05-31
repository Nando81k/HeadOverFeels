// components/admin/dashboard/NeedsAttention.tsx
'use client'

import { useEffect, useState } from 'react'
import { NeedsAttentionCard } from '@/components/ui/NeedsAttentionCard'
import type { AttentionAlert } from '@/lib/admin/dashboard'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'admin.dashboard.dismissedAlerts'

interface Props {
  initialAlerts: AttentionAlert[]
}

export function NeedsAttention({ initialAlerts }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setDismissed(new Set(JSON.parse(raw)))
    } catch {
      /* sessionStorage unavailable — empty set */
    }
  }, [])

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const visible = initialAlerts.filter((a) => !dismissed.has(a.id))

  return (
    <div className="rounded-[10px] bg-white/[0.025] border border-white/6 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-bold text-white text-[11px]">Needs attention</span>
        {visible.length > 0 && (
          <span className="bg-red-500/15 text-red-500 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
            {visible.length}
          </span>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="text-center text-white/40 text-[11px] py-4">
          <div className="text-emerald-400 text-base mb-1">✓</div>
          All caught up
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((alert) => (
            <div key={alert.id} className="relative">
              <NeedsAttentionCard
                icon={alert.icon}
                title={alert.title}
                description={alert.description}
                urgency={alert.urgency}
                href={alert.href}
              />
              <button
                type="button"
                aria-label={`Dismiss ${alert.title}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  dismiss(alert.id)
                }}
                className={cn(
                  'absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center',
                  'text-white/25 hover:text-white/60 hover:bg-white/[0.06] text-[10px]',
                )}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
