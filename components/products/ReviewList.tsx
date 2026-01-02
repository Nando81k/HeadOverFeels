'use client'

import { Star, ThumbsUp, ThumbsDown, CheckCircle, CaretDown, Funnel, User, ChatCircle } from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'

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
  isExpanded: boolean
  onToggle: () => void
  onVote: (reviewId: string, voteType: 'helpful' | 'not_helpful') => Promise<void>
}

export function ReviewCard({ review, isExpanded, onToggle, onVote }: ReviewCardProps) {
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount)
  const [notHelpfulCount, setNotHelpfulCount] = useState(review.notHelpfulCount)
  const [voted, setVoted] = useState<'helpful' | 'not_helpful' | null>(null)
  const [voting, setVoting] = useState(false)
  const commentPreviewLength = 150

  // Check localStorage for previous votes
  useEffect(() => {
    const votedReviews = JSON.parse(localStorage.getItem('votedReviews') || '{}')
    if (votedReviews[review.id]) {
      setVoted(votedReviews[review.id])
    }
  }, [review.id])

  const handleVote = async (voteType: 'helpful' | 'not_helpful', e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (voted || voting) return
    
    setVoting(true)
    try {
      await onVote(review.id, voteType)
      
      // Update local count
      if (voteType === 'helpful') {
        setHelpfulCount(prev => prev + 1)
      } else {
        setNotHelpfulCount(prev => prev + 1)
      }
      
      // Save vote to localStorage
      const votedReviews = JSON.parse(localStorage.getItem('votedReviews') || '{}')
      votedReviews[review.id] = voteType
      localStorage.setItem('votedReviews', JSON.stringify(votedReviews))
      
      setVoted(voteType)
    } catch (error) {
      console.error('Failed to vote:', error)
    } finally {
      setVoting(false)
    }
  }

  const shouldTruncate = review.comment.length > commentPreviewLength
  const displayComment = isExpanded || !shouldTruncate
    ? review.comment
    : review.comment.substring(0, commentPreviewLength) + '...'

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Parse images safely
  let reviewImages: string[] = []
  try {
    if (review.images) {
      reviewImages = JSON.parse(review.images)
    }
  } catch {
    // Invalid JSON, skip images
  }

  return (
    <motion.div
      layout
      className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-all"
    >
      {/* Compact Header - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        {/* Avatar */}
        <div className="w-9 h-9 bg-gradient-to-br from-violet-100 to-purple-100 rounded-full flex items-center justify-center shrink-0">
          <User size={16} weight="bold" className="text-violet-600" />
        </div>

        {/* Name & Rating Row */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-gray-900 truncate">{review.customerName}</span>
            {review.isVerified && (
              <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
            )}
            <span className="text-xs text-gray-400">{formatDate(review.createdAt)}</span>
          </div>
          
          {/* Stars + Preview */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={12}
                  weight={star <= review.rating ? 'fill' : 'regular'}
                  className={star <= review.rating ? 'text-amber-400' : 'text-gray-200'}
                />
              ))}
            </div>
            {!isExpanded && (
              <span className="text-xs text-gray-500 truncate">
                {review.title || review.comment.substring(0, 50)}...
              </span>
            )}
          </div>
        </div>

        {/* Expand Arrow + Helpful */}
        <div className="flex items-center gap-3 shrink-0">
          {helpfulCount > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <ThumbsUp size={12} />
              {helpfulCount}
            </span>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <CaretDown size={16} className="text-gray-400" />
          </motion.div>
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 ml-12">
              {/* Review Title */}
              {review.title && (
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">{review.title}</h4>
              )}

              {/* Review Comment */}
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mb-3">
                {displayComment}
              </p>
              
              {shouldTruncate && !isExpanded && (
                <button className="text-xs text-violet-600 font-medium hover:underline mb-3">
                  Read more
                </button>
              )}

              {/* Review Images */}
              {reviewImages.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {reviewImages.map((imageUrl: string, index: number) => (
                    <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-100">
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

              {/* Was this helpful? Voting */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Was this helpful?</span>
                <button
                  onClick={(e) => handleVote('helpful', e)}
                  disabled={voted !== null || voting}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                    voted === 'helpful'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                      : voted !== null
                      ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'text-gray-500 border-gray-200 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <ThumbsUp size={14} weight={voted === 'helpful' ? 'fill' : 'regular'} />
                  <span>Yes ({helpfulCount})</span>
                </button>
                <button
                  onClick={(e) => handleVote('not_helpful', e)}
                  disabled={voted !== null || voting}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                    voted === 'not_helpful'
                      ? 'bg-rose-50 border-rose-200 text-rose-600'
                      : voted !== null
                      ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'text-gray-500 border-gray-200 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  <ThumbsDown size={14} weight={voted === 'not_helpful' ? 'fill' : 'regular'} />
                  <span>No ({notHelpfulCount})</span>
                </button>
              </div>

              {/* Admin Reply */}
              {review.adminReply && (
                <div className="mt-3 p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border-l-3 border-violet-400">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
                      <ChatCircle size={12} weight="fill" className="text-white" />
                    </div>
                    <span className="text-xs font-semibold text-violet-700">Head Over Feels</span>
                    {review.adminReplyAt && (
                      <span className="text-[10px] text-gray-400">· {formatDate(review.adminReplyAt)}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed ml-8">{review.adminReply}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  const toggleReview = (reviewId: string) => {
    setExpandedReviews(prev => {
      const newSet = new Set(prev)
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId)
      } else {
        newSet.add(reviewId)
      }
      return newSet
    })
  }

  const handleVote = async (reviewId: string, voteType: 'helpful' | 'not_helpful') => {
    const response = await fetch(`/api/reviews/${reviewId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteType }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to vote')
    }
    
    return response.json()
  }

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
    return null
  }

  return (
    <div className="space-y-4">
      {/* Compact Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            {reviews.length} Reviews
          </h3>
          {verifiedOnly && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              Verified only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Funnel size={16} weight={showFilters ? 'fill' : 'regular'} />
          </button>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="appearance-none px-3 py-1.5 pr-8 text-xs bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-violet-200 cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest</option>
              <option value="lowest">Lowest</option>
              <option value="helpful">Helpful</option>
            </select>
            <CaretDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Expandable Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-4 py-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={handleVerifiedToggle}
                  className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-xs text-gray-600">Verified purchases only</span>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews List - Compact Cards */}
      <div className="space-y-2">
        {reviews.map((review) => (
          <ReviewCard 
            key={review.id} 
            review={review}
            isExpanded={expandedReviews.has(review.id)}
            onToggle={() => toggleReview(review.id)}
            onVote={handleVote}
          />
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="text-sm text-violet-600 font-medium hover:text-violet-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : `Load More Reviews`}
          </button>
        </div>
      )}
    </div>
  )
}
