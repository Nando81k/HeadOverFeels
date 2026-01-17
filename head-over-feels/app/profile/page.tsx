'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/layout/Navigation'
import { useAuth } from '@/lib/auth/context'
import { User, Package, SignOut, CircleNotch, Medal, Sparkle, Gift, TrendUp, ArrowRight, Gear, ClockCounterClockwise, ShoppingBag, Star, Coins } from '@phosphor-icons/react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { calculateTierProgress } from '@/lib/loyalty/tier-progress'

interface PointsTransaction {
  id: string
  points: number
  type: string
  description: string
  createdAt: string
  order?: { orderNumber: string } | null
}

interface Order {
  id: string
  orderNumber: string
  status: string
  total: number
  createdAt: string
  items: {
    productName: string
    quantity: number
  }[]
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading, signout } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([])
  const [loadingPoints, setLoadingPoints] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin')
    }
  }, [user, authLoading, router])

  const fetchOrders = async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/orders', {
        headers: {
          'x-user-email': user.email || '',
          'x-user-admin': user.isAdmin ? 'true' : 'false',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setOrders(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoadingOrders(false)
    }
  }

  const fetchPointsHistory = async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/loyalty/points-history?limit=5')
      if (response.ok) {
        const data = await response.json()
        setPointsHistory(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch points history:', error)
    } finally {
      setLoadingPoints(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchOrders()
      fetchPointsHistory()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleSignout = async () => {
    await signout()
    router.push('/')
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  const tierProgress = user.loyaltyTier 
    ? calculateTierProgress(user.loyaltyTier.slug, user.annualPointsEarned ?? 0)
    : null

  const recentOrders = orders.slice(0, 3)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'bg-emerald-500'
      case 'SHIPPED': return 'bg-violet-500'
      case 'PROCESSING': return 'bg-blue-500'
      default: return 'bg-black/40'
    }
  }

  // Tier-specific color themes
  const getTierColors = (tierSlug: string) => {
    const tierColors: Record<string, { gradient: string; iconBg: string; progressBg: string; progressFill: string; badge: string }> = {
      newcomer: {
        gradient: 'from-blue-500 via-blue-600 to-indigo-700',
        iconBg: 'bg-blue-400/30',
        progressBg: 'bg-blue-400/30',
        progressFill: 'bg-blue-300',
        badge: 'bg-blue-400/30',
      },
      friend: {
        gradient: 'from-pink-500 via-rose-500 to-pink-600',
        iconBg: 'bg-pink-400/30',
        progressBg: 'bg-pink-400/30',
        progressFill: 'bg-pink-300',
        badge: 'bg-pink-400/30',
      },
      bestie: {
        gradient: 'from-emerald-500 via-green-500 to-teal-600',
        iconBg: 'bg-emerald-400/30',
        progressBg: 'bg-emerald-400/30',
        progressFill: 'bg-emerald-300',
        badge: 'bg-emerald-400/30',
      },
      soulmate: {
        gradient: 'from-purple-500 via-violet-500 to-purple-700',
        iconBg: 'bg-purple-400/30',
        progressBg: 'bg-purple-400/30',
        progressFill: 'bg-purple-300',
        badge: 'bg-purple-400/30',
      },
    }
    return tierColors[tierSlug] || tierColors.newcomer
  }

  const currentTierColors = user.loyaltyTier ? getTierColors(user.loyaltyTier.slug) : getTierColors('newcomer')

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <Navigation />
      
      <div className="pt-24 pb-6 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Compact Header */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-5"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center">
                <User size={32} weight="bold" className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-black">
                  {user.name || 'Welcome back'}
                </h1>
                <p className="text-sm text-black/50">{user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-black/80 transition-colors"
                >
                  <Gear size={16} weight="bold" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}
              <button
                onClick={handleSignout}
                className="flex items-center gap-2 px-4 py-2 bg-black/5 text-black/70 rounded-full text-sm font-medium hover:bg-black/10 transition-colors"
              >
                <SignOut size={16} weight="bold" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </motion.div>

          {/* Main Grid - Optimized for single screen viewing */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Row 1: Loyalty Card (7 cols) + Quick Stats (5 cols) */}
            {user.loyaltyTier && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`lg:col-span-7 bg-gradient-to-br ${currentTierColors.gradient} rounded-2xl p-6 text-white shadow-xl relative overflow-hidden`}
              >
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Medal size={24} weight="bold" className="text-white/80" />
                      <div>
                        <span className="text-xs font-medium uppercase tracking-wider text-white/70">Loyalty Tier</span>
                        <h2 className="text-3xl font-bold leading-tight">{user.loyaltyTier.name}</h2>
                      </div>
                    </div>
                    <span className={`px-4 py-1.5 ${currentTierColors.badge} backdrop-blur-sm rounded-full text-sm font-semibold`}>
                      {user.loyaltyTier.pointMultiplier}x Points
                    </span>
                  </div>

                  {/* Stats Row - Horizontal */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`flex-1 ${currentTierColors.iconBg} backdrop-blur-sm rounded-xl p-4`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkle size={14} weight="fill" className="text-white/80" />
                        <span className="text-[10px] uppercase tracking-wider text-white/70">Points</span>
                      </div>
                      <p className="text-2xl font-bold">{user.currentPoints.toLocaleString()}</p>
                    </div>
                    <div className={`flex-1 ${currentTierColors.iconBg} backdrop-blur-sm rounded-xl p-4`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Gift size={14} weight="bold" className="text-white/80" />
                        <span className="text-[10px] uppercase tracking-wider text-white/70">Spent</span>
                      </div>
                      <p className="text-2xl font-bold">${user.totalSpent.toFixed(0)}</p>
                    </div>
                    <Link
                      href="/loyalty/rewards"
                      className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm text-white px-5 py-4 rounded-xl font-medium hover:bg-white/30 transition-colors text-sm whitespace-nowrap"
                    >
                      Rewards
                      <ArrowRight size={16} weight="bold" />
                    </Link>
                  </div>

                  {/* Tier Progress - Compact */}
                  {tierProgress && !tierProgress.isMaxTier ? (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-white/70 flex items-center gap-1">
                          <TrendUp size={12} weight="bold" />
                          Next: {tierProgress.nextTier?.name}
                        </span>
                        <span className="text-white/90 font-medium">{tierProgress.pointsNeeded.toLocaleString()} pts away</span>
                      </div>
                      <div className={`h-2 ${currentTierColors.progressBg} rounded-full overflow-hidden`}>
                        <div
                          className={`h-full ${currentTierColors.progressFill} rounded-full transition-all duration-500`}
                          style={{ width: `${tierProgress.progressPercentage}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-white/80">
                      <Medal size={16} weight="fill" />
                      <span>You&apos;ve reached the highest tier! 🎉</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Quick Stats - 5 columns, stacked 2x2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className={`${user.loyaltyTier ? 'lg:col-span-5' : 'lg:col-span-12'} grid grid-cols-2 gap-3`}
            >
              <div className="bg-white rounded-xl p-4 border border-black/5">
                <p className="text-[10px] uppercase tracking-wider text-black/40 mb-1">Member Since</p>
                <p className="text-lg font-bold text-black">
                  {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-black/5">
                <p className="text-[10px] uppercase tracking-wider text-black/40 mb-1">Total Orders</p>
                <p className="text-lg font-bold text-black">{user.totalOrders || orders.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-black/5">
                <p className="text-[10px] uppercase tracking-wider text-black/40 mb-1">Lifetime Points</p>
                <p className="text-lg font-bold text-black">{user.lifetimePoints?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-black/5">
                <p className="text-[10px] uppercase tracking-wider text-black/40 mb-1">Newsletter</p>
                <p className="text-lg font-bold text-black">{user.newsletter ? '✓ Yes' : 'No'}</p>
              </div>
            </motion.div>

            {/* Row 2: Points History (5 cols) + Recent Orders (7 cols) */}
            {user.loyaltyTier && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="lg:col-span-5 bg-white rounded-2xl border border-black/5 overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
                  <div className="flex items-center gap-2">
                    <ClockCounterClockwise size={18} weight="bold" className="text-black/60" />
                    <h3 className="font-bold text-base text-black">Points History</h3>
                  </div>
                  <Link
                    href="/loyalty/history"
                    className="text-xs text-black/50 hover:text-black transition-colors flex items-center gap-1"
                  >
                    View all
                    <ArrowRight size={12} />
                  </Link>
                </div>
                
                {loadingPoints ? (
                  <div className="flex items-center justify-center py-8">
                    <CircleNotch size={20} weight="bold" className="animate-spin text-black/30" />
                  </div>
                ) : pointsHistory.length === 0 ? (
                  <div className="text-center py-8 px-5">
                    <Coins size={28} weight="light" className="text-black/20 mx-auto mb-2" />
                    <p className="text-sm text-black/50">No points activity yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-black/5 max-h-[200px] overflow-y-auto">
                    {pointsHistory.slice(0, 4).map((tx) => {
                      const getIcon = () => {
                        switch (tx.type) {
                          case 'PURCHASE': return <ShoppingBag size={14} weight="bold" className="text-green-500" />
                          case 'REVIEW': return <Star size={14} weight="fill" className="text-amber-500" />
                          case 'REDEMPTION': return <Gift size={14} weight="bold" className="text-purple-500" />
                          default: return <Sparkle size={14} weight="fill" className="text-blue-500" />
                        }
                      }
                      return (
                        <div key={tx.id} className="flex items-center justify-between px-5 py-3 hover:bg-black/[0.02] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-black/5 rounded-lg flex items-center justify-center">
                              {getIcon()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-black truncate max-w-[140px]">{tx.description}</p>
                              <p className="text-[10px] text-black/40">
                                {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <span className={`font-bold text-sm ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {tx.points > 0 ? '+' : ''}{tx.points}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Recent Orders - 7 cols or full width */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className={`${user.loyaltyTier ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white rounded-2xl border border-black/5 overflow-hidden`}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
                <div className="flex items-center gap-2">
                  <Package size={18} weight="bold" className="text-black" />
                  <h2 className="text-base font-bold text-black">Recent Orders</h2>
                </div>
                {orders.length > 2 && (
                  <Link
                    href="/orders"
                    className="text-xs text-black/50 hover:text-black transition-colors flex items-center gap-1"
                  >
                    View all
                    <ArrowRight size={12} />
                  </Link>
                )}
              </div>

              {loadingOrders ? (
                <div className="flex items-center justify-center py-10">
                  <CircleNotch size={20} weight="bold" className="animate-spin text-black/30" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 px-5">
                  <Package size={32} weight="light" className="text-black/20 mx-auto mb-2" />
                  <h3 className="text-base font-medium text-black mb-1">No orders yet</h3>
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-black/80 transition-colors"
                  >
                    Shop Now
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-black/5 max-h-[200px] overflow-y-auto">
                  {recentOrders.slice(0, 3).map((order) => (
                    <Link
                      key={order.id}
                      href={`/order/track/${order.id}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-black/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(order.status)}`} />
                        <div>
                          <p className="font-medium text-black text-sm">
                            #{order.orderNumber}
                          </p>
                          <p className="text-xs text-black/50 truncate max-w-[180px]">
                            {order.items.slice(0, 2).map(i => i.productName).join(', ')}
                            {order.items.length > 2 && ` +${order.items.length - 2}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="font-semibold text-black text-sm">${order.total.toFixed(2)}</p>
                          <p className="text-[10px] text-black/40">
                            {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <ArrowRight size={16} className="text-black/30" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Quick Actions - Row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="lg:col-span-12 grid grid-cols-4 gap-3"
            >
              <Link
                href="/products"
                className="flex items-center justify-center gap-2 bg-black text-white py-3 px-4 rounded-xl font-medium hover:bg-black/80 transition-colors text-sm"
              >
                Shop Now
              </Link>
              <Link
                href="/wishlist"
                className="flex items-center justify-center gap-2 bg-white text-black py-3 px-4 rounded-xl font-medium hover:bg-black/5 transition-colors text-sm border border-black/10"
              >
                Wishlist
              </Link>
              <Link
                href="/profile/avatar"
                className="flex items-center justify-center gap-2 bg-white text-black py-3 px-4 rounded-xl font-medium hover:bg-black/5 transition-colors text-sm border border-black/10"
              >
                Create Avatar
              </Link>
              <Link
                href="/collections"
                className="flex items-center justify-center gap-2 bg-white text-black py-3 px-4 rounded-xl font-medium hover:bg-black/5 transition-colors text-sm border border-black/10"
              >
                Collections
              </Link>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  )
}
