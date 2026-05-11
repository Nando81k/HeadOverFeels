'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  MessageCircle,
  MessageSquare,
  Search,
  X,
} from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminLiveChatPanel } from '@/components/admin/support/AdminLiveChatPanel'
import { AdminLiveChatQueue } from '@/components/admin/support/AdminLiveChatQueue'
import {
  AdminTicketFilterState,
  buildAdminTicketSearchParams,
  getActiveTicketFilterChips,
} from '@/lib/support/admin-ticket-filters'

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
  order: { id?: string; orderNumber: string } | null
  returnRequested?: boolean
  refundAmount?: number | null
  _count: { messages: number }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'OPEN':
      return 'bg-blue-500/20 text-blue-400'
    case 'IN_PROGRESS':
      return 'bg-amber-500/20 text-amber-400'
    case 'WAITING_CUSTOMER':
      return 'bg-purple-500/20 text-purple-400'
    case 'ESCALATED':
      return 'bg-red-500/20 text-red-400'
    case 'RESOLVED':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'CLOSED':
      return 'bg-white/10 text-white/70'
    default:
      return 'bg-white/10 text-white/70'
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'LOW':
      return 'text-white/55'
    case 'MEDIUM':
      return 'text-blue-300'
    case 'HIGH':
      return 'text-amber-300'
    case 'URGENT':
      return 'text-red-300'
    default:
      return 'text-white/55'
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'REFUND':
      return '💰'
    case 'RETURN':
      return '📦'
    case 'EXCHANGE':
      return '🔄'
    case 'ORDER_ISSUE':
      return '❗'
    case 'PRODUCT_QUESTION':
      return '❓'
    case 'SHIPPING_ISSUE':
      return '🚚'
    case 'PAYMENT_ISSUE':
      return '💳'
    default:
      return '📝'
  }
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [activeTab, setActiveTab] = useState<'tickets' | 'queue'>('tickets')
  const [activeChatSession, setActiveChatSession] = useState<string | null>(null)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch((prev) => {
        const next = searchQuery.trim()
        if (prev !== next) {
          setPage(1)
        }
        return next
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    async function loadTickets() {
      try {
        setLoading(true)
        const params = buildAdminTicketSearchParams(
          {
            search: debouncedSearch,
            status: statusFilter,
            type: typeFilter,
            priority: priorityFilter,
          },
          {
            page,
            limit: 20,
          }
        )

        const response = await fetch(`/api/support/tickets?${params.toString()}`)
        const data = await response.json()

        setTickets(data.tickets || [])
        setTotalPages(Math.max(1, data.pagination?.totalPages || 1))
        setTotalCount(data.pagination?.totalCount || 0)
      } catch (error) {
        console.error('Failed to fetch tickets:', error)
      } finally {
        setLoading(false)
      }
    }

    if (activeTab === 'tickets') {
      loadTickets()
    }
  }, [activeTab, page, debouncedSearch, statusFilter, typeFilter, priorityFilter])

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

  const hasFilters = Boolean(debouncedSearch || statusFilter || typeFilter || priorityFilter)

  const activeFilterPills = useMemo(
    () =>
      getActiveTicketFilterChips({
        search: debouncedSearch,
        status: statusFilter,
        type: typeFilter,
        priority: priorityFilter,
      } satisfies AdminTicketFilterState),
    [debouncedSearch, statusFilter, typeFilter, priorityFilter]
  )

  const clearFilter = (key: string) => {
    setPage(1)
    if (key === 'search') {
      setSearchQuery('')
      setDebouncedSearch('')
    }
    if (key === 'status') setStatusFilter('')
    if (key === 'type') setTypeFilter('')
    if (key === 'priority') setPriorityFilter('')
  }

  const clearAllFilters = () => {
    setSearchQuery('')
    setDebouncedSearch('')
    setStatusFilter('')
    setTypeFilter('')
    setPriorityFilter('')
    setPage(1)
  }

  return (
    <AdminLayout
      title="Support Tickets"
      subtitle="Order-linked support workflow for returns, refunds, and shipping issues"
      headerActions={
        <Link
          href="/admin/support"
          className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white text-xs uppercase tracking-[0.14em]"
        >
          Back to Support
        </Link>
      }
    >
      <div className="mb-4 border-b border-white/10 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-3 text-sm transition-colors border-b-2 ${
            activeTab === 'tickets'
              ? 'border-[#FF3131] text-white'
              : 'border-transparent text-white/60 hover:text-white/80'
          }`}
        >
          Tickets
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-3 text-sm transition-colors border-b-2 ${
            activeTab === 'queue'
              ? 'border-[#FF3131] text-white'
              : 'border-transparent text-white/60 hover:text-white/80'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Live Chat
            {queueCount > 0 ? (
              <span className="h-5 min-w-5 px-1 inline-flex items-center justify-center text-[11px] rounded-full bg-[#FF3131] text-white">
                {queueCount}
              </span>
            ) : null}
          </span>
        </button>
      </div>

      {activeTab === 'tickets' ? (
        <>
          <div className="sticky top-0 z-20 bg-neutral-950/95 backdrop-blur pb-4 mb-4 space-y-3">
            <div className="border border-white/10 rounded-xl bg-neutral-900 p-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(170px,1fr))_auto] lg:items-end">
              <div>
                <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Ticket #, customer, subject, or order #"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#FF3131]/50"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Status</label>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value)
                    setPage(1)
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:border-white/25"
                >
                  <option value="" className="bg-neutral-900">All statuses</option>
                  <option value="OPEN" className="bg-neutral-900">Open</option>
                  <option value="IN_PROGRESS" className="bg-neutral-900">In progress</option>
                  <option value="WAITING_CUSTOMER" className="bg-neutral-900">Waiting customer</option>
                  <option value="ESCALATED" className="bg-neutral-900">Escalated</option>
                  <option value="RESOLVED" className="bg-neutral-900">Resolved</option>
                  <option value="CLOSED" className="bg-neutral-900">Closed</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Type</label>
                <select
                  value={typeFilter}
                  onChange={(event) => {
                    setTypeFilter(event.target.value)
                    setPage(1)
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:border-white/25"
                >
                  <option value="" className="bg-neutral-900">All types</option>
                  <option value="REFUND" className="bg-neutral-900">Refund</option>
                  <option value="RETURN" className="bg-neutral-900">Return</option>
                  <option value="EXCHANGE" className="bg-neutral-900">Exchange</option>
                  <option value="ORDER_ISSUE" className="bg-neutral-900">Order Issue</option>
                  <option value="PRODUCT_QUESTION" className="bg-neutral-900">Product Question</option>
                  <option value="SHIPPING_ISSUE" className="bg-neutral-900">Shipping Issue</option>
                  <option value="PAYMENT_ISSUE" className="bg-neutral-900">Payment Issue</option>
                  <option value="GENERAL" className="bg-neutral-900">General</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(event) => {
                    setPriorityFilter(event.target.value)
                    setPage(1)
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:border-white/25"
                >
                  <option value="" className="bg-neutral-900">All priorities</option>
                  <option value="LOW" className="bg-neutral-900">Low</option>
                  <option value="MEDIUM" className="bg-neutral-900">Medium</option>
                  <option value="HIGH" className="bg-neutral-900">High</option>
                  <option value="URGENT" className="bg-neutral-900">Urgent</option>
                </select>
              </div>

              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/45 mb-2">Results</p>
                <p className="text-sm text-white font-semibold">{totalCount}</p>
              </div>
            </div>

            {activeFilterPills.length > 0 ? (
              <div className="border border-white/10 bg-neutral-900 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2">
                {activeFilterPills.map((pill) => (
                  <span key={pill.key} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/10 border border-white/10 text-xs text-white/80">
                    <span className="uppercase tracking-[0.12em] text-white/50">{pill.label}</span>
                    <span>{pill.value}</span>
                    <button
                      type="button"
                      onClick={() => clearFilter(pill.key)}
                      className="text-white/55 hover:text-white"
                      aria-label={`Remove ${pill.label}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="ml-auto text-xs uppercase tracking-[0.14em] text-white/60 hover:text-white"
                >
                  Clear all
                </button>
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 rounded-full border-b-2 border-[#FF3131] animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="border border-white/10 bg-neutral-900 rounded-xl p-12 text-center">
              <Filter className="w-10 h-10 mx-auto mb-3 text-white/30" />
              <h3 className="text-lg font-semibold text-white mb-2">No Tickets Found</h3>
              <p className="text-sm text-white/55 mb-4">Try adjusting your search or filter criteria.</p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex h-9 items-center px-4 rounded-md border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="border border-white/10 bg-neutral-900 rounded-xl overflow-hidden">
              <div className="hidden lg:block max-h-[68vh] overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-neutral-950">
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Ticket</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Customer</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Type</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Status</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Priority</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Assigned</th>
                      <th className="sticky top-0 bg-neutral-950 px-4 py-3 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3 align-top">
                          <Link href={`/admin/support/tickets/${ticket.id}`} className="text-[#FF3131] font-semibold hover:text-[#ff6f6f] text-sm">
                            {ticket.ticketNumber}
                          </Link>
                          <p className="text-xs text-white/60 mt-1 max-w-sm truncate">{ticket.subject}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {ticket.aiAssisted ? (
                              <span className="inline-flex px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] uppercase tracking-[0.12em]">
                                AI
                              </span>
                            ) : null}
                            {ticket.returnRequested ? (
                              <span className="inline-flex px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] uppercase tracking-[0.12em]">
                                Return Request
                              </span>
                            ) : null}
                            {ticket.refundAmount ? (
                              <span className="inline-flex px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] uppercase tracking-[0.12em]">
                                Refund ${ticket.refundAmount.toFixed(2)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="text-sm text-white">{ticket.customerName}</p>
                          <p className="text-xs text-white/50">{ticket.customerEmail}</p>
                          {ticket.order?.id ? (
                            <Link
                              href={`/admin/fulfillment?orderId=${ticket.order.id}`}
                              className="text-xs text-blue-300 hover:text-blue-200 mt-1 inline-block"
                            >
                              Order: {ticket.order.orderNumber}
                            </Link>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-white/70">
                          <span className="mr-2">{getTypeIcon(ticket.type)}</span>
                          {ticket.type.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`px-2.5 py-1 rounded text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`text-xs uppercase tracking-[0.12em] font-semibold ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-white/65">
                          {ticket.assignedTo?.name || <span className="text-white/35 italic">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-white/50">
                          <p>{new Date(ticket.createdAt).toLocaleDateString()}</p>
                          <p className="inline-flex items-center gap-1 mt-1 text-white/40">
                            <MessageSquare className="w-3 h-3" />
                            {ticket._count.messages}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden divide-y divide-white/10">
                {tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/admin/support/tickets/${ticket.id}`}
                    className="block p-4 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#FF3131]">{ticket.ticketNumber}</p>
                        <p className="text-xs text-white/65 truncate">{ticket.subject}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-2">{ticket.customerName} · {ticket.customerEmail}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-white/45">
                      <span>{getTypeIcon(ticket.type)}</span>
                      <span>{ticket.type.replace('_', ' ')}</span>
                      <span className={getPriorityColor(ticket.priority)}>{ticket.priority}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/45">
                    Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page <= 1}
                      className="h-8 w-8 rounded-md border border-white/10 text-white/65 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages}
                      className="h-8 w-8 rounded-md border border-white/10 text-white/65 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <AdminLiveChatQueue
          onAcceptChat={(sessionId) => setActiveChatSession(sessionId)}
          refreshTrigger={queueCount}
        />
      )}

      {activeChatSession ? (
        <AdminLiveChatPanel
          sessionId={activeChatSession}
          onClose={() => {
            setActiveChatSession(null)
            setQueueCount((prev) => Math.max(0, prev - 1))
          }}
        />
      ) : null}
    </AdminLayout>
  )
}
