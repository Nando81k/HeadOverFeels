import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'
import { AdminMobileNav } from './AdminMobileNav'
import { CommandPalette } from '@/components/ui/CommandPalette'
import AdminReggie from './AdminReggie'

interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  headerActions?: React.ReactNode
  pendingOrders?: number
  contentScroll?: 'auto' | 'hidden'
  contentClassName?: string
}

export function AdminLayoutV1({
  children,
  title, 
  subtitle,
  headerActions,
  pendingOrders,
  contentScroll = 'auto',
  contentClassName = '',
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-950 flex">
      {/* Grain texture overlay */}
      <div 
        className="fixed inset-0 opacity-[0.02] pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Command Palette */}
      <CommandPalette isAdmin />
      
      {/* Sidebar - Hidden on mobile */}
      <div className="hidden lg:block">
        <AdminSidebar pendingOrders={pendingOrders} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header */}
        <AdminHeader 
          title={title} 
          subtitle={subtitle}
          actions={headerActions}
        />

        {/* Page Content - Add bottom padding for mobile nav */}
        <main
          id="main-content"
          className={`flex-1 ${
            contentScroll === 'hidden' ? 'overflow-hidden' : 'overflow-auto'
          } p-3 sm:p-4 lg:p-6 pb-20 sm:pb-24 lg:pb-6 ${contentClassName}`}
        >
          {children}
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <AdminMobileNav />
      
      {/* Reggie AI Assistant - Temporarily Hidden */}
      {/* <AdminReggie /> */}
    </div>
  )
}
