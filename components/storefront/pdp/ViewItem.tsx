'use client'

import * as React from 'react'
import { track } from '@/lib/storefront/analytics'
import type { DropState } from '@/lib/storefront/drops'

export interface ViewItemProps {
  handle: string
  title: string
  price: { amount: string; currencyCode: string }
  variantId?: string | null
  dropState?: DropState | null
}

/**
 * Fires `view_item` once per product page view (Phase 5, Task 4). Renders
 * nothing. Keyed by handle so a client-side move between products fires again
 * while a variant swap on the same page does not.
 */
export function ViewItem({ handle, title, price, variantId, dropState }: ViewItemProps) {
  React.useEffect(() => {
    track({
      event: 'view_item',
      handle,
      title,
      price: Number(price.amount),
      currency: price.currencyCode,
      variantId: variantId ?? undefined,
      dropState: dropState ?? undefined,
    })
    if (dropState) track({ event: 'drop_view', handle, state: dropState })
    // Intentionally once per product: the variant in the URL is a detail of the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle])

  return null
}
