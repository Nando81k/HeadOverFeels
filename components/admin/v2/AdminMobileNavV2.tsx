// components/admin/v2/AdminMobileNavV2.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Package,
  Truck,
  ChartBar,
  Megaphone,
  DotsThree,
  SquaresFour as Squares,
  Users,
  Star,
  Lifebuoy,
  ArrowSquareOut,
} from '@phosphor-icons/react/dist/ssr'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { cn } from '@/lib/utils'

interface Tab {
  href: string
  label: string
  icon: typeof Package
  badgeKey?: 'pendingOrders'
  liveDotKey?: 'activeDrops'
}

const bottomTabs: Tab[] = [
  { href: '/admin/products', label: 'Products', icon: Package, liveDotKey: 'activeDrops' },
  { href: '/admin/fulfillment', label: 'Fulfill', icon: Truck, badgeKey: 'pendingOrders' },
  { href: '/admin/analytics', label: 'Analytics', icon: ChartBar },
  { href: '/admin/marketing', label: 'Marketing', icon: Megaphone },
]

const moreItems = [
  { href: '/admin', label: 'Dashboard', icon: Squares },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/loyalty', label: 'Loyalty', icon: Star },
  { href: '/admin/support', label: 'Support', icon: Lifebuoy },
]

export interface AdminMobileNavV2Props {
  pendingOrders?: number
  activeDrops?: number
}

export function AdminMobileNavV2({ pendingOrders = 0, activeDrops = 0 }: AdminMobileNavV2Props) {
  const pathname = usePathname() ?? ''
  const [moreOpen, setMoreOpen] = useState(false)
  const counts = { pendingOrders, activeDrops }

  return (
    <>
      <nav
        className={cn(
          'lg:hidden fixed bottom-0 inset-x-0 z-30',
          'h-[60px] pb-safe',
          'border-t border-[var(--color-border-subtle)]',
          'bg-white/[0.025] backdrop-blur-xl',
          'flex',
        )}
      >
        {bottomTabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          const Icon = tab.icon
          const badge = tab.badgeKey ? counts[tab.badgeKey] : undefined
          const liveDot = tab.liveDotKey ? counts[tab.liveDotKey] : undefined
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 relative',
                isActive ? 'text-white' : 'text-white/45',
              )}
            >
              {isActive && (
                <span className="absolute top-0.5 w-6 h-0.5 bg-red-500 rounded-b-full shadow-[0_0_6px_rgba(255,49,49,0.6)]" />
              )}
              <Icon size={18} weight={isActive ? 'fill' : 'duotone'} />
              <span className="text-[9px] font-semibold">{tab.label}</span>
              {badge != null && badge > 0 && (
                <span className="absolute top-1.5 right-4 bg-red-500 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
              {liveDot != null && liveDot > 0 && (
                <span className="absolute top-3 right-5 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_5px_rgba(255,49,49,0.7)]" />
              )}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-white/45"
        >
          <DotsThree size={18} weight="bold" />
          <span className="text-[9px] font-semibold">More</span>
        </button>
      </nav>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="space-y-1">
          {moreItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-md text-white/85 hover:bg-white/[0.04] active:bg-white/[0.06]"
              >
                <Icon size={18} weight="duotone" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
          <div className="h-px bg-[var(--color-border-subtle)] my-2" />
          <Link
            href="/"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-3 py-3 rounded-md text-white/55 hover:bg-white/[0.04]"
          >
            <ArrowSquareOut size={18} />
            <span className="text-sm font-medium">Back to store</span>
          </Link>
        </div>
      </BottomSheet>
    </>
  )
}
