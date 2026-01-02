'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  CircleNotch, 
  TrendUp, 
  TrendDown, 
  ShoppingCart, 
  Gift, 
  Star, 
  Users, 
  Calendar,
  Sparkle,
  Clock,
  CaretDown,
  Funnel,
  Export
} from '@phosphor-icons/react'

type TransactionType = 'PURCHASE' | 'REDEMPTION' | 'REFERRAL' | 'BONUS' | 'ADJUSTMENT' | 'EXPIRATION' | 'REVIEW'

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
}

interface Summary {
  totalEarned: number
  totalSpent: number
  byType: Array<{
    type: TransactionType
    total: number
    count: number
  }>
}

const TYPE_CONFIG: Record<TransactionType, { label: string; icon: typeof ShoppingCart; color: string; bgColor: string }> = {
  PURCHASE: {
    label: 'Purchase',
    icon: ShoppingCart,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  REDEMPTION: {
    label: 'Redemption',
    icon: Gift,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  REFERRAL: {
    label: 'Referral',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  BONUS: {
    label: 'Bonus',
    icon: Sparkle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  ADJUSTMENT: {
    label: 'Adjustment',
    icon: TrendUp,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  EXPIRATION: {
    label: 'Expired',
    icon: Clock,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  REVIEW: {
    label: 'Review',
    icon: Star,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
}

export default function PointsHistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterType, setFilterType] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin?redirect=/loyalty/points')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchTransactions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page, filterType])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })
      
      if (filterType !== 'all') {
        params.set('type', filterType)
      }

      const response = await fetch(`/api/loyalty/transactions?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.data || [])
        setSummary(data.summary || null)
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors mb-6 group"
        >
          <ArrowLeft size={20} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Profile</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-black flex items-center justify-center">
              <TrendUp size={24} weight="fill" className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-black">Points History</h1>
              <p className="text-black/60">Track your Care Points activity</p>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendUp size={18} weight="bold" className="text-green-600" />
                  <p className="text-sm text-green-700">Total Earned</p>
                </div>
                <p className="text-2xl font-bold text-green-800">
                  +{summary.totalEarned.toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendDown size={18} weight="bold" className="text-purple-600" />
                  <p className="text-sm text-purple-700">Total Redeemed</p>
                </div>
                <p className="text-2xl font-bold text-purple-800">
                  -{summary.totalSpent.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-black/10 hover:bg-black/5 transition-colors"
            >
              <Funnel size={18} weight="bold" />
              <span className="font-medium">Filter</span>
              <CaretDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {filterType !== 'all' && (
              <button
                onClick={() => setFilterType('all')}
                className="text-sm text-black/60 hover:text-black underline"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/loyalty/history"
              className="text-sm text-black/60 hover:text-black transition-colors"
            >
              View Redemptions →
            </Link>
          </div>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="bg-black/5 p-4 mb-6 flex flex-wrap gap-2">
            {['all', 'PURCHASE', 'REDEMPTION', 'REFERRAL', 'BONUS', 'REVIEW'].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type)
                  setPage(1)
                }}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-black text-white'
                    : 'bg-white border border-black/10 hover:bg-black/5'
                }`}
              >
                {type === 'all' ? 'All Types' : TYPE_CONFIG[type as TransactionType]?.label || type}
              </button>
            ))}
          </div>
        )}

        {/* Transactions List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <CircleNotch size={32} className="animate-spin text-black/40 mx-auto mb-3" />
              <p className="text-black/60">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 bg-black/5">
              <Calendar size={48} weight="light" className="text-black/30 mx-auto mb-3" />
              <p className="text-black/60 font-medium">No transactions found</p>
              <p className="text-sm text-black/40 mt-1">
                {filterType !== 'all' ? 'Try a different filter' : 'Start earning points by making purchases!'}
              </p>
            </div>
          ) : (
            transactions.map((tx) => {
              const config = TYPE_CONFIG[tx.type] || TYPE_CONFIG.ADJUSTMENT
              const Icon = config.icon
              const isPositive = tx.points > 0

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 p-4 border border-black/10 hover:bg-black/[0.02] transition-colors"
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 ${config.bgColor} flex items-center justify-center shrink-0`}>
                    <Icon size={20} weight="fill" className={config.color} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-black truncate">{tx.description}</p>
                    <div className="flex items-center gap-2 text-sm text-black/50">
                      <span>{formatDate(tx.createdAt)}</span>
                      {tx.orderNumber && (
                        <>
                          <span>•</span>
                          <span>Order #{tx.orderNumber}</span>
                        </>
                      )}
                      {tx.isExpired && (
                        <>
                          <span>•</span>
                          <span className="text-red-500">Expired</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Points */}
                  <div className={`text-right font-bold ${isPositive ? 'text-green-600' : 'text-purple-600'}`}>
                    {isPositive ? '+' : ''}{tx.points.toLocaleString()}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-black/10 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/5 transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-black/60">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-black/10 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/5 transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-12 pt-8 border-t border-black/10">
          <h3 className="text-sm font-medium text-black/60 uppercase tracking-wide mb-4">Related Pages</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/loyalty/rewards"
              className="flex items-center gap-3 p-4 border border-black/10 hover:bg-black/5 transition-colors"
            >
              <Gift size={24} weight="fill" className="text-purple-600" />
              <div>
                <p className="font-medium text-black">Rewards Catalog</p>
                <p className="text-sm text-black/50">Redeem your points</p>
              </div>
            </Link>
            <Link
              href="/loyalty/history"
              className="flex items-center gap-3 p-4 border border-black/10 hover:bg-black/5 transition-colors"
            >
              <Clock size={24} weight="fill" className="text-amber-600" />
              <div>
                <p className="font-medium text-black">Redemption History</p>
                <p className="text-sm text-black/50">View your coupon codes</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
