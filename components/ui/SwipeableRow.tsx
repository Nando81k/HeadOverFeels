// components/ui/SwipeableRow.tsx
'use client'

import { motion, useMotionValue, animate } from 'framer-motion'
import { useRef } from 'react'
import { cn } from '@/lib/utils'

export interface SwipeableRowAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
}

export interface SwipeableRowProps {
  children: React.ReactNode
  rightActions?: SwipeableRowAction[]
  className?: string
}

export function SwipeableRow({ children, rightActions = [], className }: SwipeableRowProps) {
  const x = useMotionValue(0)
  const actionsWidth = rightActions.length * 72 // each action ~72px wide
  const ref = useRef<HTMLDivElement>(null)

  const close = () => animate(x, 0, { type: 'spring', stiffness: 380, damping: 32 })
  const open = () => animate(x, -actionsWidth, { type: 'spring', stiffness: 380, damping: 32 })

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      {/* Action layer (behind) */}
      {rightActions.length > 0 && (
        <div className="absolute top-0 bottom-0 right-0 flex" style={{ width: actionsWidth }}>
          {rightActions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                action.onClick()
                close()
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 text-[10px] font-semibold text-white',
                action.variant === 'destructive' ? 'bg-red-500' : 'bg-white/8',
              )}
              style={{ width: 72 }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
      {/* Foreground row */}
      <motion.div
        drag={rightActions.length > 0 ? 'x' : false}
        dragConstraints={{ left: -actionsWidth, right: 0 }}
        dragElastic={0.15}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -actionsWidth / 2) {
            open()
          } else {
            close()
          }
        }}
        className="bg-[var(--color-surface-base)] relative z-10 touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  )
}
