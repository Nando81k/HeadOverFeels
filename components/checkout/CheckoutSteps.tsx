'use client'

import { motion } from 'framer-motion'
import { Check } from '@phosphor-icons/react'
import { useTierAccent } from '@/lib/loyalty/use-tier-accent'

export type CheckoutStepKey = 'shipping' | 'payment' | 'done'

const STEP_ORDER: CheckoutStepKey[] = ['shipping', 'payment', 'done']
const STEP_LABEL: Record<CheckoutStepKey, string> = {
  shipping: 'Details',
  payment: 'Payment',
  done: 'Done',
}

interface CheckoutStepsProps {
  current: CheckoutStepKey
}

/**
 * The three-step bar that runs across the cart → checkout → confirmation
 * journey. Active + completed nodes pick up the customer's loyalty tier
 * color (or pure black for guests) so progress reads as personal.
 */
export function CheckoutSteps({ current }: CheckoutStepsProps) {
  const accent = useTierAccent()
  const currentIndex = STEP_ORDER.indexOf(current)
  const progressPct = (currentIndex / (STEP_ORDER.length - 1)) * 100

  return (
    <div className="flex items-center gap-0">
      {STEP_ORDER.map((stepKey, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isActive = isCompleted || isCurrent

        const circleStyle = isActive ? { backgroundColor: accent.accent } : undefined
        const labelColor = isCurrent
          ? 'text-black'
          : isCompleted
            ? 'text-black/55'
            : 'text-black/35'

        return (
          <div key={stepKey} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                style={circleStyle}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black transition-all ${
                  isActive ? 'text-white' : 'border border-black/20 text-black/35'
                }`}
              >
                {isCompleted ? <Check size={12} weight="bold" /> : index + 1}
              </div>
              <span
                className={`hidden sm:block text-[11px] font-black uppercase tracking-[0.16em] transition-colors ${labelColor}`}
              >
                {STEP_LABEL[stepKey]}
              </span>
            </div>

            {index < STEP_ORDER.length - 1 ? (
              <div className="relative mx-3 h-px w-10 overflow-hidden bg-black/10 sm:w-16 md:w-24">
                <motion.div
                  className="absolute inset-y-0 left-0"
                  style={{ backgroundColor: accent.accent }}
                  initial={{ width: '0%' }}
                  animate={{
                    width: index < currentIndex ? '100%' : '0%',
                  }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                />
              </div>
            ) : null}
          </div>
        )
      })}

      {/* Sr-only progress percentage for assistive tech. */}
      <span className="sr-only">Step {currentIndex + 1} of {STEP_ORDER.length} ({Math.round(progressPct)}% complete)</span>
    </div>
  )
}
