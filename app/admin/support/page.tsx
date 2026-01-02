import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LiveChatSection } from '@/components/admin/LiveChatSection'
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare,
  TrendingUp,
  Ticket
} from 'lucide-react'

// Prevent static prerendering - this page uses dynamic data
export const dynamic = 'force-dynamic'

async function getTicketStats() {
  const [
    openCount,
    inProgressCount,
    resolvedTodayCount,
    totalCount
  ] = await Promise.all([
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.supportTicket.count({
      where: {
        status: 'RESOLVED',
        resolvedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    }),
    prisma.supportTicket.count()
  ])

  return {
    open: openCount,
    inProgress: inProgressCount,
    resolvedToday: resolvedTodayCount,
    total: totalCount,
    avgResolutionHours: 24 // Placeholder
  }
}

async function getRecentTickets() {
  return await prisma.supportTicket.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: {
        select: {
          name: true,
          email: true
        }
      },
      order: {
        select: {
          orderNumber: true
        }
      },
      assignedTo: {
        select: {
          name: true
        }
      },
      _count: {
        select: {
          messages: true
        }
      }
    }
  })
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  trendLabel 
}: { 
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  trend?: number
  trendLabel?: string
}) {
  return (
    <div className="bg-neutral-900 p-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-white/5 border border-white/10">
          <Icon className="w-6 h-6 text-white/70" />
        </div>
        {trend !== undefined && (
          <div className={`text-sm font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-white/70">{title}</div>
      {trendLabel && (
        <div className="text-xs text-white/40 mt-1">{trendLabel}</div>
      )}
    </div>
  )
}

function getStatusColor(status: string) {
  switch (status) {
    case 'OPEN': return 'bg-blue-500/20 text-blue-400'
    case 'IN_PROGRESS': return 'bg-amber-500/20 text-amber-400'
    case 'WAITING_CUSTOMER': return 'bg-purple-500/20 text-purple-400'
    case 'ESCALATED': return 'bg-red-500/20 text-red-400'
    case 'RESOLVED': return 'bg-emerald-500/20 text-emerald-400'
    case 'CLOSED': return 'bg-white/10 text-white/70'
    default: return 'bg-white/10 text-white/70'
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'LOW': return 'text-white/50'
    case 'MEDIUM': return 'text-blue-400'
    case 'HIGH': return 'text-amber-400'
    case 'URGENT': return 'text-red-400'
    default: return 'text-white/50'
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'REFUND': return '💰'
    case 'RETURN': return '📦'
    case 'EXCHANGE': return '🔄'
    case 'ORDER_ISSUE': return '❗'
    case 'PRODUCT_QUESTION': return '❓'
    case 'SHIPPING_ISSUE': return '🚚'
    case 'PAYMENT_ISSUE': return '💳'
    default: return '📝'
  }
}

async function SupportDashboard() {
  const [stats, tickets] = await Promise.all([
    getTicketStats(),
    getRecentTickets()
  ])

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Open Tickets"
          value={stats.open}
          icon={AlertCircle}
          trend={-5}
          trendLabel="vs last week"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={Clock}
          trend={12}
          trendLabel="vs last week"
        />
        <StatCard
          title="Resolved Today"
          value={stats.resolvedToday}
          icon={CheckCircle2}
          trend={8}
          trendLabel="vs yesterday"
        />
        <StatCard
          title="Avg Resolution Time"
          value={`${stats.avgResolutionHours}h`}
          icon={TrendingUp}
          trend={-10}
          trendLabel="vs last month"
        />
      </div>

      {/* Live Chat Section */}
      <LiveChatSection />

      {/* Quick Actions */}
      <div className="bg-neutral-900 p-6 border border-white/10">
        <h2 className="text-sm font-medium tracking-[0.1em] text-white uppercase mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/support?status=OPEN"
            className="flex items-center gap-3 p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/30 transition-colors"
          >
            <Ticket className="w-5 h-5 text-blue-400" />
            <div>
              <div className="font-medium text-white">View Open Tickets</div>
              <div className="text-sm text-blue-400">{stats.open} pending</div>
            </div>
          </Link>
          <Link
            href="/admin/support?status=IN_PROGRESS"
            className="flex items-center gap-3 p-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/30 transition-colors"
          >
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <div className="font-medium text-white">In Progress</div>
              <div className="text-sm text-amber-400">{stats.inProgress} active</div>
            </div>
          </Link>
          <Link
            href="/admin/support?priority=URGENT"
            className="flex items-center gap-3 p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 transition-colors"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <div className="font-medium text-white">Urgent Tickets</div>
              <div className="text-sm text-red-400">Needs attention</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="bg-neutral-900 border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium tracking-[0.1em] text-white uppercase">Recent Tickets</h2>
            <Link
              href="/admin/support/tickets"
              className="text-sm text-[#FF3131] hover:text-[#E02828] font-medium"
            >
              View All →
            </Link>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                  Ticket
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                  Assigned
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-white/5">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/admin/support/tickets/${ticket.id}`}
                      className="text-sm font-medium text-[#FF3131] hover:text-[#E02828]"
                    >
                      {ticket.ticketNumber}
                    </Link>
                    <div className="text-xs text-white/40 mt-1 max-w-xs truncate">
                      {ticket.subject}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white">
                      {ticket.customer?.name || ticket.customerName}
                    </div>
                    <div className="text-xs text-white/40">
                      {ticket.customer?.email || ticket.customerEmail}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getTypeIcon(ticket.type)}</span>
                      <span className="text-sm text-white/70">
                        {ticket.type.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                    {ticket.assignedTo?.name || (
                      <span className="text-white/30 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/40">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                    <div className="flex items-center gap-1 mt-1 text-xs text-white/30">
                      <MessageSquare className="w-3 h-3" />
                      {ticket._count.messages}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function SupportPage() {
  return (
    <AdminLayout
      title="Support Tickets"
      subtitle="Manage customer support requests, refunds, returns, and inquiries"
    >
      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-12 w-12 border-b-2 border-white"></div>
        </div>
      }>
        <SupportDashboard />
      </Suspense>
    </AdminLayout>
  )
}
