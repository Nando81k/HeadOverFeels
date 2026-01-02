'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Gift, Check, X, Clock, ArrowLeft, CircleNotch } from '@phosphor-icons/react'

type RedemptionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'

interface Redemption {
  id: string
  rewardName: string
  rewardType: string
  pointsSpent: number
  status: RedemptionStatus
  couponCode: string | null
  usedAt: string | null
  createdAt: string
}

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    icon: Clock,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
  },
  COMPLETED: {
    label: 'Completed',
    icon: Check,
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: X,
    color: 'text-red-600',
    bg: 'bg-red-100',
  },
  EXPIRED: {
    label: 'Expired',
    icon: X,
    color: 'text-black/60',
    bg: 'bg-black/5',
  },
}

export default function RedemptionHistory() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin?redirect=/loyalty/history')
      return
    }

    if (user) {
      fetchRedemptions()
    }
  }, [user, authLoading, router])

  async function fetchRedemptions() {
    try {
      const response = await fetch('/api/loyalty/redemptions')
      if (response.ok) {
        const data = await response.json()
        setRedemptions(data)
      }
    } catch (error) {
      console.error('Failed to fetch redemptions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
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
              <Calendar size={24} weight="fill" className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-black">Redemption History</h1>
              <p className="text-black/60">View all your past reward redemptions</p>
            </div>
          </div>
        </div>

        {redemptions.length === 0 ? (
          <div className="bg-white border border-black/10 p-12 text-center">
            <Gift size={64} weight="bold" className="text-black/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-black mb-2">No Redemptions Yet</h3>
            <p className="text-black/60 mb-6">
              You haven&apos;t redeemed any rewards yet. Start shopping to earn points!
            </p>
            <Link
              href="/loyalty/rewards"
              className="inline-block px-6 py-3 bg-black text-white font-semibold hover:bg-black/90 transition-colors"
            >
              Browse Rewards
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {redemptions.map((redemption) => {
              const statusConfig = STATUS_CONFIG[redemption.status]
              const StatusIcon = statusConfig.icon

              return (
                <div
                  key={redemption.id}
                  className="bg-white border border-black/10 p-6 hover:border-black/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-black/5 flex items-center justify-center flex-shrink-0">
                        <Gift size={24} weight="bold" className="text-black" />
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-black mb-1">
                          {redemption.rewardName}
                        </h3>
                        <p className="text-sm text-black/60 mb-2">
                          {redemption.rewardType.replace('_', ' ')}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="text-black font-semibold">
                            {redemption.pointsSpent.toLocaleString()} points
                          </span>
                          <span className="text-black/60">
                            {new Date(redemption.createdAt).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        {redemption.couponCode && (
                          <div className="mt-3 p-3 bg-black/5">
                            <p className="text-xs text-black/60 mb-1">Coupon Code:</p>
                            <code className="text-sm font-mono font-bold text-black">
                              {redemption.couponCode}
                            </code>
                          </div>
                        )}

                        {redemption.usedAt && (
                          <p className="text-xs text-black/60 mt-2">
                            Used on {new Date(redemption.usedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className={`px-3 py-1.5 ${statusConfig.bg} flex items-center gap-1.5 flex-shrink-0`}>
                      <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                      <span className={`text-xs font-semibold ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link
            href="/loyalty/rewards"
            className="px-6 py-3 bg-black text-white font-semibold hover:bg-black/90 transition-colors"
          >
            Browse More Rewards
          </Link>
          <Link
            href="/loyalty/points"
            className="px-6 py-3 bg-white border border-black/10 text-black font-semibold hover:bg-black/5 transition-colors"
          >
            View Points History
          </Link>
        </div>
      </div>
    </div>
  )
}
