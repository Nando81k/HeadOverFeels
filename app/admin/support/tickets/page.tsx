'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminLiveChatQueue } from '@/components/admin/support/AdminLiveChatQueue'
import { AdminLiveChatPanel } from '@/components/admin/support/AdminLiveChatPanel'
import { 
  Search, 
  Filter, 
  MessageSquare,
  MessageCircle,
  ChevronLeft,
  ChevronRight 
} from 'lucide-react'

type Ticket = {
  id: string
  ticketNumber: string
  subject: string
  type: string
  status: string
  priority: string
  customerName: string
  customerEmail: string
  aiAssisted: boolean
  createdAt: string
  assignedTo: { name: string } | null
  order: { orderNumber: string } | null
  _count: { messages: number }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'OPEN': return 'bg-blue-100 text-blue-700'
    case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700'
    case 'WAITING_CUSTOMER': return 'bg-purple-100 text-purple-700'
    case 'ESCALATED': return 'bg-red-100 text-red-700'
    case 'RESOLVED': return 'bg-green-100 text-green-700'
    case 'CLOSED': return 'bg-gray-100 text-gray-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'LOW': return 'text-gray-600'
    case 'MEDIUM': return 'text-blue-600'
    case 'HIGH': return 'text-orange-600'
    case 'URGENT': return 'text-red-600'
    default: return 'text-gray-600'
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

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  // Live chat state
  const [activeTab, setActiveTab] = useState<'tickets' | 'queue'>('tickets')
  const [activeChatSession, setActiveChatSession] = useState<string | null>(null)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    async function loadTickets() {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
          ...(searchQuery && { search: searchQuery }),
          ...(statusFilter && { status: statusFilter }),
          ...(typeFilter && { type: typeFilter }),
          ...(priorityFilter && { priority: priorityFilter })
        })

        const response = await fetch(`/api/support/tickets?${params}`)
        const data = await response.json()
        
        setTickets(data.tickets || [])
        setTotalPages(data.totalPages || 1)
      } catch (error) {
        console.error('Failed to fetch tickets:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadTickets()
  }, [searchQuery, statusFilter, typeFilter, priorityFilter, page])

  // Poll for queue count
  useEffect(() => {
    async function loadQueueCount() {
      try {
        const response = await fetch('/api/chat/live/admin/queue')
        const data = await response.json()
        setQueueCount(data.sessions?.length || 0)
      } catch (error) {
        console.error('Failed to load queue count:', error)
      }
    }
    
    loadQueueCount()
    const interval = setInterval(loadQueueCount, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <AdminLayout
      title="Support Tickets"
      subtitle="View and manage all support requests"
      headerActions={
        <Link
          href="/admin/support"
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          ← Back to Dashboard
        </Link>
      }
    >
      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-3 font-medium transition-colors relative ${
            activeTab === 'tickets'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Support Tickets
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-3 font-medium transition-colors relative ${
            activeTab === 'queue'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Live Chat Queue
            {queueCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {queueCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {activeTab === 'tickets' ? (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by ticket number, customer, or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_CUSTOMER">Waiting Customer</option>
              <option value="ESCALATED">Escalated</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="REFUND">Refund</option>
              <option value="RETURN">Return</option>
              <option value="EXCHANGE">Exchange</option>
              <option value="ORDER_ISSUE">Order Issue</option>
              <option value="PRODUCT_QUESTION">Product Question</option>
              <option value="SHIPPING_ISSUE">Shipping Issue</option>
              <option value="PAYMENT_ISSUE">Payment Issue</option>
              <option value="GENERAL">General</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>

            {/* Clear Filters */}
            {(searchQuery || statusFilter || typeFilter || priorityFilter) && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('')
                  setTypeFilter('')
                  setPriorityFilter('')
                  setPage(1)
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

      {/* Tickets Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
          <p className="text-gray-600">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticket
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/support/tickets/${ticket.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {ticket.ticketNumber}
                      </Link>
                      <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                        {ticket.subject}
                      </div>
                      {ticket.aiAssisted && (
                        <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          🤖 AI Assisted
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ticket.customerName}</div>
                      <div className="text-xs text-gray-500">{ticket.customerEmail}</div>
                      {ticket.order && (
                        <div className="text-xs text-blue-600 mt-1">
                          Order: {ticket.order.orderNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getTypeIcon(ticket.type)}</span>
                        <span className="text-sm text-gray-700">
                          {ticket.type.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {ticket.assignedTo?.name || (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <MessageSquare className="w-3 h-3" />
                        {ticket._count.messages}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </>
      ) : (
        <AdminLiveChatQueue 
          onAcceptChat={(sessionId) => setActiveChatSession(sessionId)}
          refreshTrigger={queueCount}
        />
      )}

      {/* Chat Panel Overlay */}
      {activeChatSession && (
        <AdminLiveChatPanel 
          sessionId={activeChatSession}
          onClose={() => {
            setActiveChatSession(null)
            // Refresh queue after closing chat
            setQueueCount(prev => Math.max(0, prev - 1))
          }}
        />
      )}
    </AdminLayout>
  )
}
