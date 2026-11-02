'use client'

import * as React from 'react'
import { cn } from '@/lib/storefront/cn'
import { IconButton, type IconButtonProps } from '@/components/storefront/ui/IconButton'
import { useWishlistOptional } from './useWishlist'

export interface HeartIconProps extends React.SVGAttributes<SVGSVGElement> {
  filled?: boolean
}

/** Inline stroke heart; `filled` paints it with the current colour. */
export function HeartIcon({ filled = false, className, ...props }: HeartIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-5 shrink-0', className)}
      {...props}
    >
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.3 4.5 6.9 4.5c2 0 3.5 1.1 4.3 2.4.8-1.3 2.3-2.4 4.3-2.4 3.6 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
    </svg>
  )
}

export interface WishlistButtonProps
  extends Omit<IconButtonProps, 'label' | 'children' | 'onClick' | 'type'> {
  variantId: string
  productHandle: string
}

/**
 * The heart (Phase 4, Task 7): a toggle `IconButton` with `aria-pressed`, labelled
 * "Save to wishlist" / "Remove from wishlist", filled once saved.
 *
 * Renders nothing outside a `WishlistProvider`, so it can sit in the PDP buy box
 * and on cards without those surfaces depending on the provider being mounted.
 */
export function WishlistButton({
  variantId,
  productHandle,
  className,
  variant = 'ghost',
  ...props
}: WishlistButtonProps) {
  const wishlist = useWishlistOptional()
  if (!wishlist) return null

  const saved = wishlist.has(variantId)

  return (
    <IconButton
      type="button"
      variant={variant}
      label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      aria-pressed={saved}
      data-wishlist-button=""
      data-saved={saved ? '' : undefined}
      onClick={() => {
        void wishlist.toggle(variantId, productHandle)
      }}
      className={cn(saved && 'text-signal', className)}
      {...props}
    >
      <HeartIcon filled={saved} />
    </IconButton>
  )
}
