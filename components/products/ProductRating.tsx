'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, CaretDown, ChatCircleDots } from '@phosphor-icons/react'

interface ProductRatingProps {
  stats: {
    averageRating: number
    totalReviews: number
    distribution: Record<number, number>
  }
}

export default function ProductRating({ stats }: ProductRatingProps) {
  const { averageRating, totalReviews, distribution } = stats
  const [showDistribution, setShowDistribution] = useState(false)

  // Calculate percentage for each rating
  const getPercentage = (count: number) => {
    if (totalReviews === 0) return 0
    return Math.round((count / totalReviews) * 100)
  }

  // Render compact stars
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = i <= Math.floor(rating)
          const partial = !filled && i === Math.ceil(rating) && rating % 1 >= 0.5
          
          return (
            <div key={i} className="relative">
              <Star 
                size={16} 
                weight={filled ? 'fill' : 'regular'}
                className={filled ? 'text-amber-400' : 'text-gray-300'}
              />
              {partial && (
                <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                  <Star size={16} weight="fill" className="text-amber-400" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Mini distribution bar (inline)
  const renderMiniDistribution = () => {
    const bars = [5, 4, 3, 2, 1].map(rating => ({
      rating,
      percentage: getPercentage(distribution[rating] || 0)
    }))

    return (
      <div className="flex gap-0.5 h-4 items-end">
        {bars.map(({ rating, percentage }) => (
          <div
            key={rating}
            className="w-2 bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-sm transition-all"
            style={{ height: `${Math.max(percentage * 0.16, 2)}px` }}
            title={`${rating} stars: ${percentage}%`}
          />
        ))}
      </div>
    )
  }

  if (totalReviews === 0) {
    return (
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl px-5 py-4 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <ChatCircleDots size={20} className="text-gray-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Customer Reviews</h3>
              <p className="text-sm text-gray-500">Be the first to review this product!</p>
            </div>
          </div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} size={16} className="text-gray-200" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 rounded-2xl border border-amber-100/50 overflow-hidden">
      {/* Compact Header Row */}
      <button
        onClick={() => setShowDistribution(!showDistribution)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-amber-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Rating Badge */}
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-amber-400 to-orange-400 text-white px-3 py-1.5 rounded-xl">
              <span className="text-xl font-bold">{averageRating.toFixed(1)}</span>
            </div>
            {renderStars(averageRating)}
          </div>

          {/* Review Count */}
          <div className="flex items-center gap-2 text-gray-600">
            <span className="text-sm font-medium">{totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}</span>
            {renderMiniDistribution()}
          </div>
        </div>

        {/* Expand Toggle */}
        <div className="flex items-center gap-2 text-gray-500">
          <span className="text-xs">Details</span>
          <motion.div
            animate={{ rotate: showDistribution ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <CaretDown size={16} weight="bold" />
          </motion.div>
        </div>
      </button>

      {/* Expandable Distribution */}
      <AnimatePresence>
        {showDistribution && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-2 border-t border-amber-100/50">
              <div className="grid grid-cols-5 gap-3">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = distribution[rating] || 0
                  const percentage = getPercentage(count)

                  return (
                    <div key={rating} className="text-center">
                      <div className="flex items-center justify-center gap-0.5 mb-1">
                        <span className="text-xs font-semibold text-gray-700">{rating}</span>
                        <Star size={12} weight="fill" className="text-amber-400" />
                      </div>
                      <div className="h-12 bg-gray-100 rounded-lg relative overflow-hidden">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${percentage}%` }}
                          transition={{ duration: 0.5, delay: (5 - rating) * 0.05 }}
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-400 to-amber-300 rounded-lg"
                        />
                      </div>
                      <span className="text-xs text-gray-500 mt-1 block">{percentage}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
