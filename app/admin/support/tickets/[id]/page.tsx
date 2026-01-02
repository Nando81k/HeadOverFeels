'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  ArrowLeft,
  Clock,
  User,
  Mail,
  Package,
  DollarSign,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'

type Message = {
  id: string
  message: string
  senderType: string
  senderName: string
  createdAt: string
  isInternal: boolean
}

type Ticket = {
  id: string
  ticketNumber: string
  subject: string
  type: string
  status: string
  priority: string
  customerName: string
  customerEmail: string
  customerId: string | null
  orderId: string | null
  orderNumber: string | null
  refundAmount: number | null
  refundReason: string | null
  returnRequested: boolean
  returnApproved: boolean | null
  aiAssisted: boolean
  aiSummary: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  resolution: string | null
  assignedTo: { id: string; name: string } | null
  customer: { id: string; name: string; email: string } | null
  order: { id: string; orderNumber: string; total: number } | null
  messages: Message[]
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
    case 'LOW': return 'text-gray-600 bg-gray-100'
    case 'MEDIUM': return 'text-blue-600 bg-blue-100'
    case 'HIGH': return 'text-orange-600 bg-orange-100'
    case 'URGENT': return 'text-red-600 bg-red-100'
    default: return 'text-gray-600 bg-gray-100'
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

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    async function loadTicket() {
      try {
        const response = await fetch(`/api/support/tickets/${resolvedParams.id}`)
        const data = await response.json()
        setTicket(data.data)
      } catch (error) {
        console.error('Failed to fetch ticket:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTicket()
  }, [resolvedParams.id])

  async function fetchTicket() {
    try {
      const response = await fetch(`/api/support/tickets/${resolvedParams.id}`)
      const data = await response.json()
      setTicket(data.data)
    } catch (error) {
      console.error('Failed to fetch ticket:', error)
    }
  }

  async function sendMessage() {
    if (!message.trim()) return

    try {
      setSending(true)
      const response = await fetch(`/api/support/tickets/${resolvedParams.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          senderType: 'admin',
          senderName: 'Support Team', // TODO: Get from admin session
          isInternal,
        }),
      })

      if (response.ok) {
        setMessage('')
        setIsInternal(false)
        await fetchTicket() // Refresh ticket
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  async function updateStatus(newStatus: string) {
    try {
      setUpdatingStatus(true)
      const response = await fetch(`/api/support/tickets/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        await fetchTicket()
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      alert('Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <AdminLayout
        title="Ticket Not Found"
        subtitle="The requested ticket could not be found"
      >
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ticket Not Found</h2>
          <p className="text-gray-600 mb-4">The ticket you&apos;re looking for doesn&apos;t exist.</p>
          <Link
            href="/admin/support"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Support Dashboard
          </Link>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title={ticket.ticketNumber}
      subtitle={ticket.subject}
      headerActions={
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(ticket.status)}`}>
            {ticket.status.replace('_', ' ')}
          </span>
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
            {ticket.priority}
          </span>
        </div>
      }
    >
      <Link
        href="/admin/support/tickets"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tickets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Details */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Ticket Details</h2>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getTypeIcon(ticket.type)}</span>
                <span className="text-sm text-gray-600">{ticket.type.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Customer</div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium">{ticket.customerName}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{ticket.customerEmail}</span>
                </div>
              </div>

              {ticket.order && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Order</div>
                  <Link
                    href={`/admin/orders/${ticket.orderId}`}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <Package className="w-4 h-4" />
                    <span className="text-sm font-medium">{ticket.orderNumber}</span>
                  </Link>
                  <div className="text-sm text-gray-600 mt-1">
                    ${ticket.order.total.toFixed(2)}
                  </div>
                </div>
              )}

              {ticket.refundAmount && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Refund Amount</div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">${ticket.refundAmount.toFixed(2)}</span>
                  </div>
                  {ticket.refundReason && (
                    <div className="text-sm text-gray-600 mt-1">{ticket.refundReason}</div>
                  )}
                </div>
              )}

              <div>
                <div className="text-sm text-gray-600 mb-1">Created</div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{new Date(ticket.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {ticket.aiAssisted && (
              <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🤖</span>
                  <span className="text-sm font-medium text-purple-900">AI Assisted</span>
                </div>
                {ticket.aiSummary && (
                  <p className="text-sm text-purple-800">{ticket.aiSummary}</p>
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
            </div>

            <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
              {ticket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-4 ${msg.isInternal ? 'bg-yellow-50 -mx-6 px-6 py-4' : ''}`}
                >
                  <div className="shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      msg.senderType === 'customer' ? 'bg-blue-100' :
                      msg.senderType === 'admin' ? 'bg-green-100' :
                      'bg-purple-100'
                    }`}>
                      {msg.senderType === 'customer' ? '👤' : 
                       msg.senderType === 'admin' ? '👨‍💼' : '🤖'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{msg.senderName}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                      {msg.isInternal && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded">
                          Internal Note
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply Box */}
            {ticket.status !== 'CLOSED' && (
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your response..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <div className="flex items-center justify-between mt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Internal note (customer won&apos;t see)</span>
                  </label>
                  <button
                    onClick={sendMessage}
                    disabled={sending || !message.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending...' : 'Send Response'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {ticket.status === 'OPEN' && (
                <button
                  onClick={() => updateStatus('IN_PROGRESS')}
                  disabled={updatingStatus}
                  className="w-full px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Start Working
                </button>
              )}
              {(ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') && (
                <button
                  onClick={() => updateStatus('WAITING_CUSTOMER')}
                  disabled={updatingStatus}
                  className="w-full px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Wait for Customer
                </button>
              )}
              {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                <button
                  onClick={() => updateStatus('RESOLVED')}
                  disabled={updatingStatus}
                  className="w-full px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark as Resolved
                </button>
              )}
              {ticket.status === 'RESOLVED' && (
                <button
                  onClick={() => updateStatus('CLOSED')}
                  disabled={updatingStatus}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Close Ticket
                </button>
              )}
            </div>
          </div>

          {/* Return/Refund Actions */}
          {ticket.returnRequested && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Return Request</h2>
              <div className="space-y-3">
                {ticket.returnApproved === null && (
                  <>
                    <button className="w-full px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-lg font-medium transition-colors">
                      Approve Return
                    </button>
                    <button className="w-full px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-medium transition-colors">
                      Deny Return
                    </button>
                  </>
                )}
                {ticket.returnApproved === true && (
                  <div className="text-sm">
                    <div className="text-green-700 font-medium mb-2">✓ Return Approved</div>
                    <button className="w-full px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg font-medium transition-colors">
                      Generate Return Label
                    </button>
                  </div>
                )}
                {ticket.returnApproved === false && (
                  <div className="text-sm text-red-700 font-medium">✗ Return Denied</div>
                )}
              </div>
            </div>
          )}

          {/* Ticket Stats */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ticket Stats</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Messages</span>
                <span className="font-medium flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  {ticket.messages.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Created</span>
                <span className="font-medium">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Updated</span>
                <span className="font-medium">
                  {new Date(ticket.updatedAt).toLocaleDateString()}
                </span>
              </div>
              {ticket.resolvedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Resolved</span>
                  <span className="font-medium text-green-600">
                    {new Date(ticket.resolvedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
