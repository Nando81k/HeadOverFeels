'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Search, ShoppingBag, User } from 'lucide-react'
import {
  ACCOUNT_MENU_ITEMS,
  SignOutForm,
} from '@/components/storefront/account/AccountNav'
import {
  customerFirstName,
  customerInitials,
  useCustomerOptional,
  type CustomerContextValue,
} from '@/components/storefront/account/CustomerProvider'
import { AnnouncementBar } from '@/components/storefront/ui/AnnouncementBar'
import { Container } from '@/components/storefront/ui/Container'
import { IconButton } from '@/components/storefront/ui/IconButton'
import { CartBadge, useCartCount } from '@/components/storefront/cart/CartBadge'
import { CartDrawer } from '@/components/storefront/cart/CartDrawer'
import { useCartOptional } from '@/components/storefront/cart/useCart'
import { HeaderNav } from '@/components/storefront/layout/HeaderNav'
import { MobileMenu } from '@/components/storefront/layout/MobileMenu'
import { SearchDialog } from '@/components/storefront/search/SearchDialog'
import type { CustomerSummary, MenuItem } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/** Scroll distance after which a transparent header takes on its solid surface. */
const SCROLL_THRESHOLD = 24

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'

const MENU_ITEM_CLASS = cn(
  'flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-ink',
  'transition-colors duration-sf-fast ease-sf-out hover:bg-rose-tint focus-visible:bg-rose-tint',
  'focus-visible:outline-none'
)

/* ------------------------------------------------------------ account control */

/**
 * Where the account icon sends a visitor who is not signed in:
 * `/account` outside a `CustomerProvider` (SSR fallback, same as the cart
 * badge), `/account/login` otherwise — the gate on `/account` would only add a
 * click. An expired session goes through `/account/refresh` with the current
 * path so it comes straight back here.
 */
export function accountHrefFor(status: CustomerContextValue['status'] | null): string {
  if (status === null || status === 'ready') return '/account'
  return '/account/login'
}

export function refreshHrefFor(pathname: string | null): string {
  return `/account/refresh?return_to=${encodeURIComponent(pathname || '/account')}`
}

function AccountIconLink({ href }: { href: string }) {
  return (
    <IconButton asChild label="Account">
      <Link href={href}>
        <User aria-hidden="true" className="size-5" />
      </Link>
    </IconButton>
  )
}

/** Separate so `usePathname()` only runs in the one state that needs it. */
function ExpiredAccountLink() {
  const pathname = usePathname()
  return <AccountIconLink href={refreshHrefFor(pathname)} />
}

/** Initials chip, shared with the mobile drawer. */
export function InitialsChip({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      data-initials=""
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-ink',
        'text-[11px] font-semibold uppercase tracking-eyebrow text-bone',
        className
      )}
    >
      {initials}
    </span>
  )
}

function AccountMenu({ customer }: { customer: CustomerSummary }) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const id = React.useId()
  const menuId = `${id}-menu`
  const triggerId = `${id}-trigger`

  const items = React.useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    []
  )

  const close = React.useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  // WAI-ARIA menu button: focus lands on the first item when the menu opens.
  React.useEffect(() => {
    if (open) items()[0]?.focus()
  }, [open, items])

  // Outside pointer → close. `pointerdown` so the menu is gone before the
  // outside target handles its own click.
  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, close])

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const list = items()
    if (list.length === 0) return
    const index = list.indexOf(document.activeElement as HTMLElement)
    const focusAt = (next: number) => list[(next + list.length) % list.length]?.focus()
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusAt(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusAt(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusAt(0)
        break
      case 'End':
        event.preventDefault()
        focusAt(list.length - 1)
        break
      case 'Escape':
        event.preventDefault()
        close(true)
        break
      case 'Tab':
        close(false)
        break
      default:
        break
    }
  }

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
    }
  }

  const name = customer.displayName || customerFirstName(customer)

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-label={`Account menu, ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-sharp px-1.5 sm:pr-3',
          'transition-colors duration-sf-fast ease-sf-out hover:bg-rose-tint',
          FOCUS_RING
        )}
      >
        <InitialsChip initials={customerInitials(customer)} />
        <span aria-hidden="true" className="hidden text-sm font-medium sm:inline">
          {customerFirstName(customer)}
        </span>
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute top-full right-0 z-50 mt-2 w-56 py-1',
            'rounded-sharp border border-line bg-paper text-ink shadow-lg'
          )}
        >
          {ACCOUNT_MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              tabIndex={-1}
              onClick={() => close(false)}
              className={MENU_ITEM_CLASS}
            >
              {item.label}
            </Link>
          ))}
          <SignOutForm
            className="border-t border-line"
            buttonClassName={cn(MENU_ITEM_CLASS, 'cursor-pointer bg-transparent')}
            buttonProps={{ role: 'menuitem', tabIndex: -1 }}
          />
        </div>
      ) : null}
    </div>
  )
}

/**
 * The account control for every customer state: a plain icon link while
 * loading / signed out / unavailable, the refresh route when the session has
 * expired, and the initials chip with a `role="menu"` dropdown once ready.
 */
function AccountControl() {
  const account = useCustomerOptional()
  if (!account) return <AccountIconLink href={accountHrefFor(null)} />
  if (account.status === 'expired') return <ExpiredAccountLink />
  if (account.status === 'ready' && account.customer) {
    return <AccountMenu customer={account.customer} />
  }
  return <AccountIconLink href={accountHrefFor(account.status)} />
}

export interface HeaderProps {
  /** Top-level Shopify menu (`getShopLayout().menu`). */
  menu: MenuItem[]
  /**
   * SSR fallback for the cart count. The live count from `CartProvider` wins
   * once it has loaded; this is shown while loading and outside a provider.
   */
  cartCount: number
  /** Sit transparently over a hero until the page scrolls past 24px. */
  transparent?: boolean
  /** Optional promo strip rendered above the header. */
  announcement?: React.ReactNode
}

/**
 * Sticky 64px storefront header (spec §5.3).
 *
 * `transparent` is for pages that open on a full-bleed hero: the bar starts
 * see-through with bone-coloured contents and swaps to the solid surface once
 * `SCROLL_THRESHOLD` is passed. Both states are also published as
 * `data-transparent` / `data-scrolled` so tests and e2e can assert on them
 * without reading class strings.
 */
export function Header({ menu, cartCount, transparent = false, announcement }: HeaderProps) {
  const [scrolled, setScrolled] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const cart = useCartOptional()
  const count = useCartCount(cartCount)
  const account = useCustomerOptional()
  const mobileCustomer = React.useMemo(
    () =>
      account?.status === 'ready' && account.customer
        ? {
            name: account.customer.displayName || customerFirstName(account.customer),
            initials: customerInitials(account.customer),
          }
        : null,
    [account]
  )

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Explicit state classes rather than a `data-[transparent]:not-data-[scrolled]:`
  // compound: the component already holds the state, and one readable ternary
  // beats three stacked variants.
  const floating = transparent && !scrolled

  return (
    <>
      {announcement ? <AnnouncementBar>{announcement}</AnnouncementBar> : null}

      <header
        data-transparent={transparent ? '' : undefined}
        data-scrolled={scrolled ? '' : undefined}
        className={cn(
          'sticky top-0 z-40 h-16 border-b transition-colors duration-sf-base ease-sf-out',
          floating
            ? 'border-transparent bg-transparent text-bone'
            : 'border-line bg-bone/95 text-ink backdrop-blur'
        )}
      >
        <Container className="grid h-full grid-cols-[auto_1fr_auto] items-center gap-4">
          <div className="flex items-center gap-1">
            <IconButton
              label="Open menu"
              className="md:hidden"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
            >
              <Menu aria-hidden="true" className="size-5" />
            </IconButton>

            {/*
              The wordmark is set in type rather than the PNG in `public/assets`:
              that file is black-on-opaque-white, so it would paint a white box on
              the bone header and disappear entirely in the transparent state.
              Type inherits `currentColor` and inverts with the header for free.
            */}
            <Link
              href="/"
              aria-label="Head Over Feels home"
              className={cn(
                'font-display text-base font-black uppercase tracking-display [font-stretch:80%]',
                'leading-none whitespace-nowrap',
                'transition-colors duration-sf-fast ease-sf-out hover:text-signal',
                'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
              )}
            >
              Head Over Feels
            </Link>
          </div>

          <HeaderNav items={menu} className="hidden justify-center md:flex" />

          <div className="flex items-center justify-end gap-0.5">
            <IconButton
              label="Search"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen(true)}
            >
              <Search aria-hidden="true" className="size-5" />
            </IconButton>

            <AccountControl />

            <IconButton
              label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
              className="relative"
              aria-haspopup="dialog"
              aria-expanded={cart?.open ?? false}
              onClick={cart?.openDrawer}
            >
              <ShoppingBag aria-hidden="true" className="size-5" />
              <CartBadge fallbackCount={cartCount} />
            </IconButton>
          </div>
        </Container>
      </header>

      <MobileMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        items={menu}
        accountHref={accountHrefFor(account?.status ?? null)}
        customer={mobileCustomer}
      />
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <CartDrawer />
    </>
  )
}
