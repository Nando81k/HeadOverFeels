'use client'

import Link from 'next/link'
import { Package, Clock, CreditCard, User, CaretRight, CheckCircle, XCircle, Warning, Truck, Hourglass } from '@phosphor-icons/react'

interface Order {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  total: number
  createdAt: string
  customer: {
    email: string
    phone?: string
  }
  shippingAddress?: {
    firstName: string
    lastName: string
  }
  _count?: {
    items: number
  }
}

interface OrderMobileCardProps {
  order: Order
  isSelected: boolean
  onSelect: () => void
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bgColor: string }> = {
  PENDING: { icon: Hourglass, color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
  CONFIRMED: { icon: CheckCircle, color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  PROCESSING: { icon: Package, color: 'text-indigo-400', bgColor: 'bg-indigo-400/10' },
  SHIPPED: { icon: Truck, color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  DELIVERED: { icon: CheckCircle, color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
  CANCELLED: { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-400/10' },
  REFUNDED: { icon: Warning, color: 'text-orange-400', bgColor: 'bg-orange-400/10' },
}

const paymentConfig: Record<string, { color: string; bgColor: string }> = {
  PENDING: { color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
  PAID: { color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
  FAILED: { color: 'text-red-400', bgColor: 'bg-red-400/10' },
  REFUNDED: { color: 'text-orange-400', bgColor: 'bg-orange-400/10' },
}

export function OrderMobileCard({ order, isSelected, onSelect }: OrderMobileCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const StatusIcon = statusConfig[order.status]?.icon || Package
  const statusColors = statusConfig[order.status] || statusConfig.PENDING
  const paymentColors = paymentConfig[order.paymentStatus] || paymentConfig.PENDING

  const customerName = order.shippingAddress 
    ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`
    : order.customer.email.split('@')[0]

  return (
    <Link
      href={`/admin/fulfillment?orderId=${order.id}`}
      className={`block border-b border-white/5 last:border-0 ${
        isSelected ? 'bg-[#FF3131]/10' : 'active:bg-white/5'
      }`}
    >
      <div className="p-4">
        {/* Top row: Order number & Total */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect()
              }}
              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                isSelected 
                  ? 'bg-[#FF3131] border-[#FF3131]' 
                  : 'border-white/20 bg-white/5'
              }`}
            >
              {isSelected && <CheckCircle size={12} weight="bold" className="text-white" />}
            </button>
            <span className="font-mono text-sm font-bold text-white">
              #{order.orderNumber}
            </span>
          </div>
          <span className="text-lg font-black text-white">
            {formatCurrency(order.total)}
          </span>
        </div>

        {/* Customer info */}
        <div className="flex items-center gap-2 mb-3 text-sm text-white/60">
          <User size={14} weight="bold" />
          <span className="truncate">{customerName}</span>
          {order._count?.items && (
            <span className="text-white/40">· {order._count.items} item{order._count.items > 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Status badges & date */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Order Status */}
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${statusColors.bgColor} ${statusColors.color}`}>
              <StatusIcon size={12} weight="bold" />
              {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
            </span>
            
            {/* Payment Status */}
            <span className={`px-2 py-1 rounded text-xs font-medium ${paymentColors.bgColor} ${paymentColors.color}`}>
              {order.paymentStatus.charAt(0) + order.paymentStatus.slice(1).toLowerCase()}
            </span>
          </div>

          {/* Date & Arrow */}
          <div className="flex items-center gap-2 text-white/40">
            <Clock size={12} weight="bold" />
            <span className="text-xs">{formatDate(order.createdAt)}</span>
            <CaretRight size={14} weight="bold" />
          </div>
        </div>
      </div>
    </Link>
  )
}
