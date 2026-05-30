// components/admin/v2/AdminLayoutV2.tsx
import { AdminSidebarV2 } from './AdminSidebarV2'
import { AdminHeaderV2 } from './AdminHeaderV2'
import { AdminMobileNavV2 } from './AdminMobileNavV2'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { cn } from '@/lib/utils'

export interface AdminLayoutV2Props {
  children: React.ReactNode
  title: string
  subtitle?: string
  headerActions?: React.ReactNode
  pendingOrders?: number
  activeDrops?: number
  userName?: string
  userRole?: string
  contentScroll?: 'auto' | 'hidden'
  contentClassName?: string
}

export function AdminLayoutV2({
  children,
  title,
  subtitle,
  headerActions,
  pendingOrders = 0,
  activeDrops = 0,
  userName,
  userRole,
  contentScroll = 'auto',
  contentClassName = '',
}: AdminLayoutV2Props) {
  return (
    <div
      className="min-h-screen flex relative"
      style={{
        background: 'linear-gradient(135deg, #0d0d12 0%, #16161d 100%)',
      }}
    >
      {/* Grain texture overlay (preserve from V1) */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none z-0"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <CommandPalette isAdmin />

      {/* Desktop sidebar */}
      <div className="hidden lg:block relative z-10">
        <AdminSidebarV2
          pendingOrders={pendingOrders}
          activeDrops={activeDrops}
          userName={userName}
          userRole={userRole}
        />
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <AdminHeaderV2 title={title} subtitle={subtitle} actions={headerActions} />

        <main
          className={cn(
            'flex-1',
            contentScroll === 'hidden' ? 'overflow-hidden' : 'overflow-auto',
            'p-3 sm:p-4 lg:p-6',
            'pb-[76px] lg:pb-6', // room for mobile bottom nav
            contentClassName,
          )}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <AdminMobileNavV2 pendingOrders={pendingOrders} activeDrops={activeDrops} />
    </div>
  )
}
