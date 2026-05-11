/**
 * Purchase History Table Component
 * 
 * Displays customer's complete order history with:
 * - Order status badges
 * - Order details
 * - Points earned per order
 * - Quick actions
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  ArrowSquareOut,
  Star,
  CaretDown,
  MagnifyingGlass,
  IconProps
} from '@phosphor-icons/react';
import Link from 'next/link';

type PhosphorIcon = React.ComponentType<IconProps>;

interface OrderItem {
  quantity: number;
  productName: string;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal?: number;
  pointsEarned?: number;
  createdAt: string;
  items: OrderItem[];
}

interface PurchaseHistoryTableProps {
  orders: Order[];
  loading?: boolean;
}

// Status configuration
const STATUS_CONFIG: Record<string, { 
  icon: PhosphorIcon; 
  color: string;
  bgColor: string;
  label: string;
}> = {
  PENDING: { 
    icon: Clock, 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/20',
    label: 'Pending' 
  },
  CONFIRMED: { 
    icon: CheckCircle, 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/20',
    label: 'Confirmed' 
  },
  PROCESSING: { 
    icon: Package, 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/20',
    label: 'Processing' 
  },
  SHIPPED: { 
    icon: Truck, 
    color: 'text-indigo-400', 
    bgColor: 'bg-indigo-500/20',
    label: 'Shipped' 
  },
  DELIVERED: { 
    icon: CheckCircle, 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-500/20',
    label: 'Delivered' 
  },
  CANCELLED: { 
    icon: XCircle, 
    color: 'text-gray-400', 
    bgColor: 'bg-gray-500/20',
    label: 'Cancelled' 
  },
  REFUNDED: { 
    icon: XCircle, 
    color: 'text-red-400', 
    bgColor: 'bg-red-500/20',
    label: 'Refunded' 
  },
};

const DEFAULT_STATUS_CONFIG = { 
  icon: Clock, 
  color: 'text-gray-400', 
  bgColor: 'bg-gray-500/20',
  label: 'Unknown' 
};

export default function PurchaseHistoryTable({
  orders,
  loading = false
}: PurchaseHistoryTableProps) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.items.some(item => item.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

  // Loading skeleton
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl"
      >
        <div className="p-6 border-b border-white/10">
          <div className="h-6 bg-white/10 rounded w-1/4 animate-pulse" />
        </div>
        <div className="divide-y divide-white/5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded w-1/3 animate-pulse mb-2" />
                <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" />
              </div>
              <div className="h-6 bg-white/10 rounded w-20 animate-pulse" />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div 
              className="p-2 rounded-xl bg-emerald-500/20"
              whileHover={{ scale: 1.05, rotate: 5 }}
            >
              <ShoppingBag size={24} weight="bold" className="text-emerald-400" />
            </motion.div>
            <div>
              <h3 className="text-lg font-semibold text-white">Purchase History</h3>
              <p className="text-sm text-white/40">{orders.length} orders • ${totalSpent.toFixed(2)} total</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-white/40">Avg Order</p>
              <p className="text-sm font-semibold text-white">${avgOrderValue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/20 appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            {Object.keys(STATUS_CONFIG).map(status => (
              <option key={status} value={status}>
                {STATUS_CONFIG[status].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="p-8 text-center">
          <ShoppingBag size={48} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/40">
            {orders.length === 0 ? 'No orders yet' : 'No matching orders found'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
          {filteredOrders.map((order, index) => {
            const config = STATUS_CONFIG[order.status] || DEFAULT_STATUS_CONFIG;
            const StatusIcon = config.icon;
            const isExpanded = expandedOrder === order.id;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                {/* Order row */}
                <div 
                  className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
                  {/* Status icon */}
                  <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
                    <StatusIcon size={20} weight="bold" className={config.color} />
                  </div>

                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono font-medium text-white">
                        #{order.orderNumber}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'} • {' '}
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>

                  {/* Points earned */}
                  {order.pointsEarned && order.pointsEarned > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10">
                      <Star size={14} weight="fill" className="text-amber-400" />
                      <span className="text-xs font-medium text-amber-400">+{order.pointsEarned}</span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">${order.total.toFixed(2)}</span>
                  </div>

                  {/* Expand indicator */}
                  <CaretDown 
                    size={16} 
                    className={`text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                  />
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0">
                        <div className="bg-white/5 rounded-xl p-4">
                          <p className="text-xs text-white/40 mb-3">Order Items</p>
                          <div className="space-y-2">
                            {order.items.map((item, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-white/40">{item.quantity}x</span>
                                  <span className="text-sm text-white">{item.productName}</span>
                                </div>
                                <span className="text-sm text-white/60">
                                  ${(item.price * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* View order link */}
                          <Link
                            href={`/admin/fulfillment?orderId=${order.id}`}
                            className="mt-4 flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                          >
                            View Full Order
                            <ArrowSquareOut size={16} />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
