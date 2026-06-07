'use client'

import { useState } from 'react'
import { LoyaltySettingsInspector } from '@/components/admin/loyalty/inspectors/LoyaltySettingsInspector'
import type { LoyaltySettingsRow } from '@/lib/admin/loyalty'

export interface LoyaltySettingsButtonProps {
  /** Pre-loaded settings row from the V2 root Suspense boundary. */
  settings: LoyaltySettingsRow
}

/**
 * Tiny client wrapper that owns the inspector open state. The V2 root is a
 * server component, so the settings row is fetched server-side in the
 * <SettingsBtnSlot /> Suspense and handed to this button as a prop.
 */
export function LoyaltySettingsButton({ settings }: LoyaltySettingsButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Loyalty settings"
        title="Loyalty settings"
        className="text-xs px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
      >
        Settings
      </button>
      <LoyaltySettingsInspector
        open={open}
        settings={settings}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
