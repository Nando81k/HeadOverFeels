'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  Mail,
  MessageSquare,
  Package,
  Send,
  User,
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { toast } from '@/lib/toast'

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
  returnLabel: string | null
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
      return 'text-white/55 bg-white/10'
    case 'MEDIUM':
      return 'text-blue-300 bg-blue-500/15'
    case 'HIGH':
      return 'text-amber-300 bg-amber-500/15'
    case 'URGENT':
      return 'text-red-300 bg-red-500/15'
    default:
      return 'text-white/55 bg-white/10'
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

export default function TicketDetailPage() {
  const params = useParams()
  const ticketId = params.id as string
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingReturn, setUpdatingReturn] = useState(false)
  const [labeling, setLabeling] = useState(false)

  const loadTicket = async () => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`)
      const data = await response.json()
      setTicket(data.data)
    } catch (error) {
      console.error('Failed to fetch ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTicket()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const updateTicket = async (payload: Record<string, unknown>) => {
    const response = await fetch(`/api/support/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || 'Failed to update ticket')
    }

    const data = await response.json()
    setTicket(data.data)
  }

  const sendMessage = async () => {
    if (!message.trim()) return

    try {
      setSending(true)
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          senderType: 'admin',
          senderName: 'Support Team',
          isInternal,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      setMessage('')
      setIsInternal(false)
      await loadTicket()
      toast.success('Message sent', isInternal ? 'Internal note added' : 'Customer response sent')
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Send failed', 'Could not send message')
    } finally {
      setSending(false)
    }
  }

  const updateStatus = async (nextStatus: string) => {
    try {
      setUpdatingStatus(true)
      await updateTicket({ status: nextStatus })
      toast.success('Status updated', `Ticket moved to ${nextStatus.replace('_', ' ')}`)
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Update failed', 'Could not update ticket status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleReturnDecision = async (approved: boolean) => {
    try {
      setUpdatingReturn(true)
      await updateTicket({ returnApproved: approved })
      toast.success(approved ? 'Return approved' : 'Return denied')
    } catch (error) {
      console.error('Failed to update return decision:', error)
      toast.error('Action failed', 'Could not update return request')
    } finally {
      setUpdatingReturn(false)
    }
  }

  const handleGenerateReturnLabel = async () => {
    if (!ticket?.orderId) return

    const labelUrl = `/api/shipping/label/${ticket.orderId}`
    try {
      setLabeling(true)
      await updateTicket({
        returnApproved: true,
        returnLabel: labelUrl,
      })
      window.open(labelUrl, '_blank', 'noopener,noreferrer')
      toast.success('Return label ready', 'Opened in a new tab')
    } catch (error) {
      console.error('Failed to generate return label:', error)
      toast.error('Label generation failed', 'Could not generate return label')
    } finally {
      setLabeling(false)
    }
  }

  const metadataStats = useMemo(() => {
    if (!ticket) return []
    return [
      { label: 'Messages', value: String(ticket.messages.length) },
      { label: 'Created', value: new Date(ticket.createdAt).toLocaleDateString() },
      { label: 'Last Updated', value: new Date(ticket.updatedAt).toLocaleDateString() },
      ...(ticket.resolvedAt
        ? [{ label: 'Resolved', value: new Date(ticket.resolvedAt).toLocaleDateString() }]
        : []),
    ]
  }, [ticket])

  const fulfillmentHref = ticket
    ? ticket.orderId
      ? `/admin/fulfillment?ticketId=${ticket.id}&orderId=${ticket.orderId}`
      : `/admin/fulfillment?ticketId=${ticket.id}`
    : '/admin/fulfillment'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <div className="h-12 w-12 rounded-full border-b-2 border-[#FF3131] animate-spin" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <AdminLayout title="Ticket Not Found" subtitle="The requested ticket could not be found">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Ticket Not Found</h2>
          <p className="text-white/60 mb-4">The ticket you are looking for does not exist.</p>
          <Link href="/admin/support/tickets" className="text-[#FF3131] hover:text-[#ff6f6f] font-medium">
            Back to Tickets
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
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${getStatusColor(ticket.status)}`}>
            {ticket.status.replace('_', ' ')}
          </span>
          <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
            {ticket.priority}
          </span>
          <Link
            href={fulfillmentHref}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 text-xs uppercase tracking-[0.12em]"
          >
            <Package className="w-3.5 h-3.5" />
            Fulfillment
          </Link>
        </div>
      }
    >
      <Link
        href="/admin/support/tickets"
        className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-4 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tickets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-neutral-900 border border-white/10 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Ticket Context</h2>
                <p className="text-xs text-white/50 mt-1">{ticket.type.replace('_', ' ')}</p>
              </div>
              <span className="text-2xl">{getTypeIcon(ticket.type)}</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Customer</p>
                <p className="text-sm text-white inline-flex items-center gap-2">
                  <User className="w-4 h-4 text-white/45" />
                  {ticket.customerName}
                </p>
                <p className="text-sm text-white/70 inline-flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4 text-white/45" />
                  {ticket.customerEmail}
                </p>
              </div>

              {ticket.order ? (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Order</p>
                  <Link
                    href={`/admin/fulfillment?orderId=${ticket.orderId}`}
                    className="text-sm text-blue-300 hover:text-blue-200 inline-flex items-center gap-2"
                  >
                    <Package className="w-4 h-4" />
                    {ticket.orderNumber}
                  </Link>
                  <p className="text-sm text-white/70 mt-1">${ticket.order.total.toFixed(2)}</p>
                </div>
              ) : null}

              {ticket.refundAmount ? (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Refund Request</p>
                  <p className="text-sm text-white inline-flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-white/45" />
                    ${ticket.refundAmount.toFixed(2)}
                  </p>
                  {ticket.refundReason ? <p className="text-xs text-white/55 mt-1">{ticket.refundReason}</p> : null}
                </div>
              ) : null}

              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Created</p>
                <p className="text-sm text-white inline-flex items-center gap-2">
                  <Clock className="w-4 h-4 text-white/45" />
                  {new Date(ticket.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {ticket.aiAssisted && ticket.aiSummary ? (
              <div className="mt-5 p-4 bg-purple-500/10 border border-purple-500/25 rounded-lg">
                <p className="text-xs uppercase tracking-[0.14em] text-purple-300 mb-1">AI Summary</p>
                <p className="text-sm text-purple-100/90">{ticket.aiSummary}</p>
              </div>
            ) : null}
          </section>

          <section className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm uppercase tracking-[0.16em] text-white/70">Conversation</h2>
            </div>

            <div className="p-5 space-y-4 max-h-[560px] overflow-y-auto">
              {ticket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg border ${
                    msg.isInternal
                      ? 'bg-amber-500/10 border-amber-500/25'
                      : msg.senderType === 'admin'
                      ? 'bg-emerald-500/10 border-emerald-500/25'
                      : 'bg-white/[0.02] border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{msg.senderName}</span>
                    <span className="text-xs text-white/45">{new Date(msg.createdAt).toLocaleString()}</span>
                    {msg.isInternal ? (
                      <span className="text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        Internal
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{msg.message}</p>
                </div>
              ))}
            </div>

            {ticket.status !== 'CLOSED' ? (
              <div className="p-5 border-t border-white/10 bg-white/[0.02]">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Type your response..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/25 resize-none"
                />
                <div className="flex items-center justify-between mt-3">
                  <label className="inline-flex items-center gap-2 text-xs text-white/65">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(event) => setIsInternal(event.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#FF3131] focus:ring-[#FF3131]"
                    />
                    Internal note (not visible to customer)
                  </label>
                  <button
                    onClick={sendMessage}
                    disabled={sending || !message.trim()}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[#FF3131] text-white hover:bg-[#ff4a4a] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="bg-neutral-900 border border-white/10 rounded-xl p-5">
            <h2 className="text-sm uppercase tracking-[0.16em] text-white/70 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {ticket.status === 'OPEN' ? (
                <button
                  onClick={() => updateStatus('IN_PROGRESS')}
                  disabled={updatingStatus}
                  className="w-full h-9 rounded-md border border-amber-500/30 bg-amber-500/15 text-amber-300 text-sm disabled:opacity-50"
                >
                  Start Working
                </button>
              ) : null}

              {ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS' ? (
                <button
                  onClick={() => updateStatus('WAITING_CUSTOMER')}
                  disabled={updatingStatus}
                  className="w-full h-9 rounded-md border border-purple-500/30 bg-purple-500/15 text-purple-300 text-sm disabled:opacity-50"
                >
                  Wait for Customer
                </button>
              ) : null}

              {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? (
                <button
                  onClick={() => updateStatus('RESOLVED')}
                  disabled={updatingStatus}
                  className="w-full h-9 rounded-md border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark Resolved
                </button>
              ) : null}

              {ticket.status === 'RESOLVED' ? (
                <button
                  onClick={() => updateStatus('CLOSED')}
                  disabled={updatingStatus}
                  className="w-full h-9 rounded-md border border-white/20 bg-white/10 text-white/80 text-sm disabled:opacity-50"
                >
                  Close Ticket
                </button>
              ) : null}
            </div>
          </section>

          {ticket.returnRequested ? (
            <section className="bg-neutral-900 border border-white/10 rounded-xl p-5">
              <h2 className="text-sm uppercase tracking-[0.16em] text-white/70 mb-3">Return Workflow</h2>
              <div className="space-y-2">
                {ticket.returnApproved === null ? (
                  <>
                    <button
                      onClick={() => handleReturnDecision(true)}
                      disabled={updatingReturn}
                      className="w-full h-9 rounded-md border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-sm disabled:opacity-50"
                    >
                      Approve Return
                    </button>
                    <button
                      onClick={() => handleReturnDecision(false)}
                      disabled={updatingReturn}
                      className="w-full h-9 rounded-md border border-red-500/30 bg-red-500/15 text-red-300 text-sm disabled:opacity-50"
                    >
                      Deny Return
                    </button>
                  </>
                ) : ticket.returnApproved ? (
                  <>
                    <p className="text-sm text-emerald-300">Return Approved</p>
                    <button
                      onClick={handleGenerateReturnLabel}
                      disabled={labeling}
                      className="w-full h-9 rounded-md border border-blue-500/30 bg-blue-500/15 text-blue-300 text-sm disabled:opacity-50"
                    >
                      {labeling ? 'Generating...' : 'Generate Return Label'}
                    </button>
                    {ticket.returnLabel ? (
                      <button
                        onClick={() => window.open(ticket.returnLabel!, '_blank', 'noopener,noreferrer')}
                        className="w-full h-9 rounded-md border border-white/20 bg-white/10 text-white/85 text-sm"
                      >
                        Open Existing Label
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-red-300">Return Denied</p>
                )}
              </div>
            </section>
          ) : null}

          <section className="bg-neutral-900 border border-white/10 rounded-xl p-5">
            <h2 className="text-sm uppercase tracking-[0.16em] text-white/70 mb-3">Ticket Stats</h2>
            <div className="space-y-2">
              {metadataStats.map((stat) => (
                <div key={stat.label} className="flex items-center justify-between text-sm">
                  <span className="text-white/55">{stat.label}</span>
                  <span className="text-white">{stat.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/55">Messages</span>
                <span className="text-white inline-flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  {ticket.messages.length}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </AdminLayout>
  )
}
