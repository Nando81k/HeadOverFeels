import type { Cart } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { formatMoney } from '@/lib/storefront/money'
import { buttonVariants } from '@/components/storefront/ui/Button'

/** Shopify's checkout URL with Shop Pay preselected. */
export function shopPayHref(checkoutUrl: string): string {
  return `${checkoutUrl}${checkoutUrl.includes('?') ? '&' : '?'}payment=shop_pay`
}

/**
 * Only follow a checkout URL that looks like Shopify's: https, and either a
 * Shopify host or the checkout path on the merchant's own domain. Anything
 * else (a malformed value, another scheme) is treated as no checkout link.
 */
export function isSafeCheckoutUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  const shopifyHost =
    host === 'shopify.com' || host.endsWith('.shopify.com') || host.endsWith('.myshopify.com')
  const checkoutPath = /^\/(checkouts|cart\/c)\//.test(url.pathname)
  return shopifyHost || checkoutPath
}

/**
 * Checkout is blocked for an empty cart, while any line is sold out, or when
 * the cart carries no usable checkout URL.
 */
export function isCheckoutBlocked(cart: Cart): boolean {
  return (
    cart.lines.length === 0 ||
    cart.lines.some((line) => !line.merchandise.availableForSale) ||
    !isSafeCheckoutUrl(cart.checkoutUrl)
  )
}

export interface CheckoutButtonsProps {
  cart: Cart
  className?: string
}

const DISABLED = 'pointer-events-none opacity-50'

/**
 * Checkout and Shop Pay are plain links out to Shopify's hosted checkout
 * (`cart.checkoutUrl`). A blocked link loses its `href` (so it is not
 * followable at all) and is announced as a disabled link.
 */
export function CheckoutButtons({ cart, className }: CheckoutButtonsProps) {
  const blocked = isCheckoutBlocked(cart)
  const linkState = blocked
    ? ({ role: 'link', 'aria-disabled': true } as const)
    : ({ rel: 'noopener' } as const)

  return (
    <div data-checkout-buttons="" className={cn('flex flex-col gap-2.5', className)}>
      <a
        href={blocked ? undefined : cart.checkoutUrl}
        {...linkState}
        className={cn(buttonVariants({ variant: 'signal', size: 'lg' }), 'w-full', blocked && DISABLED)}
      >
        Checkout · <span className="num">{formatMoney(cart.cost.total)}</span>
      </a>
      <a
        href={blocked ? undefined : shopPayHref(cart.checkoutUrl)}
        {...linkState}
        aria-label="Buy with Shop Pay"
        className={cn(
          buttonVariants({ size: 'lg' }),
          'w-full bg-shoppay text-signal-ink normal-case tracking-normal hover:bg-shoppay/90',
          blocked && DISABLED
        )}
      >
        <span aria-hidden="true">
          Buy with <b className="font-extrabold tracking-tight">shop</b>Pay
        </span>
      </a>
      <p className="text-center text-xs text-ink-mute">Secure checkout by Shopify</p>
    </div>
  )
}
