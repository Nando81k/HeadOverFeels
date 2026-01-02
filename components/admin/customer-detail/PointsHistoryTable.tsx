/**
 * Points History Table Component
 * 
 * Displays customer's care points transaction history with:
 * - Transaction type icons
 * - Date/time
 * - Points earned/spent
 * - Description
 * - Filtering options
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  ShoppingBag, 
  UserPlus, 
  Gift, 
  ChatText, 
  Heart, 
  ArrowsClockwise,
  Clock,
  Funnel,
  CaretDown,
  IconProps
} from '@phosphor-icons/react';

type PhosphorIcon = React.ComponentType<IconProps>;

interface PointsTransaction {
  id: string;
  points: number;
  type: string;
  description: string | null;
  createdAt: string;
  expiresAt?: string | null;
  isExpired?: boolean;
}

interface PointsHistoryTableProps {
  transactions: PointsTransaction[];
  loading?: boolean;
}

// Transaction type icons and colors
const TRANSACTION_CONFIG: Record<string, { 
  icon: PhosphorIcon; 
  color: string;
  bgColor: string;
  label: string;
}> = {
  PURCHASE: { 
    icon: ShoppingBag, 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-500/20',
    label: 'Purchase' 
  },
  ACCOUNT_CREATION: { 
    icon: UserPlus, 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/20',
    label: 'Welcome Bonus' 
  },
  FIRST_PURCHASE: { 
    icon: Star, 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/20',
    label: 'First Purchase' 
  },
  REVIEW: { 
    icon: ChatText, 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/20',
    label: 'Review' 
  },
  REFERRAL_GIVE: { 
    icon: Heart, 
    color: 'text-pink-400', 
    bgColor: 'bg-pink-500/20',
    label: 'Referral Bonus' 
  },
  REFERRAL_RECEIVE: { 
    icon: Gift, 
    color: 'text-pink-400', 
    bgColor: 'bg-pink-500/20',
    label: 'Referral Welcome' 
  },
  ADMIN_ADJUSTMENT: { 
    icon: Gift, 
    color: 'text-orange-400', 
    bgColor: 'bg-orange-500/20',
    label: 'Admin Gift' 
  },
  REDEMPTION: { 
    icon: ArrowsClockwise, 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/20',
    label: 'Redeemed' 
  },
  TIER_BONUS: { 
    icon: Star, 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/20',
    label: 'Tier Bonus' 
  },
  BIRTHDAY: { 
    icon: Gift, 
    color: 'text-pink-400', 
    bgColor: 'bg-pink-500/20',
    label: 'Birthday Gift' 
  },
  EXPIRATION: { 
    icon: Clock, 
    color: 'text-gray-400', 
    bgColor: 'bg-gray-500/20',
    label: 'Expired' 
  },
};

const DEFAULT_CONFIG = { 
  icon: Star, 
  color: 'text-gray-400', 
  bgColor: 'bg-gray-500/20',
  label: 'Other' 
};

type FilterType = 'all' | 'earned' | 'spent';

export default function PointsHistoryTable({
  transactions,
  loading = false
}: PointsHistoryTableProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'earned') return tx.points > 0;
    if (filter === 'spent') return tx.points < 0;
    return true;
  });

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
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded w-1/3 animate-pulse mb-2" />
                <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" />
              </div>
              <div className="h-6 bg-white/10 rounded w-16 animate-pulse" />
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
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <motion.div 
            className="p-2 rounded-xl bg-amber-500/20"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Clock size={24} weight="bold" className="text-amber-400" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-white">Points History</h3>
            <p className="text-sm text-white/40">{transactions.length} transactions</p>
          </div>
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors"
          >
            <Funnel size={16} />
            <span className="text-sm capitalize">{filter}</span>
            <CaretDown size={14} className={`transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 bg-neutral-800 border border-white/10 rounded-xl overflow-hidden shadow-xl z-10"
              >
                {(['all', 'earned', 'spent'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setFilter(option);
                      setIsFilterOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors capitalize ${
                      filter === option ? 'text-amber-400' : 'text-white/60'
                    }`}
                  >
                    {option} {option === 'earned' && '(+)'}
                    {option === 'spent' && '(-)'}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Transactions list */}
      {filteredTransactions.length === 0 ? (
        <div className="p-8 text-center">
          <Star size={48} className="mx-auto text-white/20 mb-3" />
          <p className="text-white/40">No transactions found</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
          {filteredTransactions.map((tx, index) => {
            const config = TRANSACTION_CONFIG[tx.type] || DEFAULT_CONFIG;
            const Icon = config.icon;
            const isPositive = tx.points > 0;

            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
              >
                {/* Icon */}
                <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
                  <Icon size={20} weight="bold" className={config.color} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">
                      {config.label}
                    </span>
                    {tx.isExpired && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
                        Expired
                      </span>
                    )}
                  </div>
                  {tx.description && (
                    <p className="text-xs text-white/40 truncate">{tx.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-white/30">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                    {tx.expiresAt && !tx.isExpired && (
                      <span className="text-xs text-orange-400/60">
                        Expires {new Date(tx.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Points */}
                <div className={`text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className="text-lg font-bold">
                    {isPositive ? '+' : ''}{tx.points.toLocaleString()}
                  </span>
                  <p className="text-xs text-white/30">pts</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
