import * as React from 'react'
import { formatOrderDate } from '@/components/storefront/account/OrderCard'
import type { CustomerOrder } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/**
 * Shipment timeline for the order page (Phase 4 plan, Task 5; mockup 04).
 *
 * The Customer Account documents expose fulfillments with a status and
 * tracking, not delivery events, so the steps are: placed (always done),
 * shipped (done once a fulfillment exists, with its tracking), delivered
 * (never known here — current once shipped, with a nudge to the carrier). A
 * cancelled order collapses to placed → cancelled.
 */

export type TimelineStepKey = 'placed' | 'shipped' | 'delivered' | 'cancelled'
export type TimelineStepState = 'done' | 'current' | 'pending'

export type TimelineTracking = CustomerOrder['fulfillments'][number]['tracking'][number]

export type TimelineStep = {
  key: TimelineStepKey
  label: string
  /** ISO timestamp when known. */
  at: string | null
  state: TimelineStepState
  detail: string | null
  tracking: TimelineTracking[]
}

function earliest(fulfillments: CustomerOrder['fulfillments']): CustomerOrder['fulfillments'][number] | null {
  const live = fulfillments.filter((f) => f.status !== 'CANCELLED' && f.status !== 'FAILURE' && f.status !== 'ERROR')
  if (live.length === 0) return null
  return [...live].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
}

export function timelineSteps(order: CustomerOrder): TimelineStep[] {
  const placed: TimelineStep = {
    key: 'placed',
    label: 'Order placed',
    at: order.processedAt,
    state: 'done',
    detail: null,
    tracking: [],
  }

  if (order.cancelledAt) {
    return [
      placed,
      {
        key: 'cancelled',
        label: 'Cancelled',
        at: order.cancelledAt,
        state: 'current',
        detail: 'This order was cancelled. Any payment is refunded to the original method.',
        tracking: [],
      },
    ]
  }

  const shipment = earliest(order.fulfillments)
  const tracking = order.fulfillments.flatMap((f) => f.tracking)

  if (!shipment) {
    return [
      placed,
      {
        key: 'shipped',
        label: 'Shipped',
        at: null,
        state: 'current',
        detail: 'We are packing your order. Tracking appears here once it ships.',
        tracking: [],
      },
      { key: 'delivered', label: 'Delivered', at: null, state: 'pending', detail: null, tracking: [] },
    ]
  }

  return [
    placed,
    { key: 'shipped', label: 'Shipped', at: shipment.createdAt, state: 'done', detail: null, tracking },
    {
      key: 'delivered',
      label: 'Delivered',
      at: null,
      state: 'current',
      detail: 'On its way. The carrier link has the live delivery estimate.',
      tracking: [],
    },
  ]
}

function TrackingLine({ tracking }: { tracking: TimelineTracking }) {
  const label = [tracking.company, tracking.number].filter(Boolean).join(' · ')
  if (!label) return null
  return tracking.url ? (
    <a
      href={tracking.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'num font-mono text-xs tabular-nums text-ink underline underline-offset-4 decoration-line-strong',
        'transition-colors duration-sf-fast ease-sf-out hover:text-signal',
        'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
      )}
    >
      {label}
    </a>
  ) : (
    <span className="num font-mono text-xs tabular-nums text-ink">{label}</span>
  )
}

export interface FulfillmentTimelineProps {
  order: CustomerOrder
  className?: string
}

export function FulfillmentTimeline({ order, className }: FulfillmentTimelineProps) {
  const steps = timelineSteps(order)

  return (
    <ol aria-label="Shipment progress" className={cn('flex flex-col', className)}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        return (
          <li
            key={step.key}
            data-step={step.key}
            data-step-state={step.state}
            className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-4 pb-6 last:pb-0"
          >
            {!last ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-5 bottom-0 left-[9px] w-0.5',
                  step.state === 'done' ? 'bg-ink' : 'bg-line'
                )}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 size-5 rounded-pill border-2',
                step.state === 'done' && 'border-ink bg-ink',
                step.state === 'current' && (step.key === 'cancelled' ? 'border-danger bg-danger' : 'border-signal bg-paper'),
                step.state === 'pending' && 'border-line-strong bg-paper'
              )}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    step.state === 'pending' ? 'text-ink-mute' : 'text-ink'
                  )}
                >
                  {step.label}
                </span>
                {step.at ? (
                  <time dateTime={step.at} className="text-xs text-ink-mute">
                    {formatOrderDate(step.at)}
                  </time>
                ) : null}
              </div>
              {step.detail ? <p className="text-xs text-ink-soft">{step.detail}</p> : null}
              {step.tracking.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {step.tracking.map((tracking, i) => (
                    <li key={`${tracking.number ?? ''}-${i}`}>
                      <TrackingLine tracking={tracking} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
