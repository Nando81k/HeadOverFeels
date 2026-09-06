'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search, User } from 'lucide-react'
import { Accordion, AccordionItem } from '@/components/storefront/ui/Accordion'
import { Drawer } from '@/components/storefront/ui/Drawer'
import type { MenuItem } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/** Signal dot after the "Drops" row, matching the desktop nav. */
const DROP_TITLE = /drops/i

const LEAF_LINK_CLASS = [
  'flex items-center gap-2 border-b border-line py-4',
  'text-lg font-medium text-ink',
  'transition-colors duration-sf-fast ease-sf-out hover:text-signal',
].join(' ')

const FOOTER_LINK_CLASS = [
  'inline-flex min-h-11 items-center gap-2',
  'text-xs font-semibold uppercase tracking-eyebrow text-ink-soft',
  'transition-colors duration-sf-fast ease-sf-out hover:text-signal',
].join(' ')

export interface MobileMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Same Shopify menu the desktop nav renders. */
  items: MenuItem[]
  /** Where the footer "Account" link points. Defaults to `/account`. */
  accountHref?: string
}

/**
 * Full-height navigation drawer for small screens (spec §5.3).
 *
 * Parents become single-open `<details>` rows (`Accordion` supplies the shared
 * `name`), leaves stay plain links. Every link closes the drawer so the route
 * change is not hidden behind the overlay.
 */
export function MobileMenu({ open, onOpenChange, items, accountHref = '/account' }: MobileMenuProps) {
  const close = () => onOpenChange(false)

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side="left"
      title="Menu"
      footer={
        <div className="flex items-center justify-between gap-4">
          <Link href={accountHref} onClick={close} className={FOOTER_LINK_CLASS}>
            <User aria-hidden="true" className="size-4" />
            Account
          </Link>
          <Link href="/search" onClick={close} className={FOOTER_LINK_CLASS}>
            <Search aria-hidden="true" className="size-4" />
            Search
          </Link>
        </div>
      }
    >
      <nav aria-label="Mobile">
        <Accordion name="mobile-menu" className="border-y-0">
          {items.map((item) =>
            item.items.length > 0 ? (
              <AccordionItem
                key={item.id}
                title={<span className="text-lg font-medium text-ink">{item.title}</span>}
              >
                <ul className="flex flex-col gap-1 pl-1">
                  {item.items.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={child.url}
                        onClick={close}
                        className={cn(
                          'block py-2 text-base text-ink-soft',
                          'transition-colors duration-sf-fast ease-sf-out hover:text-signal'
                        )}
                      >
                        {child.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </AccordionItem>
            ) : (
              <Link key={item.id} href={item.url} onClick={close} className={LEAF_LINK_CLASS}>
                {item.title}
                {DROP_TITLE.test(item.title) ? (
                  <span
                    aria-hidden="true"
                    data-drop-dot=""
                    className="inline-block size-1.5 shrink-0 rounded-pill bg-signal"
                  />
                ) : null}
              </Link>
            )
          )}
        </Accordion>
      </nav>
    </Drawer>
  )
}
