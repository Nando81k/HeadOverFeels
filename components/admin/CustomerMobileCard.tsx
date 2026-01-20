'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  User, 
  Envelope, 
  Phone, 
  ShoppingCart, 
  CurrencyDollar,
  Calendar,
  CaretRight
} from '@phosphor-icons/react';
import { SegmentBadge } from '@/components/admin/SegmentBadge';
import { type CustomerSegment } from '@/lib/customer-segments';
import { type CustomerListItem } from '@/lib/api/customers';

interface CustomerMobileCardProps {
  customer: CustomerListItem;
  index: number;
}

export function CustomerMobileCard({ customer, index }: CustomerMobileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors"
    >
      {/* Header: Name & Segment */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-white text-sm truncate">
            {customer.name || 'N/A'}
          </h4>
          <div className="flex items-center gap-1.5 mt-1 text-white/50 text-xs">
            <Envelope size={12} weight="bold" />
            <span className="truncate">{customer.email}</span>
          </div>
          {customer.phone && (
            <div className="flex items-center gap-1.5 mt-0.5 text-white/40 text-xs">
              <Phone size={12} weight="bold" />
              <span>{customer.phone}</span>
            </div>
          )}
        </div>
        <SegmentBadge segment={customer.segment as CustomerSegment} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-white/40 mb-1">
            <ShoppingCart size={12} weight="bold" />
          </div>
          <p className="text-sm font-medium text-white">{customer.totalOrders}</p>
          <p className="text-[10px] text-white/40">Orders</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-white/40 mb-1">
            <CurrencyDollar size={12} weight="bold" />
          </div>
          <p className="text-sm font-medium text-white">${customer.totalSpent.toFixed(0)}</p>
          <p className="text-[10px] text-white/40">Spent</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-white/40 mb-1">
            <Calendar size={12} weight="bold" />
          </div>
          <p className="text-sm font-medium text-white">
            {customer.lastOrderDate 
              ? new Date(customer.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '—'}
          </p>
          <p className="text-[10px] text-white/40">Last Order</p>
        </div>
      </div>

      {/* View Details Button */}
      <Link
        href={`/admin/customers/${customer.id}`}
        className="flex items-center justify-center gap-2 w-full py-2 bg-white/5 hover:bg-[#FF3131]/20 border border-white/10 hover:border-[#FF3131]/30 rounded-lg text-white/70 hover:text-[#FF3131] text-xs font-medium transition-all"
      >
        View Details
        <CaretRight size={12} weight="bold" />
      </Link>
    </motion.div>
  );
}
