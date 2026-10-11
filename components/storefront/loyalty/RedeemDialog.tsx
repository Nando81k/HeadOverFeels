'use client'

import * as React from 'react'
import Link from 'next/link'
import { redeemRewardAction } from '@/app/(storefront)/_actions/loyalty'
import { useCartOptional } from '@/components/storefront/cart/CartProvider'
import { Button } from '@/components/storefront/ui/Button'
import { Dialog } from '@/components/storefront/ui/Dialog'
import type { RedeemResult, RewardView } from '@/lib/loyalty/shopify-bridge'
import type { Cart, LoyaltyActionResult } from '@/lib/shopify/types'
import { CopyButton } from './CopyButton'
import { formatDate, formatPoints } from './format'

export type RedeemOutcome = RedeemResult & { cart: Cart | null }
export type RedeemAction = (input: { rewardId: string; idempotencyKey: string }) => Promise<LoyaltyActionResult<RedeemOutcome>>

const GENERIC_ERROR = 'Something went wrong. Please try again.'

/** One key per open: a retry inside the same dialog is the same redemption. */
function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

type Phase = 'confirm' | 'pending' | 'success' | 'error'

export interface RedeemDialogProps {
  reward: RewardView | null
  /** The balance before the spend, for the "balance after" line. */
  balance: number
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fires once per successful redemption with the action's data. */
  onRedeemed?: (data: RedeemOutcome, reward: RewardView) => void
  /** Inject a fake (tests). Defaults to the Server Action. */
  redeem?: RedeemAction
}

/**
 * Confirm → `redeemRewardAction` → code (board 06). The returned cart is
 * pushed into the layout's `CartProvider` so the drawer and badge show the
 * discount without a refetch; outside a provider that step is skipped.
 */
export function RedeemDialog({ reward, balance, open, onOpenChange, onRedeemed, redeem }: RedeemDialogProps) {
  const cart = useCartOptional()
  const [phase, setPhase] = React.useState<Phase>('confirm')
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<RedeemOutcome | null>(null)
  const keyRef = React.useRef<string>('')
  const codeFieldRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    keyRef.current = newIdempotencyKey()
    setPhase('confirm')
    setError(null)
    setResult(null)
  }, [open, reward?.id])

  const submit = async () => {
    if (!reward) return
    setPhase('pending')
    setError(null)
    const run = redeem ?? redeemRewardAction
    let outcome: LoyaltyActionResult<RedeemOutcome>
    try {
      outcome = await run({ rewardId: reward.id, idempotencyKey: keyRef.current })
    } catch {
      outcome = { ok: false, error: GENERIC_ERROR }
    }
    if (!outcome.ok) {
      setError(outcome.error || GENERIC_ERROR)
      setPhase('error')
      return
    }
    if (outcome.data.cart && cart) cart.seed(outcome.data.cart)
    setResult(outcome.data)
    setPhase('success')
    onRedeemed?.(outcome.data, reward)
  }

  const close = () => onOpenChange(false)
  const after = reward ? Math.max(0, balance - reward.pointsCost) : balance
  const hasCode = Boolean(result && result.code.length > 0)

  const title = phase === 'success' ? (hasCode ? 'Your code' : "You're in") : 'Redeem reward'

  const footer =
    phase === 'success' ? (
      <div className="flex flex-wrap justify-end gap-2">
        {result?.cart ? (
          <Button asChild variant="outline">
            <Link href="/cart">View cart</Link>
          </Button>
        ) : hasCode ? (
          <Button asChild variant="outline">
            <Link href="/collections/all">Shop now</Link>
          </Button>
        ) : null}
        <Button onClick={close}>Done</Button>
      </div>
    ) : (
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={phase === 'pending'}>
          Cancel
        </Button>
        <Button onClick={submit} loading={phase === 'pending'} disabled={!reward}>
          {phase === 'error' ? 'Try again' : 'Confirm'}
        </Button>
      </div>
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} size="sm" footer={footer}>
      {reward && phase !== 'success' ? (
        <div className="flex flex-col gap-3 text-sm text-ink">
          <p className="m-0 text-base font-semibold">
            Spend <span className="num">{formatPoints(reward.pointsCost)}</span> points on {reward.name}?
          </p>
          {reward.description ? <p className="m-0 text-ink-soft">{reward.description}</p> : null}
          <p className="m-0 text-ink-soft">
            Balance after: <span className="num font-semibold text-ink">{formatPoints(after)}</span>
          </p>
          {reward.type === 'EARLY_ACCESS' ? (
            <p className="m-0 text-xs text-ink-mute">Early access is added to your account — no code to enter.</p>
          ) : (
            <p className="m-0 text-xs text-ink-mute">
              Your code is single-use, tied to your account and valid for 90 days.
            </p>
          )}
          {error ? (
            <p role="alert" className="m-0 rounded-sharp border border-danger bg-paper px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase === 'success' && result ? (
        <div className="flex flex-col gap-4 text-sm text-ink">
          {hasCode ? (
            <>
              <p className="num m-0 text-2xl font-semibold tracking-wide">{result.code}</p>
              <input
                ref={codeFieldRef}
                readOnly
                aria-label="Your discount code"
                value={result.code}
                className="sr-only"
                tabIndex={-1}
              />
              <p className="m-0 text-ink-soft">
                {result.cart ? 'Applied to your cart.' : 'Enter it at checkout.'}
                {result.expiresAt ? ` Valid until ${formatDate(result.expiresAt)}.` : ''}
              </p>
              <CopyButton value={result.code} fallbackRef={codeFieldRef} className="self-start" />
            </>
          ) : (
            <p className="m-0 text-ink-soft">Early access is on your account. We&apos;ll email you before the drop.</p>
          )}
          <p className="m-0 text-xs text-ink-mute">
            New balance: <span className="num font-semibold text-ink">{formatPoints(result.newBalance)}</span>
          </p>
        </div>
      ) : null}
    </Dialog>
  )
}
