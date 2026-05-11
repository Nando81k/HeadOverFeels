'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FulfillmentFilterForm, type FulfillmentFilterFormProps } from './FulfillmentFilterForm'

interface FulfillmentFilterPopoverProps extends FulfillmentFilterFormProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

/**
 * Desktop filter popover anchored below a trigger button.
 *
 * Closes on outside-click and Escape. Width is fixed to prevent layout shift
 * inside the form. Uses framer-motion for the expand/collapse animation; the
 * underlying form is the same one rendered by the mobile sheet.
 */
export function FulfillmentFilterPopover({
  isOpen,
  onClose,
  anchorRef,
  ...formProps
}: FulfillmentFilterPopoverProps) {
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
          className="absolute right-0 top-full mt-2 z-40 w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-white/15 bg-neutral-950 shadow-2xl shadow-black/60 p-4"
        >
          <FulfillmentFilterForm {...formProps} onClose={onClose} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
