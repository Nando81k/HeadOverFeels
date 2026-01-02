'use client';

import { useState, useEffect } from 'react';
import { Bag, TrendUp, Clock, CurrencyDollar } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

interface SaleItem {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  itemCount: number;
  createdAt: Date;
  status: string;
}

interface RealTimeSalesFeedProps {
  refreshInterval?: number; // milliseconds
  maxItems?: number;
  showNotifications?: boolean;
}

export default function RealTimeSalesFeed({
  refreshInterval = 10000, // 10 seconds
  maxItems = 10,
  showNotifications = true,
}: RealTimeSalesFeedProps) {
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date>(new Date());
  const [newSaleCount, setNewSaleCount] = useState(0);

  // Fetch recent sales
  const fetchSales = async () => {
    try {
      const response = await fetch('/api/admin/sales/recent');
      if (response.ok) {
        const data = await response.json();
        const newSales = data.sales.map((sale: any) => ({
          ...sale,
          createdAt: new Date(sale.createdAt),
        }));

        // Check for new sales since last fetch
        const newSalesAdded = newSales.filter(
          (newSale: SaleItem) =>
            !sales.some((existingSale) => existingSale.id === newSale.id)
        );

        if (newSalesAdded.length > 0 && sales.length > 0) {
          setNewSaleCount(newSalesAdded.length);
          if (showNotifications && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('New Sale! 🎉', {
              body: `${newSalesAdded.length} new order(s) - $${newSalesAdded.reduce((sum: number, s: SaleItem) => sum + s.total, 0).toFixed(2)}`,
              icon: '/favicon.ico',
            });
          }
          // Play sound
          playNotificationSound();
        }

        setSales(newSales.slice(0, maxItems));
        setLastFetch(new Date());
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  // Play notification sound
  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFA==');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore errors if audio playback fails
    });
  };

  // Request notification permission
  useEffect(() => {
    if (showNotifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [showNotifications]);

  // Auto-refresh sales
  useEffect(() => {
    fetchSales();
    const interval = setInterval(fetchSales, refreshInterval);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshInterval, maxItems]);

  // Clear new sale notification after 3 seconds
  useEffect(() => {
    if (newSaleCount > 0) {
      const timeout = setTimeout(() => setNewSaleCount(0), 3000);
      return () => clearTimeout(timeout);
    }
  }, [newSaleCount]);

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (loading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-white/10 w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-white/5"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 bg-emerald-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20">
              <Bag size={18} weight="bold" className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium tracking-[0.1em] text-white uppercase">Live Sales</h3>
              <p className="text-xs text-white/40">Real-time updates</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {newSaleCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-2 py-0.5 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-wide"
              >
                +{newSaleCount} new!
              </motion.div>
            )}
            <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-wide">
              <Clock size={12} weight="bold" />
              <span>{formatTimeAgo(lastFetch)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        {sales.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Bag size={40} weight="bold" className="text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">No recent sales</p>
            <p className="text-xs text-white/30 mt-1">New orders will appear here</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {sales.map((sale, index) => (
              <motion.div
                key={sale.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="px-5 py-3 hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  {/* Left: Order Info */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-1.5 bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
                      <TrendUp size={14} weight="bold" className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-white text-sm">
                          {sale.customerName}
                        </span>
                        <span className="text-[10px] text-white/40 uppercase tracking-wide">
                          #{sale.orderNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <span>{sale.itemCount} item{sale.itemCount !== 1 ? 's' : ''}</span>
                        <span className="text-white/20">•</span>
                        <span className={`font-medium uppercase tracking-wide ${
                          sale.status === 'CONFIRMED' ? 'text-emerald-400' :
                          sale.status === 'PENDING' ? 'text-amber-400' :
                          'text-white/60'
                        }`}>
                          {sale.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Time */}
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-base font-bold text-emerald-400 mb-0.5">
                      <CurrencyDollar size={14} weight="bold" />
                      {sale.total.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wide">
                      {formatTimeAgo(sale.createdAt)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer Stats */}
      {sales.length > 0 && (
        <div className="px-5 py-3 bg-white/5 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">
              Last {sales.length} order{sales.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2 font-medium text-white">
              <span>Total:</span>
              <span className="text-emerald-400">
                ${sales.reduce((sum, sale) => sum + sale.total, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
