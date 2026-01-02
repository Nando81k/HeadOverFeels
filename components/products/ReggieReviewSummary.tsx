'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Robot, 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  Target, 
  Sparkle,
  CircleNotch,
  Info
} from '@phosphor-icons/react'
import Image from 'next/image'

interface ReggieReviewSummary {
  headline: string
  summary: string
  pros: string[]
  cons: string[]
  bestFor: string
  reggieVerdict: string
}

interface ReviewStats {
  averageRating: number
  totalReviews: number
  ratingDistribution: Record<number, number>
  verifiedCount: number
}

interface ReggieReviewSummaryProps {
  productId: string
  productName: string
}

export default function ReggieReviewSummaryComponent({ productId, productName }: ReggieReviewSummaryProps) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<ReggieReviewSummary | null>(null)
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    async function fetchSummary() {
      try {
        const response = await fetch(`/api/reviews/ai-summary?productId=${productId}`)
        const data = await response.json()

        if (data.hasSummary) {
          setSummary(data.summary)
          setStats(data.stats)
        } else {
          // Not enough reviews
          setError(data.message)
        }
      } catch (err) {
        console.error('Failed to fetch AI summary:', err)
        setError('Unable to load AI summary')
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [productId])

  // Loading state
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100 p-6">
        <div className="flex items-center gap-3">
          <CircleNotch size={24} className="text-violet-500 animate-spin" />
          <span className="text-gray-600">Reggie is analyzing reviews...</span>
        </div>
      </div>
    )
  }

  // No summary available
  if (error || !summary || !stats) {
    return null // Don't show anything if not enough reviews
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 rounded-2xl border border-violet-200 overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 border-b border-violet-100 bg-white/50">
        <div className="flex items-start gap-4">
          {/* Reggie Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-200">
            <Robot size={24} className="text-white" weight="fill" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-gray-900">Reggie&apos;s Take</span>
              <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-medium rounded-full flex items-center gap-1">
                <Sparkle size={10} weight="fill" />
                AI Summary
              </span>
            </div>
            <p className="text-lg font-semibold text-violet-700">{summary.headline}</p>
          </div>

          {/* Overall Rating Badge */}
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <Star size={20} weight="fill" className="text-amber-400" />
              <span className="text-2xl font-bold text-gray-900">{stats.averageRating}</span>
            </div>
            <p className="text-xs text-gray-500">{stats.totalReviews} reviews</p>
          </div>
        </div>
      </div>

      {/* Summary Content */}
      <div className="p-5 space-y-5">
        {/* Main Summary */}
        <p className="text-gray-700 leading-relaxed">{summary.summary}</p>

        {/* Pros and Cons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pros */}
          {summary.pros.length > 0 && (
            <div className="bg-emerald-50/70 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-3">
                <ThumbsUp size={18} weight="fill" className="text-emerald-600" />
                <span className="font-semibold text-emerald-800 text-sm">What Customers Love</span>
              </div>
              <ul className="space-y-2">
                {summary.pros.map((pro, i) => (
                  <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                    <span className="text-emerald-500 mt-1">•</span>
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cons */}
          {summary.cons.length > 0 && (
            <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-3">
                <ThumbsDown size={18} weight="fill" className="text-amber-600" />
                <span className="font-semibold text-amber-800 text-sm">Worth Noting</span>
              </div>
              <ul className="space-y-2">
                {summary.cons.map((con, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Best For */}
        {summary.bestFor && (
          <div className="bg-blue-50/70 rounded-xl p-4 border border-blue-100 flex items-start gap-3">
            <Target size={20} weight="fill" className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-800 text-sm">Perfect For</span>
              <p className="text-sm text-blue-700 mt-1">{summary.bestFor}</p>
            </div>
          </div>
        )}

        {/* Reggie's Verdict */}
        <div className="bg-gradient-to-r from-violet-100 to-purple-100 rounded-xl p-4 border border-violet-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Robot size={16} className="text-white" weight="fill" />
            </div>
            <div>
              <span className="font-semibold text-violet-800 text-sm">Reggie&apos;s Verdict</span>
              <p className="text-violet-700 mt-1 italic">&ldquo;{summary.reggieVerdict}&rdquo;</p>
            </div>
          </div>
        </div>

        {/* Toggle More Details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-violet-600 transition-colors mx-auto"
        >
          <Info size={16} />
          {showDetails ? 'Hide rating breakdown' : 'Show rating breakdown'}
        </button>

        {/* Rating Distribution */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-violet-100">
                <p className="text-sm font-medium text-gray-700 mb-3">Rating Distribution</p>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = stats.ratingDistribution[rating] || 0
                    const percentage = stats.totalReviews > 0 
                      ? Math.round((count / stats.totalReviews) * 100) 
                      : 0
                    return (
                      <div key={rating} className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 w-12">
                          <span className="text-xs text-gray-600">{rating}</span>
                          <Star size={12} weight="fill" className="text-amber-400" />
                        </div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">
                          {count} ({percentage}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center">
                  {stats.verifiedCount} of {stats.totalReviews} reviews are from verified purchases
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
