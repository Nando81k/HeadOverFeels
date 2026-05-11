'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowsClockwise, Lightning, Truck } from '@phosphor-icons/react'
import { toast } from '@/lib/toast'

export interface ShippingRateOption {
  id: string
  carrier: string
  service: string
  rate: number
  currency: string
  deliveryDays: number | null
  deliveryDate: string | null
}

interface ShippingRatePickerProps {
  orderId: string
  /** Disabled while a purchase is mid-flight elsewhere. */
  disabled?: boolean
  /** Fired when the operator picks a rate. */
  onChooseRate: (rateId: string, shipmentId: string) => void
  /** Free-text shipping method the customer picked at checkout (e.g. "Priority Mail", "Overnight"). */
  customerShippingMethod?: string | null
  /** Amount the customer paid for shipping at checkout. */
  customerShippingPaid?: number | null
}

const SPEED_LABEL: Record<string, string> = {
  '0': 'Same day',
  '1': 'Overnight',
  '2': '2 days',
  '3': '3 days',
}

function describeSpeed(days: number | null): string {
  if (days === null || days === undefined) return 'Standard'
  if (days <= 0) return 'Same day'
  if (days === 1) return 'Overnight'
  if (days <= 3) return `${days} days`
  return `${days}+ days`
}

function formatDeliveryDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Match the customer's checkout-selected shipping method to a fetched rate.
 *
 * Matching is layered most-specific to least-specific:
 *   1. Exact service equality (case-insensitive, whitespace-stripped)
 *   2. Substring overlap on the service name (handles "Priority" vs "Priority Mail")
 *   3. Speed class — Overnight / Express / 2-Day / 3-Day / Ground — derived from
 *      the customer's free-text label and matched against the rate's deliveryDays
 *
 * Returns the matched rate's id, or null if no rate plausibly matches.
 */
function matchCustomerRate(
  rates: ShippingRateOption[],
  customerMethod?: string | null
): string | null {
  if (!customerMethod) return null
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const target = normalize(customerMethod)
  if (!target) return null

  // Exact normalized service match
  const exact = rates.find((rate) => normalize(rate.service) === target)
  if (exact) return exact.id

  // Substring overlap (either direction)
  const substring = rates.find((rate) => {
    const service = normalize(rate.service)
    return service.includes(target) || target.includes(service)
  })
  if (substring) return substring.id

  // Speed-class hint
  const isOvernight = /(overnight|nextday|next.day|express)/.test(target)
  const isTwoDay = /(2day|twoday|2.day)/.test(target)
  // "Standard" / "Free" shipping at checkout both map to whichever carrier
  // rate is cheapest overall — that's the operator-friendly default and
  // minimizes merchant cost when the customer paid $0 at checkout.
  const isStandardish = /(standard|ground|economy|cheapest|free)/.test(target)

  if (isOvernight) {
    const overnightRate = rates.find((rate) => (rate.deliveryDays ?? 99) <= 1)
    if (overnightRate) return overnightRate.id
  }
  if (isTwoDay) {
    const twoDayRate = rates.find((rate) => rate.deliveryDays === 2)
    if (twoDayRate) return twoDayRate.id
  }
  if (isStandardish) {
    const cheapest = rates.reduce<ShippingRateOption | null>((min, rate) => {
      if (!min) return rate
      return rate.rate < min.rate ? rate : min
    }, null)
    if (cheapest) return cheapest.id
  }

  return null
}

/**
 * Inline rate picker for the "Buy label" timeline step.
 *
 * Auto-fetches available carrier rates from EasyPost on mount, sorts them
 * fastest-first (overnight surfaces above ground), and lets the operator
 * choose a courier + service tier. Selection invokes `onChooseRate` with the
 * EasyPost rateId + shipmentId so the purchase call buys exactly that rate
 * from exactly that shipment.
 */
export function ShippingRatePicker({
  orderId,
  disabled = false,
  onChooseRate,
  customerShippingMethod,
  customerShippingPaid,
}: ShippingRatePickerProps) {
  const [rates, setRates] = useState<ShippingRateOption[]>([])
  const [shipmentId, setShipmentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [liveMode, setLiveMode] = useState<boolean | null>(null)

  const fetchRates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/fulfillment/orders/${orderId}/label/rates`, {
        method: 'POST',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = payload.error || 'Failed to fetch shipping rates'
        setError(message)
        if (Array.isArray(payload.validationErrors) && payload.validationErrors.length > 0) {
          setError(`${message}: ${payload.validationErrors.join('; ')}`)
        }
        return
      }
      setRates(payload.rates || [])
      setShipmentId(payload.shipmentId || null)
    } catch (caught) {
      console.error('Failed to fetch shipping rates:', caught)
      setError(caught instanceof Error ? caught.message : 'Failed to fetch shipping rates')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void fetchRates()
  }, [fetchRates])

  // Resolve once on mount whether the shipping integration is connected to a
  // real carrier network or running on synthetic demo rates. Surfaces as the
  // LIVE / DEMO pill so operators can never confuse the two.
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/fulfillment/shipping/mode')
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled && payload && typeof payload.live === 'boolean') {
          setLiveMode(payload.live)
        }
      })
      .catch(() => {
        // Mode pill is informational; failure shouldn't block the picker.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleChoose = (rate: ShippingRateOption) => {
    if (!shipmentId) {
      toast.error('No shipment id — refresh rates and try again')
      return
    }
    setPurchasingId(rate.id)
    onChooseRate(rate.id, shipmentId)
  }

  if (loading) {
    return (
      <div className="rounded-md border border-white/10 bg-white/5 px-3 py-3 text-[12px] text-white/65">
        Fetching shipping options…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 space-y-2">
        <p className="text-[12px] text-rose-100">{error}</p>
        <button
          type="button"
          onClick={() => void fetchRates()}
          className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
        >
          <ArrowsClockwise className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    )
  }

  if (rates.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] text-white/65">
        No shipping rates available for this address.
      </div>
    )
  }

  const matchedRateId = matchCustomerRate(rates, customerShippingMethod)
  // Surface the customer's chosen rate at the top of the list. Within the
  // remaining rates the existing fastest-first server sort is preserved.
  const sortedRates = matchedRateId
    ? [
        ...rates.filter((rate) => rate.id === matchedRateId),
        ...rates.filter((rate) => rate.id !== matchedRateId),
      ]
    : rates
  const customerPaidLabel =
    typeof customerShippingPaid === 'number' && customerShippingPaid > 0
      ? formatCurrency(customerShippingPaid, 'USD')
      : null

  return (
    <div className="space-y-2">
      {customerShippingMethod ? (
        <div className="rounded-md border border-emerald-500/25 bg-emerald-500/6 px-3 py-2">
          {/* Stack on mobile so the customer's method name has full width
              and never has to truncate; inline at sm+ where there's room. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/15 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-200 shrink-0">
              Checkout pick
            </span>
            <p className="text-[12px] text-white/85 flex-1 min-w-0">
              <span className="text-white">{customerShippingMethod}</span>
              {customerPaidLabel ? <span className="text-white/55"> · paid {customerPaidLabel}</span> : null}
            </p>
            {matchedRateId ? (
              <span className="text-[10px] text-emerald-300 shrink-0">Match found</span>
            ) : (
              <span className="text-[10px] text-amber-300 shrink-0">No exact match</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">
            {rates.length} shipping option{rates.length === 1 ? '' : 's'}
          </p>
          {liveMode === true ? (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/15 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-200"
              title="Connected to EasyPost — real carrier rates and labels"
            >
              Live
            </span>
          ) : liveMode === false ? (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/15 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-200"
              title="Demo mode — synthetic rates, no real charges. Set EASYPOST_API_KEY to go live."
            >
              Demo
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void fetchRates()}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-white/55 hover:text-white disabled:opacity-50"
        >
          <ArrowsClockwise className="w-3 h-3" />
          Refresh
        </button>
      </div>
      {liveMode === false ? (
        <p className="text-[10px] text-amber-200/75">
          Demo mode — clicking Buy creates a mock label with no real carrier charge. Set <code className="px-1 py-0.5 rounded bg-white/10 text-amber-100">EASYPOST_API_KEY</code> to go live.
        </p>
      ) : null}

      <ul className="rounded-md border border-white/10 bg-white/3 divide-y divide-white/5 overflow-hidden">
        {sortedRates.map((rate) => {
          const isOvernight = (rate.deliveryDays ?? Number.POSITIVE_INFINITY) <= 1
          const isPurchasing = purchasingId === rate.id
          const isCustomerChoice = rate.id === matchedRateId
          const eta = formatDeliveryDate(rate.deliveryDate)
          return (
            <li
              key={rate.id}
              className={`px-3 py-2.5 flex items-start gap-3 ${
                isCustomerChoice ? 'bg-emerald-500/8' : ''
              }`}
            >
              <span
                className={`shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md ${
                  isOvernight
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-white/5 text-white/60 border border-white/10'
                }`}
                aria-hidden
              >
                {isOvernight ? <Lightning className="w-4 h-4" weight="fill" /> : <Truck className="w-4 h-4" />}
              </span>

              {/* Label column — gets all remaining horizontal space. Carrier
                  + service truncate independently; badge sits on its own line
                  so it never gets cut off on narrow screens. */}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-white truncate">
                  <span className="font-semibold">{rate.carrier}</span>
                  <span className="text-white/45"> · </span>
                  <span>{rate.service}</span>
                </div>
                <p className="text-[10px] text-white/45 truncate mt-0.5">
                  {describeSpeed(rate.deliveryDays)}
                  {eta ? ` · arrives ${eta}` : ''}
                </p>
                {isCustomerChoice ? (
                  <span className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/15 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-200">
                    Customer&apos;s choice
                  </span>
                ) : SPEED_LABEL[String(rate.deliveryDays)] === 'Overnight' ? (
                  <span className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-300">
                    Fast
                  </span>
                ) : null}
              </div>

              {/* Action column — price + Buy stack vertically so they never
                  fight the label column for horizontal width. */}
              <div className="shrink-0 flex flex-col items-end gap-1.5">
                <p className="text-[13px] font-bold text-white tabular-nums whitespace-nowrap">
                  {formatCurrency(rate.rate, rate.currency)}
                </p>
                <button
                  type="button"
                  onClick={() => handleChoose(rate)}
                  disabled={disabled || Boolean(purchasingId)}
                  className={`h-8 px-3 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-not-allowed ${
                    isPurchasing
                      ? 'bg-white text-black'
                      : 'bg-[#FF3131] text-white hover:bg-[#ff4747]'
                  }`}
                >
                  {isPurchasing ? 'Buying…' : 'Buy'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
