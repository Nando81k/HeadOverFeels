'use client'

import { Star } from 'lucide-react'

interface ProductRatingProps {
  stats: {
    averageRating: number
    totalReviews: number
    distribution: Record<number, number>
  }
}

export default function ProductRating({ stats }: ProductRatingProps) {
  const { averageRating, totalReviews, distribution } = stats

  // Calculate percentage for each rating
  const getPercentage = (count: number) => {
    if (totalReviews === 0) return 0
    return Math.round((count / totalReviews) * 100)
  }

  // Render star visualization (with half stars)
  const renderStars = (rating: number, size: 'sm' | 'lg' = 'lg') => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5

    const starSize = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        // Full star
        stars.push(
          <Star
            key={i}
            className={`${starSize} fill-yellow-400 text-yellow-400`}
          />
        )
      } else if (i === fullStars + 1 && hasHalfStar) {
        // Half star
        stars.push(
          <div key={i} className="relative">
            <Star className={`${starSize} text-gray-300`} />
            <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
              <Star className={`${starSize} fill-yellow-400 text-yellow-400`} />
            </div>
          </div>
        )
      } else {
        // Empty star
        stars.push(
          <Star
            key={i}
            className={`${starSize} text-gray-300`}
          />
        )
      }
    }

    return stars
  }

  if (totalReviews === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Customer Reviews</h3>
        <p className="text-gray-500">No reviews yet. Be the first to review this product!</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold mb-6">Customer Reviews</h3>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Overall Rating */}
        <div className="text-center md:text-left">
          <div className="flex items-baseline justify-center md:justify-start gap-2 mb-2">
            <span className="text-5xl font-bold">{averageRating.toFixed(1)}</span>
            <span className="text-gray-500">out of 5</span>
          </div>
          
          <div className="flex justify-center md:justify-start gap-1 mb-2">
            {renderStars(averageRating)}
          </div>

          <p className="text-gray-600">
            Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        {/* Rating Distribution */}
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = distribution[rating] || 0
            const percentage = getPercentage(count)

            return (
              <div key={rating} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-16">
                  <span className="text-sm font-medium">{rating}</span>
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                </div>

                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-yellow-400 h-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <span className="text-sm text-gray-600 w-12 text-right">
                  {percentage}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
