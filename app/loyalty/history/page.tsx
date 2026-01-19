'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar, 
  Gift, 
  Check, 
  X, 
  Clock, 
  ShoppingBag,
  Star,
  Users,
  Sparkle,
  ArrowUp,
  ArrowDown,
  Wallet,
  TrendUp,
  CaretDown,
  FunnelSimple
} from '@phosphor-icons/react'
import { Navigation } from '@/components/layout/Navigation'

type TransactionType = 'PURCHASE' | 'REDEMPTION' | 'REFERRAL' | 'BONUS' | 'WELCOME' | 'BIRTHDAY' | 'EXPIRED' | 'ADJUSTMENT'

interface Transaction {
  id: string
  points: number
  type: TransactionType
  description: string
  orderNumber: string | null
  rewardName: string | null
  expiresAt: string | null
  isExpired: boolean
  createdAt: string
  balanceAfter?: number
  monthLabel?: string
}

interface TransactionSummary {
  totalEarned: number
  totalSpent: number
  byType: Array<{
    type: string
    total: number
    count: number
  }>
}

const TYPE_CONFIG: Record<TransactionType, { label: string; icon: typeof Star; color: string; bgColor: string }> = {
  PURCHASE: {
    label: 'Purchase',
    icon: ShoppingBag,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  REDEMPTION: {
    label: 'Redeemed',
    icon: Gift,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  REFERRAL: {
    label: 'Referral',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  BONUS: {
    label: 'Bonus',
    icon: Sparkle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  WELCOME: {
    label: 'Welcome',
    icon: Star,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  BIRTHDAY: {
    label: 'Birthday',
    icon: Gift,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
  },
  EXPIRED: {
    label: 'Expired',
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
  },
  ADJUSTMENT: {
    label: 'Adjustment',
    icon: TrendUp,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
  },
}

const DEFAULT_TYPE_CONFIG = {
  label: 'Points',
  icon: Star,
  color: 'text-black/60',
  bgColor: 'bg-black/5',
}

type FilterType = 'all' | 'earned' | 'spent'

export default function PointsHistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<TransactionSummary | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin?redirect=/loyalty/history')
      return
    }

    if (user) {
      fetchTransactions()
    }
  }, [user, authLoading, router])

  async function fetchTransactions() {
    try {
      const response = await fetch('/api/loyalty/transactions?limit=100')
      if (response.ok) {
        const result = await response.json()
        setTransactions(result.data || [])
        setSummary(result.summary || null)
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter transactions based on selection
  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions
    if (filter === 'earned') return transactions.filter(t => t.points > 0)
    if (filter === 'spent') return transactions.filter(t => t.points < 0)
    return transactions
  }, [transactions, filter])

  // Calculate running balance (from oldest to newest, then reverse for display)
  const transactionsWithBalance = useMemo(() => {
    // Sort by date ascending (oldest first) to calculate running balance
    const sorted = [...filteredTransactions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    
    let runningBalance = 0
    const withBalance = sorted.map(tx => {
      runningBalance += tx.points
      return {
        ...tx,
        balanceAfter: runningBalance,
      }
    })
    
    // Reverse to show newest first
    return withBalance.reverse()
  }, [filteredTransactions])

  // Group transactions by month
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, typeof transactionsWithBalance> = {}
    
    transactionsWithBalance.forEach(tx => {
      const date = new Date(tx.createdAt)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push({ ...tx, monthLabel: label })
    })
    
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [transactionsWithBalance])

  if (authLoading || loading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 bg-black flex items-center justify-center">
              <Wallet size={28} weight="fill" className="text-white" />
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-2 border-2 border-black/10 border-t-black"
            />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">Loading History</p>
        </div>
      </>
    )
  }

  const currentBalance = user?.currentPoints || 0

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-[#FAF8F5]">
        {/* Header */}
        <div className="bg-black pt-28 pb-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white mb-6">
                <Wallet size={32} weight="fill" className="text-black" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">
                Points History
              </h1>
              <p className="text-white/60">Track your Care Points journey</p>
            </motion.div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-16">
          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
          >
            {/* Current Balance */}
            <div className="bg-white border border-black/10 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-black flex items-center justify-center">
                  <Wallet size={20} weight="fill" className="text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40">Current Balance</span>
              </div>
              <p className="text-3xl font-black text-black">{currentBalance.toLocaleString()}</p>
              <p className="text-xs text-black/50 mt-1">Care Points</p>
            </div>

            {/* Total Earned */}
            <div className="bg-white border border-black/10 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-50 flex items-center justify-center">
                  <TrendUp size={20} weight="bold" className="text-emerald-600" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40">Total Earned</span>
              </div>
              <p className="text-3xl font-black text-emerald-600">+{(summary?.totalEarned || 0).toLocaleString()}</p>
              <p className="text-xs text-black/50 mt-1">Lifetime points</p>
            </div>

            {/* Total Spent */}
            <div className="bg-white border border-black/10 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-50 flex items-center justify-center">
                  <Gift size={20} weight="bold" className="text-purple-600" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40">Total Redeemed</span>
              </div>
              <p className="text-3xl font-black text-purple-600">{(summary?.totalSpent || 0).toLocaleString()}</p>
              <p className="text-xs text-black/50 mt-1">Points used</p>
            </div>
          </motion.div>

          {/* Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-black/10 p-4 mb-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Calendar size={18} weight="bold" className="text-black/40" />
              <span className="text-sm font-medium text-black/60">
                {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 transition-colors"
              >
                <FunnelSimple size={16} weight="bold" className="text-black/60" />
                <span className="text-sm font-medium text-black">
                  {filter === 'all' ? 'All Transactions' : filter === 'earned' ? 'Points Earned' : 'Points Spent'}
                </span>
                <CaretDown size={14} weight="bold" className={`text-black/40 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showFilterMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 bg-white border border-black/10 shadow-lg z-10 min-w-[180px]"
                  >
                    {[
                      { value: 'all', label: 'All Transactions' },
                      { value: 'earned', label: 'Points Earned' },
                      { value: 'spent', label: 'Points Spent' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilter(option.value as FilterType)
                          setShowFilterMenu(false)
                        }}
                        className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 transition-colors flex items-center justify-between ${
                          filter === option.value ? 'bg-black/5 text-black' : 'text-black/70'
                        }`}
                      >
                        {option.label}
                        {filter === option.value && <Check size={16} weight="bold" className="text-black" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Transactions List */}
          {filteredTransactions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white border border-black/10 p-12 text-center"
            >
              <div className="w-20 h-20 bg-black/5 flex items-center justify-center mx-auto mb-6">
                <Calendar size={40} weight="bold" className="text-black/30" />
              </div>
              <h3 className="text-xl font-bold text-black mb-2">No Transactions Yet</h3>
              <p className="text-black/60 mb-6">
                Start shopping to earn Care Points and see your history here!
              </p>
              <Link
                href="/products"
                className="inline-block px-6 py-3 bg-black text-white font-semibold hover:bg-black/90 transition-colors"
              >
                Start Shopping
              </Link>
            </motion.div>
          ) : (
            <div className="space-y-8">
              {groupedTransactions.map(([monthKey, monthTransactions], groupIndex) => (
                <motion.div
                  key={monthKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + groupIndex * 0.1 }}
                >
                  {/* Month Header */}
                  <div className="flex items-center gap-4 mb-4">
                    <h2 className="text-sm font-black uppercase tracking-[0.15em] text-black/40">
                      {(monthTransactions[0] as Transaction & { monthLabel: string }).monthLabel}
                    </h2>
                    <div className="flex-1 h-px bg-black/10" />
                  </div>

                  {/* Transactions */}
                  <div className="bg-white border border-black/10 divide-y divide-black/5">
                    {monthTransactions.map((tx, index) => {
                      const typeConfig = TYPE_CONFIG[tx.type as TransactionType] || DEFAULT_TYPE_CONFIG
                      const TypeIcon = typeConfig.icon
                      const isPositive = tx.points > 0

                      return (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="p-4 sm:p-5 hover:bg-black/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            {/* Icon */}
                            <div className={`w-12 h-12 ${typeConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                              <TypeIcon size={22} weight="bold" className={typeConfig.color} />
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <h3 className="font-bold text-black truncate">
                                    {tx.description || typeConfig.label}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                    <span className={`text-xs font-semibold ${typeConfig.color}`}>
                                      {typeConfig.label}
                                    </span>
                                    <span className="text-xs text-black/40">
                                      {new Date(tx.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    {tx.orderNumber && (
                                      <span className="text-xs text-black/40">
                                        Order #{tx.orderNumber}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Points & Balance */}
                                <div className="text-right flex-shrink-0">
                                  <div className={`flex items-center gap-1 justify-end font-black text-lg ${
                                    isPositive ? 'text-emerald-600' : 'text-black'
                                  }`}>
                                    {isPositive ? (
                                      <ArrowUp size={16} weight="bold" />
                                    ) : (
                                      <ArrowDown size={16} weight="bold" />
                                    )}
                                    <span>{isPositive ? '+' : ''}{tx.points.toLocaleString()}</span>
                                  </div>
                                  <p className="text-xs text-black/40 mt-0.5">
                                    Balance: <span className="font-semibold text-black/60">{tx.balanceAfter.toLocaleString()}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Expiration warning */}
                              {tx.expiresAt && !tx.isExpired && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                                  <Clock size={12} weight="bold" />
                                  <span>Expires {new Date(tx.expiresAt).toLocaleDateString()}</span>
                                </div>
                              )}
                              {tx.isExpired && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-black/40">
                                  <X size={12} weight="bold" />
                                  <span>Expired</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Bottom Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 flex flex-wrap justify-center gap-4"
          >
            <Link
              href="/loyalty/rewards"
              className="px-6 py-3 bg-black text-white font-semibold hover:bg-black/90 transition-colors flex items-center gap-2"
            >
              <Gift size={18} weight="bold" />
              Redeem Rewards
            </Link>
            <Link
              href="/profile"
              className="px-6 py-3 bg-white border border-black/10 text-black font-semibold hover:bg-black/5 transition-colors"
            >
              Back to Profile
            </Link>
          </motion.div>
        </div>
      </div>
    </>
  )
}
