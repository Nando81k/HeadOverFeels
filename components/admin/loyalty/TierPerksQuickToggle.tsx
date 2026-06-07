'use client'

import { useState, useTransition } from 'react'
import { updateTier } from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

export interface TierPerksRow {
  id: string
  name: string
  primaryColor: string
  freeShipping: boolean
  earlyDropAccess: boolean
  pointMultiplier: number
  sortOrder: number
}

export interface TierPerksQuickToggleProps {
  tiers: TierPerksRow[]
  onChange?: () => void
}

export function TierPerksQuickToggle({ tiers: initialTiers, onChange }: TierPerksQuickToggleProps) {
  const [tiers, setTiers] = useState(initialTiers)
  const [, startTransition] = useTransition()

  const toggle = (id: string, key: 'freeShipping' | 'earlyDropAccess') => {
    const prev = tiers
    const next = tiers.map((t) => (t.id === id ? { ...t, [key]: !t[key] } : t))
    setTiers(next)
    const updated = next.find((t) => t.id === id)
    if (!updated) return
    startTransition(async () => {
      const r = await updateTier(id, { [key]: updated[key] } as Record<string, boolean>)
      if (!r.ok) {
        setTiers(prev)
        toast.error(r.error)
      } else {
        toast.success('Tier updated')
        onChange?.()
      }
    })
  }

  return (
    <div className="space-y-1.5">
      {tiers.length === 0 ? (
        <div className="text-xs text-white/40 py-2">No tiers configured.</div>
      ) : (
        tiers.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/8 rounded-md text-xs text-white/80"
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: t.primaryColor }}
            />
            <span className="flex-1 font-medium">{t.name}</span>
            <span className="text-white/40">{t.pointMultiplier}×</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                aria-label={`${t.name} free shipping`}
                checked={t.freeShipping}
                onChange={() => toggle(t.id, 'freeShipping')}
                className="accent-indigo-500"
              />
              <span>Shipping</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                aria-label={`${t.name} early drop access`}
                checked={t.earlyDropAccess}
                onChange={() => toggle(t.id, 'earlyDropAccess')}
                className="accent-indigo-500"
              />
              <span>Early drops</span>
            </label>
          </div>
        ))
      )}
    </div>
  )
}
