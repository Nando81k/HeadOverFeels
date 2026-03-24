'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Package, 
  ShoppingCart, 
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
  Truck
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

  const mainItems: NavItem[] = [
    { name: 'Fulfill', href: '/admin/fulfillment', icon: Truck, badge: pendingOrders },
    { name: 'Products', href: '/admin/products', icon: Package },
    { name: 'Analytics', href: '/admin/analytics', icon: ChartBar },
  ]

  const moreGroups: NavGroup[] = [
    {
      title: 'Sales & Marketing',
      items: [
        { name: 'Drops', href: '/admin/drops', icon: Lightning },
        { name: 'Promotions', href: '/admin/promotions', icon: Tag },
        { name: 'Popups', href: '/admin/popups', icon: Megaphone },
        { name: 'Newsletter', href: '/admin/newsletter', icon: EnvelopeSimple },
        { name: 'Goals', href: '/admin/goals', icon: Target },
      ]
    },
    {
      title: 'Legacy Ops',
      items: [
        { name: 'Orders', href: '/admin/orders', icon: ShoppingCart, badge: pendingOrders },
        { name: 'All Customers', href: '/admin/customers', icon: Users },
        { name: 'Support', href: '/admin/support', icon: Headset },
        { name: 'Loyalty', href: '/admin/loyalty', icon: Gift },
        { name: 'Abandoned', href: '/admin/abandoned-carts', icon: ShoppingBag },
      ]
    },
    {
      title: 'Content',
      items: [
        { name: 'Collections', href: '/admin/collections', icon: Folders },
        { name: 'Reviews', href: '/admin/reviews', icon: Star },
      ]
    },
    {
      title: 'Reports',
      items: [
        { name: 'Financial', href: '/admin/financial', icon: CurrencyDollar },
        { name: 'Live Feed', href: '/admin/live-feed', icon: Pulse },
      ]
    },
  ]

  // Flatten all more items for checking if any is active
  const allMoreItems = moreGroups.flatMap(group => group.items)

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const isMoreActive = allMoreItems.some(item => isActive(item.href))

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
                  <Icon size={20} weight={active ? 'fill' : 'bold'} className="sm:w-[22px] sm:h-[22px]" />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] sm:min-w-4 h-[14px] sm:h-4 px-0.5 sm:px-1 flex items-center justify-center text-[9px] sm:text-[10px] font-bold bg-[#FF3131] text-white rounded-full">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] sm:text-[10px] font-medium mt-0.5 sm:mt-1 tracking-wide">{item.name}</span>
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
              className="lg:hidden fixed inset-x-0 bottom-0 bg-neutral-900 rounded-t-2xl sm:rounded-t-3xl z-50 max-h-[85vh] overflow-hidden"
            >
              {/* Handle */}
              <div className="flex justify-center pt-2 sm:pt-3 pb-1 sm:pb-2">
                <div className="w-8 sm:w-10 h-1 bg-white/20 rounded-full" />
              </div>
              
              {/* Header */}
              <div className="px-4 sm:px-6 pb-3 sm:pb-4 border-b border-white/10">
                <h3 className="text-base sm:text-lg font-bold text-white">More Options</h3>
              </div>
              
              {/* Grouped Menu */}
              <div className="overflow-y-auto max-h-[60vh]">
                {moreGroups.map((group, groupIndex) => (
                  <div key={group.title} className={groupIndex > 0 ? 'border-t border-white/5' : ''}>
                    <div className="px-4 sm:px-6 pt-3 sm:pt-4 pb-2">
                      <h4 className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-white/40">
                        {group.title}
                      </h4>
                    </div>
                    <div className="px-3 sm:px-4 pb-2">
                      <div className="grid grid-cols-4 gap-1 sm:gap-2">
                        {group.items.map((item) => {
                          const Icon = item.icon
                          const active = isActive(item.href)
                          
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMoreMenuOpen(false)}
                              className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all ${
                                active 
                                  ? 'bg-white text-black' 
                                  : 'bg-white/5 text-white/70 hover:bg-white/10 active:bg-white/15'
                              }`}
                            >
                              <Icon size={20} weight={active ? 'fill' : 'bold'} className="sm:w-6 sm:h-6" />
                              <span className="text-[9px] sm:text-[10px] font-medium mt-1 sm:mt-1.5 text-center leading-tight line-clamp-1">{item.name}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Back to Store */}
              <div className="p-3 sm:p-4 border-t border-white/10 safe-area-pb">
                <Link
                  href="/"
                  onClick={() => setMoreMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 bg-white/10 text-white rounded-lg sm:rounded-xl text-sm font-medium hover:bg-white/15 transition-all"
                >
                  <Heart size={16} weight="fill" className="text-[#FF3131]" />
                  Back to Store
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
