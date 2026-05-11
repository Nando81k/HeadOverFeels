'use client'

import {
  Bell,
  MagnifyingGlass,
  Gear,
  CaretRight,
  SignOut,
  Storefront,
  User,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import RefreshButton from './RefreshButton'

interface AdminHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  onSearchClick?: () => void
}

// Human labels for known admin route segments. Anything not in here falls back
// to a title-cased version of the segment.
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  fulfillment: 'Fulfillment',
  details: 'Details',
  products: 'Products',
  collections: 'Collections',
  orders: 'Orders',
  reviews: 'Reviews',
  customers: 'Customers',
  drops: 'Drops',
  loyalty: 'Loyalty',
  rewards: 'Rewards',
  events: 'Events',
  redemptions: 'Redemptions',
  tiers: 'Tiers',
  settings: 'Settings',
  promotions: 'Promotions',
  popups: 'Popups',
  newsletter: 'Newsletter',
  'live-feed': 'Live feed',
  analytics: 'Analytics',
  financial: 'Financial',
  sales: 'Sales',
  goals: 'Goals',
  expenses: 'Expenses',
  'abandoned-carts': 'Abandoned carts',
  support: 'Support',
  'avatar-items': 'Avatar items',
  new: 'New',
  edit: 'Edit',
}

function isLikelyId(segment: string): boolean {
  // CUIDs start with 'c' and are ~25 chars; UUIDs are 36 chars; numeric IDs are pure digits.
  return (
    (segment.startsWith('c') && segment.length > 18) ||
    /^[0-9a-f-]{20,}$/i.test(segment) ||
    /^\d+$/.test(segment)
  )
}

function labelForSegment(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment]
  if (isLikelyId(segment)) return 'Detail'
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

interface Crumb {
  label: string
  href: string
  current: boolean
}

function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 2) return [] // /admin or /admin/{section} — title alone is enough

  const crumbs: Crumb[] = []
  let path = ''
  segments.forEach((segment, index) => {
    path += `/${segment}`
    crumbs.push({
      label: labelForSegment(segment),
      href: path,
      current: index === segments.length - 1,
    })
  })
  return crumbs
}

export function AdminHeader({ title, subtitle, actions, onSearchClick }: AdminHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signout } = useAuth()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const breadcrumbs = buildBreadcrumbs(pathname || '/admin')

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  const handleSearchClick = () => {
    if (onSearchClick) {
      onSearchClick()
    } else {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      })
      document.dispatchEvent(event)
    }
  }

  const handleSignout = async () => {
    setUserMenuOpen(false)
    await signout()
    router.push('/')
  }

  const initial = (user?.name?.[0] ?? user?.email?.[0] ?? 'A').toUpperCase()

  return (
    <header className="bg-black border-b border-white/10 sticky top-0 z-30 px-3 sm:px-6">
      <div className="h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Title section */}
        <div className="min-w-0 flex-1">
          {breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1 mb-0.5">
              <ol className="flex items-center gap-1 text-[10px] font-medium tracking-[0.12em] uppercase truncate">
                {breadcrumbs.map((crumb, index) => (
                  <li key={crumb.href} className="flex items-center gap-1 min-w-0">
                    {index > 0 && (
                      <CaretRight size={9} weight="bold" className="text-white/25 shrink-0" />
                    )}
                    {crumb.current ? (
                      <span className="text-white/55 truncate" aria-current="page">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="text-white/35 hover:text-white/70 transition-colors truncate"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <h1 className="text-sm sm:text-lg font-bold text-white tracking-tight uppercase truncate">
            {title}
          </h1>
          {subtitle && breadcrumbs.length === 0 && (
            <p className="text-[10px] sm:text-xs text-white/40 mt-0.5 tracking-wide hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions section */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Custom actions */}
          <div className="hidden sm:flex items-center gap-2">{actions}</div>

          {/* Refresh */}
          <RefreshButton />

          {/* Search with keyboard hint (desktop) */}
          <button
            onClick={handleSearchClick}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <MagnifyingGlass size={14} weight="bold" />
            <span className="text-xs text-white/30 group-hover:text-white/50">Search</span>
            <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-white/30 bg-white/5 border border-white/10">
              ⌘K
            </kbd>
          </button>

          {/* Mobile search icon */}
          <button
            onClick={handleSearchClick}
            className="lg:hidden p-1.5 sm:p-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Search"
          >
            <MagnifyingGlass size={16} weight="bold" className="sm:w-[18px] sm:h-[18px]" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-1.5 sm:p-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell size={16} weight="bold" className="sm:w-[18px] sm:h-[18px]" />
              <span className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 w-1.5 h-1.5 bg-[#FF3131]" />
            </button>
          </div>

          {/* User menu (gear + profile, combined into a single dropdown trigger) */}
          <div ref={userMenuRef} className="relative pl-2 sm:pl-4 border-l border-white/10">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-label="Open admin menu"
              className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white flex items-center justify-center text-black font-bold text-[10px] sm:text-xs">
                {initial}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium text-white tracking-wide">
                  {user?.name?.split(' ')[0]?.toUpperCase() || 'ADMIN'}
                </p>
                <p className="text-[10px] text-white/40 tracking-wide">Administrator</p>
              </div>
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 border border-white/10 shadow-xl shadow-black/50 z-40"
              >
                {/* User identity */}
                {user && (
                  <div className="px-4 py-3 border-b border-white/8">
                    <p className="text-xs font-bold text-white truncate">{user.name || 'Admin'}</p>
                    <p className="text-[10px] text-white/45 truncate">{user.email}</p>
                  </div>
                )}

                <ul className="py-1">
                  <li>
                    <Link
                      href="/profile"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-white/75 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <User size={13} weight="bold" />
                      Your profile
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/"
                      role="menuitem"
                      target="_blank"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-white/75 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Storefront size={13} weight="bold" />
                      View public store
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/admin/loyalty/settings"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-white/75 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Gear size={13} weight="bold" />
                      Loyalty settings
                    </Link>
                  </li>
                </ul>

                <div className="border-t border-white/8 py-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors"
                  >
                    <SignOut size={13} weight="bold" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
