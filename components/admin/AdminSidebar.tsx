'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Layout, 
  Package, 
  ShoppingCart, 
  Users, 
  Tag, 
  Star, 
  Gift, 
  Lightning, 
  TrendUp, 
  Bag, 
  ChartBar, 
  Wallet, 
  Bell, 
  House, 
  CaretLeft, 
  CaretRight, 
  Headset,
  Percent,
  Megaphone
} from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import { useLiveChatNotifications } from '@/lib/hooks/useLiveChatNotifications'
import { usePendingOrders } from '@/lib/hooks/usePendingOrders'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string; weight?: 'bold' | 'regular' | 'fill' }>
  badge?: number
}

interface AdminSidebarProps {
  pendingOrders?: number // Deprecated - now fetched via hook
}

function NavSection({ 
  title, 
  items,
  collapsed,
  isActive
}: { 
  title: string
  items: NavItem[]
  collapsed: boolean
  isActive: (href: string) => boolean
}) {
  return (
    <div className="mb-8">
      {!collapsed && (
        <h3 className="px-4 mb-3 text-[10px] font-medium tracking-[0.2em] text-white/30 uppercase">
          {title}
        </h3>
      )}
      <nav className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-all
                ${active 
                  ? 'bg-white text-black' 
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? item.name : undefined}
            >
              <div className="flex items-center gap-3">
                <Icon 
                  className={`w-4 h-4 shrink-0 ${active ? 'text-black' : 'text-white/40 group-hover:text-white/70'}`} 
                  weight={active ? 'fill' : 'bold'}
                />
                {!collapsed && (
                  <span className="tracking-wide">{item.name}</span>
                )}
              </div>
              {!collapsed && item.badge && item.badge > 0 && (
                <span className={`
                  px-2 py-0.5 text-[10px] font-bold min-w-5 text-center
                  ${active ? 'bg-black text-white' : 'bg-[#FF3131] text-white'}
                `}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function AdminSidebar({ pendingOrders: _pendingOrdersProp }: AdminSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Live chat notifications
  const { waitingCount } = useLiveChatNotifications(true, 15000) // Poll every 15 seconds
  
  // Pending orders - fetched via hook so it works on all pages
  const { pendingOrders } = usePendingOrders(30000) // Poll every 30 seconds

  useEffect(() => {
    // Read from localStorage after mount to avoid hydration mismatch
    const saved = localStorage.getItem('adminSidebarCollapsed')
    if (saved === 'true') setCollapsed(true)
    // Use a microtask to set mounted to avoid the cascading render warning
    queueMicrotask(() => setMounted(true))
  }, [])

  const toggleCollapsed = () => {
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem('adminSidebarCollapsed', String(newState))
  }

  const navItems: NavItem[] = [
    { name: 'Overview', href: '/admin', icon: Layout },
    { name: 'Products', href: '/admin/products', icon: Package },
    { name: 'Orders', href: '/admin/orders', icon: ShoppingCart, badge: pendingOrders },
    { name: 'Customers', href: '/admin/customers', icon: Users },
    { name: 'Collections', href: '/admin/collections', icon: Tag },
    { name: 'Reviews', href: '/admin/reviews', icon: Star },
    { name: 'Support', href: '/admin/support', icon: Headset, badge: waitingCount },
  ]

  const analyticsItems: NavItem[] = [
    { name: 'Analytics', href: '/admin/analytics', icon: ChartBar },
    { name: 'Financial', href: '/admin/financial', icon: Wallet },
    { name: 'Drops', href: '/admin/drops', icon: Lightning },
    { name: 'Goals', href: '/admin/goals', icon: TrendUp },
    { name: 'Abandoned', href: '/admin/abandoned-carts', icon: Bag },
  ]

  const marketingItems: NavItem[] = [
    { name: 'Promotions', href: '/admin/promotions', icon: Percent },
    { name: 'Popups', href: '/admin/popups', icon: Megaphone },
    { name: 'Loyalty', href: '/admin/loyalty', icon: Gift },
    { name: 'Live Feed', href: '/admin/live-feed', icon: Bell },
  ]

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <>
        <aside className="fixed left-0 top-0 h-screen w-64 bg-black border-r border-white/10 z-40 flex flex-col" />
        <div className="w-64 shrink-0" />
      </>
    )
  }

  return (
    <>
      {/* Sidebar */}
      <aside 
        className={`
          fixed left-0 top-0 h-screen bg-black border-r border-white/10
          transition-all duration-300 ease-out z-40 flex flex-col
          ${collapsed ? 'w-20' : 'w-64'}
        `}
      >
        {/* Grain texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Logo / Brand */}
        <div className="h-16 flex items-center px-4 border-b border-white/10 relative">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white flex items-center justify-center">
                <span className="text-black font-black text-xs">HOF</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-medium tracking-[0.15em] text-white/50 uppercase">Admin</span>
                <span className="text-sm font-bold text-white tracking-tight">HEAD OVER FEELS</span>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 bg-white flex items-center justify-center mx-auto">
              <span className="text-black font-black text-xs">HOF</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-2 relative">
          <NavSection title="Main" items={navItems} collapsed={collapsed} isActive={isActive} />
          <NavSection title="Analytics" items={analyticsItems} collapsed={collapsed} isActive={isActive} />
          <NavSection title="Marketing" items={marketingItems} collapsed={collapsed} isActive={isActive} />
        </div>

        {/* Back to Store */}
        <div className="border-t border-white/10 p-3 relative">
          <Link
            href="/"
            className="group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-white/50 hover:bg-white/5 hover:text-white transition-all"
            title={collapsed ? 'Back to Store' : undefined}
          >
            <House size={18} weight="bold" className="shrink-0" />
            {!collapsed && <span className="tracking-wide">Store</span>}
          </Link>
        </div>

        {/* Collapse Toggle */}
        <div className="border-t border-white/10 p-3 relative">
          <button
            onClick={toggleCollapsed}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white/40 hover:bg-white/5 hover:text-white/70 transition-all"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? (
              <CaretRight size={18} weight="bold" />
            ) : (
              <>
                <CaretLeft size={18} weight="bold" />
                <span className="text-xs tracking-wide">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Spacer for content */}
      <div className={`${collapsed ? 'w-20' : 'w-64'} shrink-0 transition-all duration-300`} />
    </>
  )
}
