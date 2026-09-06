'use client'

import * as React from 'react'
import Link from 'next/link'
import { Menu, Search, ShoppingBag, User } from 'lucide-react'
import { AnnouncementBar } from '@/components/storefront/ui/AnnouncementBar'
import { Container } from '@/components/storefront/ui/Container'
import { IconButton } from '@/components/storefront/ui/IconButton'
import { HeaderNav } from '@/components/storefront/layout/HeaderNav'
import { MobileMenu } from '@/components/storefront/layout/MobileMenu'
import type { MenuItem } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/** Scroll distance after which a transparent header takes on its solid surface. */
const SCROLL_THRESHOLD = 24

export interface HeaderProps {
  /** Top-level Shopify menu (`getShopLayout().menu`). */
  menu: MenuItem[]
  /** Line-item count for the cart badge and its accessible name. */
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
            <IconButton label="Search">
              <Search aria-hidden="true" className="size-5" />
            </IconButton>

            <IconButton asChild label="Account">
              <Link href="/account">
                <User aria-hidden="true" className="size-5" />
              </Link>
            </IconButton>

            <IconButton
              label={`Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
              className="relative"
            >
              <ShoppingBag aria-hidden="true" className="size-5" />
              {cartCount > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'num absolute top-1.5 right-1 min-w-4 rounded-pill px-1',
                    'bg-signal text-[10px] leading-4 font-semibold text-signal-ink'
                  )}
                >
                  {cartCount}
                </span>
              ) : null}
            </IconButton>
          </div>
        </Container>
      </header>

      <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} items={menu} />
    </>
  )
}
