'use client'

import { Star, ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

interface Review {
  id: string
  rating: number
  title?: string | null
  comment: string
  images?: string | null
  customerName: string
  isVerified: boolean
  helpfulCount: number
  notHelpfulCount: number
  createdAt: string
  adminReply?: string | null
  adminReplyAt?: string | null
}

interface ReviewCardProps {
  review: Review
}

export function ReviewCard({ review }: ReviewCardProps) {
  const [showFullComment, setShowFullComment] = useState(false)
  const commentPreviewLength = 300

  const shouldTruncate = review.comment.length > commentPreviewLength
  const displayComment = showFullComment || !shouldTruncate
    ? review.comment
    : review.comment.substring(0, commentPreviewLength) + '...'

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="border-b border-gray-200 pb-6 last:border-0">
      {/* Rating and Name */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= review.rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900">{review.customerName}</p>
            {review.isVerified && (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Verified Purchase
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500">{formatDate(review.createdAt)}</p>
      </div>

      {/* Review Title */}
      {review.title && (
        <h4 className="font-semibold text-gray-900 mb-2">{review.title}</h4>
      )}

      {/* Review Comment */}
      <p className="text-gray-700 mb-3 whitespace-pre-wrap">{displayComment}</p>
      
      {shouldTruncate && (
        <button
          onClick={() => setShowFullComment(!showFullComment)}
          className="text-sm text-black font-medium hover:underline mb-3"
        >
          {showFullComment ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* Review Images */}
      {review.images && (
        <div className="flex gap-2 mb-3">
          {JSON.parse(review.images).map((imageUrl: string, index: number) => (
            <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden">
              <Image
                src={imageUrl}
                alt={`Review image ${index + 1}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Helpful Votes */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>Was this helpful?</span>
        <button className="flex items-center gap-1 hover:text-black transition-colors">
          <ThumbsUp className="w-4 h-4" />
          <span>Yes ({review.helpfulCount})</span>
        </button>
        <button className="flex items-center gap-1 hover:text-black transition-colors">
          <ThumbsDown className="w-4 h-4" />
          <span>No ({review.notHelpfulCount})</span>
        </button>
      </div>

      {/* Admin Reply */}
      {review.adminReply && (
        <div className="mt-4 ml-6 pl-4 border-l-4 border-purple-200 bg-purple-50 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">HF</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Head Over Feels Team</p>
              {review.adminReplyAt && (
                <p className="text-xs text-gray-500">{formatDate(review.adminReplyAt)}</p>
              )}
            </div>
          </div>
          <p className="text-gray-700 text-sm whitespace-pre-wrap">{review.adminReply}</p>
        </div>
      )}
    </div>
  )
}

interface ReviewListProps {
  productId: string
  initialReviews?: Review[]
  initialStats?: {
    averageRating: number
    totalReviews: number
    distribution: Record<number, number>
  }
}

export function ReviewList({ productId, initialReviews = [], initialStats }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [sortBy, setSortBy] = useState('newest')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const loadReviews = async (resetPage = false) => {
    setLoading(true)
    try {
      const currentPage = resetPage ? 1 : page
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        sortBy,
        ...(verifiedOnly && { verified: 'true' })
      })

      const response = await fetch(`/api/products/${productId}/reviews?${params}`)
      const data = await response.json()

      if (resetPage) {
        setReviews(data.data)
        setPage(1)
      } else {
        setReviews([...reviews, ...data.data])
      }

      setHasMore(data.pagination.hasNextPage)
    } catch (error) {
      console.error('Failed to load reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy)
    loadReviews(true)
  }

  const handleVerifiedToggle = () => {
    setVerifiedOnly(!verifiedOnly)
    loadReviews(true)
  }

  const handleLoadMore = () => {
    setPage(page + 1)
    loadReviews()
  }

  if (!initialStats || initialStats.totalReviews === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No reviews yet. Be the first to review this product!
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={handleVerifiedToggle}
              className="rounded border-gray-300 text-black focus:ring-black"
            />
            <span className="text-sm text-gray-700">Verified purchases only</span>
          </label>
        </div>

        <select
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="highest">Highest Rating</option>
          <option value="lowest">Lowest Rating</option>
          <option value="helpful">Most Helpful</option>
        </select>
      </div>

      {/* Reviews */}
      <div className="space-y-6">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More Reviews'}
          </button>
        </div>
      )}
    </div>
  )
}
