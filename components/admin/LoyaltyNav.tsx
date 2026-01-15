'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  ChartLine, 
  Users, 
  Lightning, 
  Gift, 
  Star, 
  Gear 
} from '@phosphor-icons/react'

const navItems = [
  { href: '/admin/loyalty', label: 'Overview', icon: ChartLine, exact: true },
  { href: '/admin/loyalty/customers', label: 'Customers', icon: Users },
  { href: '/admin/loyalty/events', label: 'Events', icon: Lightning },
  { href: '/admin/loyalty/rewards', label: 'Rewards', icon: Gift },
  { href: '/admin/loyalty/tiers', label: 'Tiers', icon: Star },
  { href: '/admin/loyalty/settings', label: 'Settings', icon: Gear },
]

export function LoyaltyNav() {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href
    }
    return pathname.startsWith(href) && href !== '/admin/loyalty'
  }

  return (
    <nav className="flex items-center gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = isActive(item.href, item.exact)
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all
              ${active 
                ? 'bg-[#FF3131] text-white shadow-sm' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
              }
            `}
          >
            <Icon size={16} weight={active ? 'fill' : 'bold'} />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
