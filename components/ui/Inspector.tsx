// components/ui/Inspector.tsx
'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { X } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'

export interface InspectorProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: number
  className?: string
}

export function Inspector({
  open,
  onClose,
  title,
  children,
  width = 420,
  className,
}: InspectorProps) {
  // Escape closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'inspector-title' : undefined}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            style={{ width }}
            className={cn(
              'fixed top-0 right-0 bottom-0 z-50',
              'bg-[var(--color-surface-base)]',
              'border-l border-[var(--color-border-emphasis)]',
              'shadow-[-20px_0_60px_rgba(0,0,0,0.5)]',
              'flex flex-col overflow-hidden',
              'backdrop-blur-md',
              className,
            )}
          >
            <header className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3 flex-shrink-0">
              {title && (
                <h2 id="inspector-title" className="text-sm font-bold text-white">
                  {title}
                </h2>
              )}
              <button
                type="button"
                aria-label="Close inspector"
                onClick={onClose}
                className="ml-auto w-7 h-7 rounded-md hover:bg-white/[0.05] text-white/55 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={14} weight="bold" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
