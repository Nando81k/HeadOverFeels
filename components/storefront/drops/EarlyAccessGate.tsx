'use client'

import * as React from 'react'
import { checkEarlyAccessAction } from '@/app/(storefront)/_actions/drops'
import { useCustomerOptional } from '@/components/storefront/account/useCustomer'
import type { StorefrontActionResult } from '@/lib/shopify/types'
import { track } from '@/lib/storefront/analytics'

export type EarlyAccessCheck = (handle: string) => Promise<StorefrontActionResult<{ hasEarlyAccess: boolean }>>

export interface EarlyAccessGateProps {
  /** Product handle the access is checked for. */
  handle: string
  /** The buy box in its locked state — shown until access is confirmed. */
  locked: React.ReactNode
  /** The buy box as a member with early access sees it. */
  unlocked: React.ReactNode
  /** Test seam; defaults to the Server Action. */
  check?: EarlyAccessCheck
  /** Where the sign-in link should come back to. */
  returnTo?: string
}

/**
 * Wraps the buy box of an **upcoming** drop. Everyone starts locked; once the
 * customer context is `ready` the gate asks the server whether this customer
 * holds early access and unlocks the children when it does. A signed-out
 * visitor sees a sign-in line instead. The server re-checks on add, so this is
 * only ever a courtesy unlock.
 *
 * Both views arrive as rendered elements (not a render prop): the page is a
 * Server Component and functions cannot cross into a Client Component.
 */
export function EarlyAccessGate({
  handle,
  locked: lockedView,
  unlocked: unlockedView,
  check = checkEarlyAccessAction,
  returnTo,
}: EarlyAccessGateProps) {
  const customer = useCustomerOptional()
  const status = customer?.status ?? 'unavailable'
  const [access, setAccess] = React.useState<'unknown' | 'granted' | 'denied'>('unknown')

  React.useEffect(() => {
    if (status !== 'ready') {
      setAccess('unknown')
      return
    }
    let cancelled = false
    check(handle).then(
      (result) => {
        if (cancelled) return
        const granted = result.ok && result.data.hasEarlyAccess
        setAccess(granted ? 'granted' : 'denied')
        if (granted) track({ event: 'early_access_unlocked', handle })
      },
      () => {
        if (!cancelled) setAccess('denied')
      }
    )
    return () => {
      cancelled = true
    }
  }, [check, handle, status])

  const locked = access !== 'granted'
  const signInHref = `/account/login?return_to=${encodeURIComponent(returnTo ?? `/products/${handle}`)}`

  return (
    <div data-early-access={access} className="flex flex-col gap-3">
      {locked ? lockedView : unlockedView}
      {access === 'granted' ? (
        <p role="status" className="text-xs text-ink">
          Early access unlocked — this one is yours before everyone else.
        </p>
      ) : status === 'signed-out' ? (
        <p className="text-xs text-ink-mute">
          Early access for members.{' '}
          <a href={signInHref} className="underline underline-offset-2 hover:text-ink">
            Sign in
          </a>{' '}
          to see if you&apos;re in.
        </p>
      ) : access === 'denied' ? (
        <p className="text-xs text-ink-mute">Early access opens for Gold members and reward holders.</p>
      ) : null}
    </div>
  )
}
