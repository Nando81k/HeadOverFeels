// components/ui/BottomActionSheet.tsx
'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface BottomActionSheetAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

export interface BottomActionSheetProps {
  open: boolean
  count: number
  actions: BottomActionSheetAction[]
  onCancel: () => void
  className?: string
}

export function BottomActionSheet({
  open,
  count,
  actions,
  onCancel,
  className,
}: BottomActionSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: '120%' }}
          animate={{ y: 0 }}
          exit={{ y: '120%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className={cn(
            'fixed bottom-0 inset-x-0 z-40 pb-safe',
            'bg-[var(--color-surface-base)] border-t border-[var(--color-border-emphasis)]',
            'shadow-[0_-12px_40px_rgba(0,0,0,0.5)]',
            'backdrop-blur-md',
            className,
          )}
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="text-sm font-semibold text-white flex-shrink-0">
              {count} selected
            </div>
            <div className="flex-1 flex gap-2 justify-end overflow-x-auto">
              {actions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={a.onClick}
                  disabled={a.disabled}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold whitespace-nowrap',
                    a.disabled && 'opacity-40 cursor-not-allowed',
                    a.variant === 'destructive'
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/15'
                      : 'bg-white/[0.05] text-white hover:bg-white/[0.08]',
                  )}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-2 rounded-md text-xs font-semibold text-white/55 hover:text-white hover:bg-white/[0.04]"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
