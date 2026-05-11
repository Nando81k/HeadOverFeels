'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Package,
  ChartBar,
  Gift,
  List,
  Users,
  Folders,
  Star,
  Headset,
  CurrencyDollar,
  Lightning,
  Target,
  ShoppingBag,
  Tag,
  Megaphone,
  Heart,
  Pulse,
  EnvelopeSimple,
  Truck,
  Layout,
  CaretRight,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePendingOrders } from '@/lib/hooks/usePendingOrders'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string; weight?: 'bold' | 'regular' | 'fill'; size?: number }>
  badge?: number
}

interface NavGroup {
  title: string
  items: NavItem[]
}

export function AdminMobileNav() {
  const pathname = usePathname()
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const { pendingOrders } = usePendingOrders(30000)

  // Top-level bar — the 4 most frequent destinations + More.
  const mainItems: NavItem[] = [
    { name: 'Home', href: '/admin', icon: Layout },
    { name: 'Fulfill', href: '/admin/fulfillment', icon: Truck, badge: pendingOrders },
    { name: 'Products', href: '/admin/products', icon: Package },
    { name: 'Analytics', href: '/admin/analytics', icon: ChartBar },
  ]

  // Reorganized groups — by user-facing concern, not internal classification.
  // Each group capped at ~5 items so the sheet stays scannable.
  const moreGroups: NavGroup[] = [
    {
      title: 'Commerce',
      items: [
        { name: 'Collections', href: '/admin/collections', icon: Folders },
        { name: 'Reviews', href: '/admin/reviews', icon: Star },
        { name: 'Drops', href: '/admin/drops', icon: Lightning },
      ],
    },
    {
      title: 'Customers',
      items: [
        { name: 'All customers', href: '/admin/customers', icon: Users },
        { name: 'Loyalty', href: '/admin/loyalty', icon: Gift },
        { name: 'Support', href: '/admin/support', icon: Headset },
        { name: 'Abandoned carts', href: '/admin/abandoned-carts', icon: ShoppingBag },
      ],
    },
    {
      title: 'Marketing',
      items: [
        { name: 'Promotions', href: '/admin/promotions', icon: Tag },
        { name: 'Popups', href: '/admin/popups', icon: Megaphone },
        { name: 'Newsletter', href: '/admin/newsletter', icon: EnvelopeSimple },
        { name: 'Goals', href: '/admin/goals', icon: Target },
      ],
    },
    {
      title: 'Reports',
      items: [
        { name: 'Sales', href: '/admin/sales', icon: CurrencyDollar },
        { name: 'Financial', href: '/admin/financial', icon: CurrencyDollar },
        { name: 'Expenses', href: '/admin/expenses', icon: CurrencyDollar },
        { name: 'Live feed', href: '/admin/live-feed', icon: Pulse },
      ],
    },
  ]

  // Flatten all more items for checking if any is active
  const allMoreItems = moreGroups.flatMap((group) => group.items)

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const isMoreActive = allMoreItems.some((item) => isActive(item.href))

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-white/10 z-50 safe-area-pb">
        <div className="flex items-center justify-around h-14 sm:h-16">
          {mainItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all ${
                  active ? 'text-white' : 'text-white/50'
                }`}
              >
                <div className="relative">
                  <Icon
                    size={20}
                    weight={active ? 'fill' : 'bold'}
                    className="sm:w-[22px] sm:h-[22px]"
                  />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] sm:min-w-4 h-[14px] sm:h-4 px-0.5 sm:px-1 flex items-center justify-center text-[9px] sm:text-[10px] font-bold bg-[#FF3131] text-white rounded-full">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 sm:mt-1 tracking-wide">
                  {item.name}
                </span>
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 bg-white rounded-full"
                  />
                )}
              </Link>
            )
          })}

          {/* More Button */}
          <button
            onClick={() => setMoreMenuOpen(true)}
            className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all ${
              isMoreActive ? 'text-white' : 'text-white/50'
            }`}
          >
            <List size={20} weight="bold" className="sm:w-[22px] sm:h-[22px]" />
            <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 sm:mt-1 tracking-wide">More</span>
            {isMoreActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 bg-white rounded-full"
              />
            )}
          </button>
        </div>
      </nav>

      {/* More Menu Overlay */}
      <AnimatePresence>
        {moreMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setMoreMenuOpen(false)}
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed inset-x-0 bottom-0 bg-neutral-900 rounded-t-2xl sm:rounded-t-3xl z-50 max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Handle */}
              <div className="flex justify-center pt-2 sm:pt-3 pb-1 sm:pb-2 shrink-0">
                <div className="w-8 sm:w-10 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-4 sm:px-6 pb-3 sm:pb-4 border-b border-white/10 shrink-0">
                <h3 className="text-base sm:text-lg font-bold text-white">More options</h3>
                <p className="text-[10px] sm:text-xs text-white/40 mt-0.5 tracking-wide uppercase">
                  Browse every admin section
                </p>
              </div>

              {/* Grouped list — vertical rows, easier to read than the old 4-up grid */}
              <div className="overflow-y-auto flex-1 pb-2">
                {moreGroups.map((group, groupIndex) => (
                  <div key={group.title} className={groupIndex > 0 ? 'border-t border-white/5' : ''}>
                    <div className="px-4 sm:px-6 pt-3 sm:pt-4 pb-1.5">
                      <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                        {group.title}
                      </h4>
                    </div>
                    <ul>
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const active = isActive(item.href)

                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setMoreMenuOpen(false)}
                              className={`flex items-center gap-3 px-4 sm:px-6 py-3 transition-all ${
                                active ? 'bg-white/5 text-white' : 'text-white/70 hover:bg-white/3 hover:text-white'
                              }`}
                            >
                              <span className={`flex h-8 w-8 items-center justify-center shrink-0 ${
                                active ? 'bg-white text-black' : 'bg-white/5 text-white/70'
                              }`}>
                                <Icon size={15} weight="bold" />
                              </span>
                              <span className="flex-1 text-sm font-medium">{item.name}</span>
                              {item.badge && item.badge > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-[#FF3131] text-white rounded-full shrink-0">
                                  {item.badge > 9 ? '9+' : item.badge}
                                </span>
                              )}
                              <CaretRight size={12} weight="bold" className="text-white/25 shrink-0" />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Back to Store */}
              <div className="p-3 sm:p-4 border-t border-white/10 safe-area-pb shrink-0">
                <Link
                  href="/"
                  onClick={() => setMoreMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 bg-white/10 text-white rounded-lg sm:rounded-xl text-sm font-medium hover:bg-white/15 transition-all"
                >
                  <Heart size={16} weight="fill" className="text-[#FF3131]" />
                  Back to store
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
