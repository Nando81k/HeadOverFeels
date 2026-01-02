import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'
import { CommandPalette } from '@/components/ui/CommandPalette'
import AdminReggie from './AdminReggie'

interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  headerActions?: React.ReactNode
  pendingOrders?: number
}

export function AdminLayout({ 
  children, 
  title, 
  subtitle,
  headerActions,
  pendingOrders 
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
      
      {/* Sidebar */}
      <AdminSidebar pendingOrders={pendingOrders} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header */}
        <AdminHeader 
          title={title} 
          subtitle={subtitle}
          actions={headerActions}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
      
      {/* Reggie AI Assistant */}
      <AdminReggie />
    </div>
  )
}
