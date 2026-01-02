'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, EnvelopeSimple, CurrencyDollar, Package, Clock, CheckCircle, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

interface CartItem {
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
}

interface AbandonedCart {
  id: string;
  customerEmail: string;
  customerName: string | null;
  items: CartItem[];
  totalValue: number;
  itemCount: number;
  abandonedAt: Date;
  recoveryEmailSent: boolean;
  recoveryEmailSentAt: Date | null;
  recovered: boolean;
  recoveredAt: Date | null;
  discountCode: string | null;
  discountAmount: number | null;
}

interface AbandonedCartsProps {
  refreshInterval?: number;
  maxItems?: number;
}

export default function AbandonedCarts({
  refreshInterval = 30000, // 30 seconds
  maxItems = 10,
}: AbandonedCartsProps) {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'notSent' | 'sent' | 'recovered'>('notSent');

  const fetchCarts = async () => {
    try {
      const response = await fetch(`/api/admin/abandoned-carts?limit=${maxItems}&filter=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setCarts(
          data.carts.map((cart: AbandonedCart) => ({
            ...cart,
            abandonedAt: new Date(cart.abandonedAt),
            recoveryEmailSentAt: cart.recoveryEmailSentAt
              ? new Date(cart.recoveryEmailSentAt)
              : null,
            recoveredAt: cart.recoveredAt ? new Date(cart.recoveredAt) : null,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching abandoned carts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarts();
    const interval = setInterval(fetchCarts, refreshInterval);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const sendRecoveryEmail = async (cartId: string) => {
    setSendingEmail(cartId);
    try {
      const response = await fetch('/api/admin/abandoned-carts/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId }),
      });

      if (response.ok) {
        // Refresh the list
        await fetchCarts();
      } else {
        const data = await response.json();
        alert(`Failed to send recovery email: ${data.error}`);
      }
    } catch (error) {
      console.error('Error sending recovery email:', error);
      alert('Failed to send recovery email');
    } finally {
      setSendingEmail(null);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getRecoveryRate = () => {
    if (carts.length === 0) return 0;
    const recovered = carts.filter(c => c.recovered).length;
    return ((recovered / carts.length) * 100).toFixed(1);
  };

  const getPotentialRevenue = () => {
    // Only count carts that haven't been recovered
    return carts
      .filter(c => !c.recovered)
      .reduce((sum, cart) => sum + cart.totalValue, 0);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-linear-to-r from-orange-50 to-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ShoppingCart size={20} weight="bold" className="text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Abandoned Carts</h3>
              <p className="text-sm text-gray-500">Recover lost sales</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <Package size={16} weight="bold" />
              <span>Total Carts</span>
            </div>
            <div className="text-xl font-bold text-gray-900">{carts.length}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <CurrencyDollar size={16} weight="bold" />
              <span>Potential Revenue</span>
            </div>
            <div className="text-xl font-bold text-green-600">
              ${getPotentialRevenue().toFixed(0)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
              <CheckCircle size={16} weight="bold" />
              <span>Recovery Rate</span>
            </div>
            <div className="text-xl font-bold text-blue-600">{getRecoveryRate()}%</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-6 py-3 border-b border-gray-200 bg-gray-50">
        {[
          { value: 'notSent', label: 'Need Action', icon: WarningCircle },
          { value: 'sent', label: 'Email Sent', icon: EnvelopeSimple },
          { value: 'recovered', label: 'Recovered', icon: CheckCircle },
          { value: 'all', label: 'All', icon: ShoppingCart },
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setFilter(value as typeof filter)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === value
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Carts List */}
      <div className="max-h-[500px] overflow-y-auto">
        {carts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <ShoppingCart size={64} weight="bold" className="mb-4 opacity-30" />
            <p className="text-lg font-medium">No abandoned carts</p>
            <p className="text-sm">Great job keeping customers engaged!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {carts.map((cart, index) => (
              <motion.div
                key={cart.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="border-b border-gray-200 last:border-b-0"
              >
                <div className="p-4 hover:bg-gray-50 transition-colors">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {cart.customerName || cart.customerEmail}
                        </h4>
                        {cart.recovered && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            Recovered
                          </span>
                        )}
                        {cart.recoveryEmailSent && !cart.recovered && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            Email Sent
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{cart.customerEmail}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-gray-900">
                        ${cart.totalValue.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {cart.itemCount} item{cart.itemCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="mb-3 text-sm text-gray-600">
                    {cart.items.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="truncate">
                        • {item.productName}
                        {item.variantName && ` (${item.variantName})`} × {item.quantity}
                      </div>
                    ))}
                    {cart.items.length > 2 && (
                      <div className="text-gray-500">
                        +{cart.items.length - 2} more item{cart.items.length - 2 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock size={12} weight="bold" />
                        <span>{formatTimeAgo(cart.abandonedAt)}</span>
                      </div>
                      {cart.recoveryEmailSentAt && (
                        <div className="flex items-center gap-1">
                          <EnvelopeSimple size={12} weight="bold" />
                          <span>Sent {formatTimeAgo(cart.recoveryEmailSentAt)}</span>
                        </div>
                      )}
                      {cart.discountCode && (
                        <div className="text-orange-600 font-medium">
                          {cart.discountCode} (-${cart.discountAmount?.toFixed(0)})
                        </div>
                      )}
                    </div>

                    {!cart.recovered && !cart.recoveryEmailSent && (
                      <button
                        onClick={() => sendRecoveryEmail(cart.id)}
                        disabled={sendingEmail === cart.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {sendingEmail === cart.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <PaperPlaneTilt size={16} weight="bold" />
                            <span>Send Recovery Email</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      {carts.length > 0 && (
        <div className="px-6 py-4 bg-linear-to-r from-orange-50 to-yellow-50 border-t border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              💡 Recovery emails typically recover 10-15% of abandoned carts
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Potential recovery: ${(getPotentialRevenue() * 0.125).toFixed(0)} at 12.5% rate
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
