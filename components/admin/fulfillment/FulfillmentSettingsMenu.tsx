'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FulfillmentQueueType } from '@/lib/fulfillment/queue'

export interface OperatorPrefsLite {
  quickShipMode: boolean
  denseRows: boolean
  defaultLane: FulfillmentQueueType
  defaultCarrier: string
  defaultService: string
}

interface FulfillmentSettingsMenuProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  operatorPrefs: OperatorPrefsLite
  onChangeQuickShip: (value: boolean) => void
  onChangeDenseRows: (value: boolean) => void
  onChangeDefaultLane: (value: FulfillmentQueueType) => void
  onChangeDefaultCarrier: (value: string) => void
  onChangeDefaultService: (value: string) => void
  queueLabels: Record<FulfillmentQueueType, string>
  queueTypes: readonly FulfillmentQueueType[]
}

/**
 * Operator preferences dropdown anchored to a gear-icon button.
 *
 * Replaces the always-visible preferences row that used to sit between the
 * filter bar and the queue. Holds Quick Ship Mode, Dense Rows, Default Lane,
 * Default Carrier, Default Service.
 */
export function FulfillmentSettingsMenu({
  isOpen,
  onClose,
  anchorRef,
  operatorPrefs,
  onChangeQuickShip,
  onChangeDenseRows,
  onChangeDefaultLane,
  onChangeDefaultCarrier,
  onChangeDefaultService,
  queueLabels,
  queueTypes,
}: FulfillmentSettingsMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, anchorRef, onClose])

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="absolute right-0 top-full mt-2 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-white/15 bg-neutral-950 shadow-2xl shadow-black/60 p-4 space-y-3"
        >
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Preferences</p>

          <label className="flex items-center justify-between gap-2 text-xs text-white/85">
            <span>Quick Ship Mode</span>
            <input
              type="checkbox"
              checked={operatorPrefs.quickShipMode}
              onChange={(event) => onChangeQuickShip(event.target.checked)}
              className="h-4 w-4 rounded border border-white/20 bg-white/5"
            />
          </label>

          <label className="flex items-center justify-between gap-2 text-xs text-white/85">
            <span>Dense Rows</span>
            <input
              type="checkbox"
              checked={operatorPrefs.denseRows}
              onChange={(event) => onChangeDenseRows(event.target.checked)}
              className="h-4 w-4 rounded border border-white/20 bg-white/5"
            />
          </label>

          <div className="space-y-1">
            <label className="block text-[10px] uppercase tracking-[0.14em] text-white/45">Default lane</label>
            <select
              value={operatorPrefs.defaultLane}
              onChange={(event) => onChangeDefaultLane(event.target.value as FulfillmentQueueType)}
              className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white"
            >
              {queueTypes.map((queueType) => (
                <option key={queueType} value={queueType} className="bg-neutral-900">
                  {queueLabels[queueType]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-[0.14em] text-white/45">Default carrier</label>
              <input
                value={operatorPrefs.defaultCarrier}
                onChange={(event) => onChangeDefaultCarrier(event.target.value)}
                placeholder="USPS"
                className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-[0.14em] text-white/45">Default service</label>
              <input
                value={operatorPrefs.defaultService}
                onChange={(event) => onChangeDefaultService(event.target.value)}
                placeholder="Priority"
                className="w-full h-9 px-2 rounded-md border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/35"
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
