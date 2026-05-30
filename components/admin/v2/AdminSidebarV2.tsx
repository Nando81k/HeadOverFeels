// components/admin/v2/AdminSidebarV2.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  SquaresFour as Squares,
  Package,
  Truck,
  Users,
  Star,
  Megaphone,
  ChartBar,
  Lifebuoy,
  ArrowSquareOut,
} from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: typeof Squares
  badgeKey?: 'pendingOrders'
  liveDotKey?: 'activeDrops'
}

const navItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: Squares },
  { href: '/admin/products', label: 'Products & Drops', icon: Package, liveDotKey: 'activeDrops' },
  { href: '/admin/fulfillment', label: 'Fulfillment', icon: Truck, badgeKey: 'pendingOrders' },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/loyalty', label: 'Loyalty', icon: Star },
  { href: '/admin/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/admin/analytics', label: 'Analytics', icon: ChartBar },
  { href: '/admin/support', label: 'Support', icon: Lifebuoy },
]

export interface AdminSidebarV2Props {
  pendingOrders?: number
  activeDrops?: number
  userName?: string
  userRole?: string
}

export function AdminSidebarV2({
  pendingOrders = 0,
  activeDrops = 0,
  userName = 'Admin',
  userRole = 'ADMIN',
}: AdminSidebarV2Props) {
  const pathname = usePathname() ?? ''
  const counts = { pendingOrders, activeDrops }

  return (
    <aside className="w-[180px] flex-shrink-0 bg-white/[0.02] border-r border-[var(--color-border-subtle)] backdrop-blur-xl flex flex-col py-4 px-3">
      {/* Logo */}
      <Link href="/admin" className="flex items-center gap-2 mb-5 px-1.5">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500 to-red-400 shadow-[0_0_20px_rgba(255,49,49,0.3)]" />
        <div>
          <div className="font-bold text-white text-xs leading-tight tracking-[-0.01em]">
            Head Over Feels
          </div>
          <div className="text-[9px] text-white/45">Admin</div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
          const badge = item.badgeKey ? counts[item.badgeKey] : undefined
          const liveDot = item.liveDotKey ? counts[item.liveDotKey] : undefined
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all',
                'text-[11px]',
                isActive
                  ? 'bg-red-500/8 text-white shadow-[inset_0_0_0_1px_rgba(255,49,49,0.2),0_0_16px_rgba(255,49,49,0.08)]'
                  : 'text-white/55 hover:text-white hover:bg-white/[0.03]',
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={14} weight={isActive ? 'fill' : 'duotone'} />
                <span>{item.label}</span>
              </span>
              {badge != null && badge > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {badge}
                </span>
              )}
              {liveDot != null && liveDot > 0 && (
                <span className="text-red-500 text-xs leading-none">●</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--color-border-subtle)] pt-2.5 mt-2 space-y-1">
        <div className="px-2 py-1.5 flex items-center gap-2 text-[10px]">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-red-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-white/85 font-semibold truncate">{userName}</div>
            <div className="text-[8px] text-white/40 uppercase tracking-wider">{userRole}</div>
          </div>
        </div>
        <Link
          href="/"
          className="px-2 py-1.5 flex items-center gap-2 text-[10px] text-white/45 hover:text-white/70"
        >
          <ArrowSquareOut size={12} />
          Back to store
        </Link>
      </div>
    </aside>
  )
}
