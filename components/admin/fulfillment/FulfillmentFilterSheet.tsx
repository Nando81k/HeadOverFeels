'use client'

import { useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { FulfillmentFilterForm, type FulfillmentFilterFormProps } from './FulfillmentFilterForm'

interface FulfillmentFilterSheetProps extends FulfillmentFilterFormProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Mobile bottom sheet wrapper around FulfillmentFilterForm.
 *
 * Slides up from the bottom edge, with a translucent scrim above. Body scroll
 * is locked while open. Dismisses on Escape or scrim click. Sheet body is
 * scrollable so long forms don't overflow on small viewports.
 */
export function FulfillmentFilterSheet({
  isOpen,
  onClose,
  ...formProps
}: FulfillmentFilterSheetProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] flex flex-col rounded-t-2xl border-t border-white/15 bg-neutral-950 shadow-2xl shadow-black/70"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="text-sm font-bold text-white tracking-tight">Filters</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close filters"
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <FulfillmentFilterForm {...formProps} onClose={onClose} />
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
