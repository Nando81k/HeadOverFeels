'use client'

import Link from 'next/link'
import {
  ShoppingBag,
  Star,
  Gift,
  Sparkle,
  ArrowRight,
} from '@phosphor-icons/react'

export interface OrderItem {
  id: string
  orderNumber: string
  status: string
  total: number
  createdAt: string
  items: { productName: string; quantity: number }[]
}

export interface PointsTransactionItem {
  id: string
  points: number
  type: string
  description: string
  createdAt: string
  order?: { orderNumber: string } | null
}

export type FeedItem =
  | { kind: 'order'; id: string; date: Date; data: OrderItem }
  | { kind: 'points'; id: string; date: Date; data: PointsTransactionItem }

export function buildFeed(orders: OrderItem[], pointsHistory: PointsTransactionItem[]): FeedItem[] {
  const orderItems: FeedItem[] = orders.map((o) => ({
    kind: 'order' as const,
    id: `order-${o.id}`,
    date: new Date(o.createdAt),
    data: o,
  }))
  const pointItems: FeedItem[] = pointsHistory.map((p) => ({
    kind: 'points' as const,
    id: `points-${p.id}`,
    date: new Date(p.createdAt),
    data: p,
  }))
  return [...orderItems, ...pointItems].sort((a, b) => b.date.getTime() - a.date.getTime())
}

const STATUS_COLOR: Record<string, string> = {
  DELIVERED: 'bg-emerald-500',
  SHIPPED: 'bg-violet-500',
  PROCESSING: 'bg-blue-500',
  CONFIRMED: 'bg-blue-500',
  PENDING: 'bg-amber-400',
  CANCELLED: 'bg-rose-500',
}

function getStatusColor(status: string): string {
  return STATUS_COLOR[status] ?? 'bg-black/40'
}

function getTransactionIcon(type: string) {
  switch (type) {
    case 'PURCHASE':
      return <ShoppingBag size={14} weight="bold" className="text-emerald-600" />
    case 'REVIEW':
      return <Star size={14} weight="fill" className="text-amber-500" />
    case 'REDEMPTION':
      return <Gift size={14} weight="bold" className="text-purple-600" />
    default:
      return <Sparkle size={14} weight="fill" className="text-blue-600" />
  }
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface ActivityRowProps {
  item: FeedItem
  compact?: boolean
}

export function ActivityRow({ item, compact = false }: ActivityRowProps) {
  const padding = compact ? 'p-3' : 'p-4'

  if (item.kind === 'order') {
    const order = item.data
    const itemSummary = order.items.slice(0, 2).map((i) => i.productName).join(', ')
    const moreCount = order.items.length > 2 ? order.items.length - 2 : 0
    return (
      <Link
        href={`/orders/${order.id}/track`}
        className={`group flex items-center gap-3 md:gap-4 ${padding} rounded-2xl bg-black/2 border border-black/8 hover:border-black/20 hover:bg-black/3 transition-all`}
      >
        <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
          <ShoppingBag size={16} weight="bold" className="text-black/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`w-2 h-2 rounded-full ${getStatusColor(order.status)} shrink-0`} />
            <p className="text-sm font-bold text-black truncate">Order #{order.orderNumber}</p>
          </div>
          <p className="text-[11px] text-black/50 truncate">
            {itemSummary}
            {moreCount > 0 && ` +${moreCount}`}
            <span className="text-black/30"> · </span>
            {formatDate(item.date)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-black tabular-nums">${order.total.toFixed(2)}</p>
          <ArrowRight
            size={11}
            weight="bold"
            className="text-black/30 group-hover:text-black/70 transition-colors mt-0.5 ml-auto"
          />
        </div>
      </Link>
    )
  }

  const tx = item.data
  const isPositive = tx.points > 0
  return (
    <div
      className={`flex items-center gap-3 md:gap-4 ${padding} rounded-2xl bg-black/2 border border-black/8`}
    >
      <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
        {getTransactionIcon(tx.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-black truncate">{tx.description}</p>
        <p className="text-[11px] text-black/50 truncate">
          {tx.type.toLowerCase().replace('_', ' ')}
          <span className="text-black/30"> · </span>
          {formatDate(item.date)}
        </p>
      </div>
      <p
        className={`text-sm font-black shrink-0 tabular-nums ${
          isPositive ? 'text-emerald-600' : 'text-rose-500'
        }`}
      >
        {isPositive ? '+' : ''}
        {tx.points.toLocaleString()}
        <span className="text-[10px] text-black/40 ml-0.5 font-medium">pts</span>
      </p>
    </div>
  )
}
