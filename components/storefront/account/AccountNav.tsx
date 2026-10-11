'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/storefront/cn'

/**
 * Account navigation (Phase 4 plan, Task 5; mockup boards 02/09).
 *
 * One list, two layouts: a vertical side nav from `lg` up and a horizontally
 * scrollable row of tabs below it. The rows are shared with the header menu
 * (`ACCOUNT_MENU_ITEMS`) and the mobile drawer so every surface agrees on
 * where things live. Sign out is always a POST form — a GET never signs
 * anyone out (see `app/(storefront)/account/logout/route.ts`).
 */

export type AccountNavItem = {
  href: string
  label: string
  /** Match the exact path only (the overview would otherwise own every `/account/*`). */
  exact?: boolean
}

export const ACCOUNT_NAV_ITEMS: readonly AccountNavItem[] = [
  { href: '/account', label: 'Overview', exact: true },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/loyalty', label: 'Care Points' },
  { href: '/wishlist', label: 'Wishlist' },
]

/** The header's compact menu: the rows a signed-in visitor reaches for most. */
export const ACCOUNT_MENU_ITEMS: readonly AccountNavItem[] = ACCOUNT_NAV_ITEMS.filter((item) =>
  ['Overview', 'Orders', 'Care Points', 'Wishlist'].includes(item.label)
)

export const LOGOUT_ACTION = '/account/logout'

export function isActiveAccountPath(pathname: string | null, item: AccountNavItem): boolean {
  if (!pathname) return false
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export interface SignOutFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action' | 'method'> {
  /** Classes for the submit button. */
  buttonClassName?: string
  /** Extra attributes for the submit button (e.g. `role="menuitem"`). */
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
  children?: React.ReactNode
}

/** `<form method="post" action="/account/logout">` with one submit button. */
export function SignOutForm({
  buttonClassName,
  buttonProps,
  children = 'Sign out',
  ...props
}: SignOutFormProps) {
  return (
    <form method="post" action={LOGOUT_ACTION} {...props}>
      <button type="submit" className={buttonClassName} {...buttonProps}>
        {children}
      </button>
    </form>
  )
}

const ROW_CLASS = [
  'inline-flex min-h-11 w-full items-center whitespace-nowrap px-3 text-sm font-medium text-ink-soft',
  'border-b-2 border-transparent lg:border-b-0 lg:border-l-2',
  'transition-colors duration-sf-fast ease-sf-out hover:text-ink',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
].join(' ')

const ACTIVE_ROW_CLASS = 'border-signal text-ink'

export interface AccountNavProps {
  className?: string
}

export function AccountNav({ className }: AccountNavProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Account" className={cn('min-w-0', className)}>
      <ul
        className={cn(
          '-mx-gutter flex gap-1 overflow-x-auto px-gutter pb-px',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0'
        )}
      >
        {ACCOUNT_NAV_ITEMS.map((item) => {
          const active = isActiveAccountPath(pathname, item)
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(ROW_CLASS, active && ACTIVE_ROW_CLASS)}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
        <li className="shrink-0">
          <SignOutForm buttonClassName={cn(ROW_CLASS, 'cursor-pointer bg-transparent')} />
        </li>
      </ul>
    </nav>
  )
}
