'use client'

import Link from 'next/link'
import { CaretDown, CaretUp, ChatCircle, Package, Receipt, User } from '@phosphor-icons/react'
import type { FulfillmentQueueItem, FulfillmentQueueType } from '@/lib/fulfillment/queue'
import type {
  FulfillmentConsoleLayoutState,
  FulfillmentImpactPreview,
} from '@/lib/fulfillment/console'

type UtilityContext = {
  order: {
    id: string
  } | null
  selectedTicket: {
    id: string
  } | null
  customer: {
    id: string
    name: string | null
    email: string
    totalSpent: number
    totalOrders: number
    currentPoints: number
    loyaltyTier: {
      name: string
      pointMultiplier: number
    } | null
  } | null
  recentOrders: Array<{
    id: string
    orderNumber: string
    total: number
    createdAt: string
  }>
  recentTickets: Array<{
    id: string
    ticketNumber: string
    subject: string
  }>
} | null

type ChatQueueSession = {
  sessionId: string
  status: 'WAITING' | 'ACTIVE' | 'CLOSED'
  customerName: string
  customerEmail: string
  waitTimeFormatted: string
}

type ChatSessionDetails = {
  sessionId: string
  status: 'WAITING' | 'ACTIVE' | 'CLOSED'
  customerName: string
  customerEmail: string
}

interface FulfillmentUtilityRailProps {
  context: UtilityContext
  activeItem: FulfillmentQueueItem | null
  selectedTicketId: string | null
  queueLabels: Record<FulfillmentQueueType, string>
  formatCurrency: (amount: number | null | undefined) => string
  formatDate: (value: string | null | undefined) => string
  onOpenOrderContext: (orderId: string) => void
  onOpenTicketContext: (ticketId: string) => void
  onOpenCustomerTab: () => void
  impactPreview: FulfillmentImpactPreview
  layoutState: FulfillmentConsoleLayoutState
  onToggleLayout: (key: keyof FulfillmentConsoleLayoutState) => void
  chatWaiting: ChatQueueSession[]
  chatActive: ChatQueueSession[]
  selectedChatSessionId: string | null
  chatSession: ChatSessionDetails | null
  actionLoading: boolean
  onRefreshChatQueue: () => void
  onSelectChatSession: (sessionId: string) => void
  onAcceptChat: (sessionId: string) => void
  onCloseChat: () => void
  chatMessageDraft: string
  onChatMessageDraftChange: (value: string) => void
  onSendChatMessage: () => void
}

function SectionHeader({
  title,
  isOpen,
  onToggle,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between text-left px-3 py-2 border-b border-slate-200"
    >
      <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{title}</span>
      {isOpen ? <CaretUp className="w-3.5 h-3.5 text-slate-500" /> : <CaretDown className="w-3.5 h-3.5 text-slate-500" />}
    </button>
  )
}

export function FulfillmentUtilityRail({
  context,
  activeItem,
  selectedTicketId,
  queueLabels,
  formatCurrency,
  formatDate,
  onOpenOrderContext,
  onOpenTicketContext,
  onOpenCustomerTab,
  impactPreview,
  layoutState,
  onToggleLayout,
  chatWaiting,
  chatActive,
  selectedChatSessionId,
  chatSession,
  actionLoading,
  onRefreshChatQueue,
  onSelectChatSession,
  onAcceptChat,
  onCloseChat,
  chatMessageDraft,
  onChatMessageDraftChange,
  onSendChatMessage,
}: FulfillmentUtilityRailProps) {
  if (layoutState.utilityCollapsed) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white h-full p-3 flex flex-col gap-3">
        <button
          onClick={() => onToggleLayout('utilityCollapsed')}
          className="h-8 rounded-md border border-slate-300 text-xs uppercase tracking-[0.12em] text-slate-700"
        >
          Expand Rail
        </button>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
          <p className="font-medium text-slate-900">Impact</p>
          <p>{impactPreview.items.length} pending change{impactPreview.items.length === 1 ? '' : 's'}</p>
        </div>
      </aside>
    )
  }

  const chatQueue = [...chatWaiting, ...chatActive].slice(0, 3)

  return (
    <aside className="rounded-xl border border-slate-200 bg-white h-full flex flex-col">
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Utility Rail</p>
          <p className="text-[11px] text-slate-700">{activeItem ? queueLabels[activeItem.queueType] : 'No lane selected'}</p>
        </div>
        <button
          onClick={() => onToggleLayout('utilityCollapsed')}
          className="h-7 px-2 rounded-md border border-slate-300 text-[11px] text-slate-700"
        >
          Collapse
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <section className="border-b border-slate-200">
          <SectionHeader
            title="Impact Preview"
            isOpen
            onToggle={() => undefined}
          />
          <div className="px-3 py-2.5 space-y-2">
            {impactPreview.items.length === 0 ? (
              <p className="text-[11px] text-slate-500">No pending field changes.</p>
            ) : (
              impactPreview.items.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <p className="text-[11px] font-medium text-slate-900">{item.label}</p>
                  <p className="text-[10px] text-slate-500">
                    {item.from ? `${item.from} -> ${item.to}` : item.to}
                  </p>
                </div>
              ))
            )}
            {impactPreview.blockers.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
                {impactPreview.blockers.map((blocker) => (
                  <p key={blocker} className="text-[10px] text-amber-700">
                    {blocker}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="border-b border-slate-200">
          <SectionHeader
            title="Customer Snapshot"
            isOpen={layoutState.showSnapshot}
            onToggle={() => onToggleLayout('showSnapshot')}
          />
          {layoutState.showSnapshot ? (
            <div className="px-3 py-2.5 space-y-2">
              {!context?.customer ? (
                <p className="text-[11px] text-slate-500">No linked customer profile.</p>
              ) : (
                <>
                  <p className="text-[11px] font-semibold text-slate-900">{context.customer.name || context.customer.email}</p>
                  <p className="text-[11px] text-slate-500">{context.customer.email}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-1.5 text-center">
                      <p className="text-[10px] text-slate-500">Spent</p>
                      <p className="text-[11px] text-slate-900">{formatCurrency(context.customer.totalSpent)}</p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-1.5 text-center">
                      <p className="text-[10px] text-slate-500">Orders</p>
                      <p className="text-[11px] text-slate-900">{context.customer.totalOrders}</p>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-1.5 text-center">
                      <p className="text-[10px] text-slate-500">Points</p>
                      <p className="text-[11px] text-slate-900">{context.customer.currentPoints}</p>
                    </div>
                  </div>
                  <button
                    onClick={onOpenCustomerTab}
                    className="h-7 px-2.5 rounded-md border border-slate-300 text-[11px] text-slate-700"
                  >
                    Open Customer Tools
                  </button>
                </>
              )}
            </div>
          ) : null}
        </section>

        <section className="border-b border-slate-200">
          <SectionHeader
            title="Recent Context"
            isOpen={layoutState.showHistory}
            onToggle={() => onToggleLayout('showHistory')}
          />
          {layoutState.showHistory ? (
            <div className="px-3 py-2.5 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Orders</p>
                {(context?.recentOrders || []).slice(0, 2).map((order) => (
                  <button
                    key={order.id}
                    onClick={() => onOpenOrderContext(order.id)}
                    className="w-full text-left rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
                  >
                    <p className="text-[11px] text-slate-900">{order.orderNumber}</p>
                    <p className="text-[10px] text-slate-500">{formatDate(order.createdAt)}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Tickets</p>
                {(context?.recentTickets || []).slice(0, 2).map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => onOpenTicketContext(ticket.id)}
                    className="w-full text-left rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
                  >
                    <p className="text-[11px] text-slate-900">{ticket.ticketNumber}</p>
                    <p className="text-[10px] text-slate-500 truncate">{ticket.subject}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="border-b border-slate-200">
          <SectionHeader
            title="Live Chat Lane"
            isOpen={layoutState.chatExpanded}
            onToggle={() => onToggleLayout('chatExpanded')}
          />
          {layoutState.chatExpanded ? (
            <div className="px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-600">
                  Waiting {chatWaiting.length} • Active {chatActive.length}
                </p>
                <button
                  onClick={onRefreshChatQueue}
                  className="h-6 px-2 rounded border border-slate-300 text-[10px] uppercase tracking-[0.12em] text-slate-700"
                >
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {chatQueue.length === 0 ? (
                  <p className="text-[11px] text-slate-500 col-span-3">No active sessions.</p>
                ) : (
                  chatQueue.map((session) => (
                    <button
                      key={session.sessionId}
                      onClick={() => onSelectChatSession(session.sessionId)}
                      className={`rounded-md border px-2 py-1 text-left ${
                        selectedChatSessionId === session.sessionId
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <p className="text-[10px] font-medium text-slate-900 truncate">{session.customerName}</p>
                      <p className="text-[10px] text-slate-500">{session.status}</p>
                    </button>
                  ))
                )}
              </div>
              {chatSession ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-900">{chatSession.customerName}</p>
                    {chatSession.status === 'WAITING' ? (
                      <button
                        onClick={() => onAcceptChat(chatSession.sessionId)}
                        disabled={actionLoading}
                        className="h-6 px-2 rounded bg-blue-600 text-white text-[10px] uppercase tracking-[0.12em]"
                      >
                        Accept
                      </button>
                    ) : chatSession.status === 'ACTIVE' ? (
                      <button
                        onClick={onCloseChat}
                        disabled={actionLoading}
                        className="h-6 px-2 rounded border border-red-300 text-red-600 text-[10px] uppercase tracking-[0.12em]"
                      >
                        Close
                      </button>
                    ) : null}
                  </div>
                  {chatSession.status !== 'CLOSED' ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={chatMessageDraft}
                        onChange={(event) => onChatMessageDraftChange(event.target.value)}
                        placeholder="Reply..."
                        className="flex-1 h-7 px-2 rounded border border-slate-300 bg-white text-[11px] text-slate-900"
                      />
                      <button
                        onClick={onSendChatMessage}
                        disabled={actionLoading || !chatMessageDraft.trim()}
                        className="h-7 px-2 rounded bg-blue-600 text-white text-[10px] uppercase tracking-[0.12em] disabled:opacity-60"
                      >
                        Send
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="px-3 py-2 flex items-center gap-2">
          {context?.order ? (
            <Link
              href={`/admin/orders/${context.order.id}`}
              className="h-7 px-2 rounded-md border border-slate-300 text-[10px] uppercase tracking-[0.12em] text-slate-700 inline-flex items-center gap-1"
            >
              <Package className="w-3 h-3" />
              Order
            </Link>
          ) : null}
          {selectedTicketId ? (
            <Link
              href={`/admin/support/tickets/${selectedTicketId}`}
              className="h-7 px-2 rounded-md border border-slate-300 text-[10px] uppercase tracking-[0.12em] text-slate-700 inline-flex items-center gap-1"
            >
              <Receipt className="w-3 h-3" />
              Ticket
            </Link>
          ) : null}
          {context?.customer ? (
            <Link
              href={`/admin/customers/${context.customer.id}`}
              className="h-7 px-2 rounded-md border border-slate-300 text-[10px] uppercase tracking-[0.12em] text-slate-700 inline-flex items-center gap-1"
            >
              <User className="w-3 h-3" />
              Customer
            </Link>
          ) : null}
          <button
            onClick={() => onToggleLayout('utilityCollapsed')}
            className="ml-auto h-7 px-2 rounded-md border border-slate-300 text-[10px] uppercase tracking-[0.12em] text-slate-700 inline-flex items-center gap-1"
          >
            <ChatCircle className="w-3 h-3" />
            Compact
          </button>
        </div>
      </div>
    </aside>
  )
}
