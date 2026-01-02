'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle, 
  ChatCircle, 
  Robot, 
  Sparkle,
  CaretDown,
  Camera,
  X,
  CircleNotch,
  Image as ImageIcon,
  ShoppingBag,
  Warning,
  PencilSimple,
  Target,
  User,
  Funnel
} from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Types
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

interface ReviewStats {
  averageRating: number
  totalReviews: number
  distribution: Record<number, number>
}

interface ReggieReviewSummary {
  headline: string
  summary: string
  pros: string[]
  cons: string[]
  bestFor: string
  reggieVerdict: string
}

interface UnifiedReviewSectionProps {
  productId: string
  productName: string
  customerId?: string
  customerEmail?: string
  onReviewSubmitted?: () => void
}

type TabType = 'overview' | 'reviews' | 'write'

export default function UnifiedReviewSection({ 
  productId, 
  productName,
  customerId,
  customerEmail: initialEmail,
  onReviewSubmitted
}: UnifiedReviewSectionProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  
  // Data states
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [aiSummary, setAiSummary] = useState<ReggieReviewSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingAI, setLoadingAI] = useState(true)
  
  // Review list states
  const [sortBy, setSortBy] = useState('newest')
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  
  // Review form states
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState(initialEmail || '')
  const [images, setImages] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Purchase verification
  const [checkingEligibility, setCheckingEligibility] = useState(false)
  const [canReview, setCanReview] = useState<boolean | null>(null)
  const [eligibilityMessage, setEligibilityMessage] = useState('')
  const [verifiedOrderId, setVerifiedOrderId] = useState<string | null>(null)
  const [emailToCheck, setEmailToCheck] = useState('')

  // Load reviews and stats
  useEffect(() => {
    loadReviewsData()
    loadAISummary()
  }, [productId])

  // Check eligibility if logged in
  useEffect(() => {
    if (customerId || initialEmail) {
      checkReviewEligibility(initialEmail || undefined)
    }
  }, [customerId, initialEmail, productId])

  const loadReviewsData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/products/${productId}/reviews?sortBy=${sortBy}&page=1&limit=10`)
      const data = await response.json()
      
      if (data.data) {
        setReviews(data.data)
        setStats({
          averageRating: data.stats?.averageRating || 0,
          totalReviews: data.stats?.totalReviews || 0,
          distribution: data.stats?.distribution || {}
        })
        setHasMore(data.pagination?.hasNextPage || false)
        setPage(1)
      }
    } catch (error) {
      console.error('Failed to load reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAISummary = async () => {
    setLoadingAI(true)
    try {
      const response = await fetch(`/api/reviews/ai-summary?productId=${productId}`)
      const data = await response.json()
      if (data.hasSummary) {
        setAiSummary(data.summary)
      }
    } catch (error) {
      console.error('Failed to load AI summary:', error)
    } finally {
      setLoadingAI(false)
    }
  }

  const loadMoreReviews = async () => {
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const response = await fetch(`/api/products/${productId}/reviews?sortBy=${sortBy}&page=${nextPage}&limit=10`)
      const data = await response.json()
      
      if (data.data) {
        setReviews(prev => [...prev, ...data.data])
        setHasMore(data.pagination?.hasNextPage || false)
        setPage(nextPage)
      }
    } catch (error) {
      console.error('Failed to load more reviews:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleSortChange = async (newSort: string) => {
    setSortBy(newSort)
    setLoading(true)
    try {
      const response = await fetch(`/api/products/${productId}/reviews?sortBy=${newSort}&page=1&limit=10`)
      const data = await response.json()
      if (data.data) {
        setReviews(data.data)
        setHasMore(data.pagination?.hasNextPage || false)
        setPage(1)
      }
    } catch (error) {
      console.error('Failed to sort reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (reviewId: string, voteType: 'helpful' | 'not_helpful') => {
    await fetch(`/api/reviews/${reviewId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteType }),
    })
  }

  const checkReviewEligibility = async (email?: string) => {
    setCheckingEligibility(true)
    setFormError('')
    
    try {
      const response = await fetch('/api/reviews/can-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerId: customerId || undefined,
          customerEmail: email || customerEmail || undefined,
        }),
      })

      const data = await response.json()
      setCanReview(data.canReview)
      setEligibilityMessage(data.message || '')
      
      if (data.canReview && data.orderId) {
        setVerifiedOrderId(data.orderId)
        if (email) setCustomerEmail(email)
      }
    } catch (err) {
      console.error('Failed to check eligibility:', err)
      setEligibilityMessage('Unable to verify purchase status')
    } finally {
      setCheckingEligibility(false)
    }
  }

  const handleEmailCheck = () => {
    if (!emailToCheck.includes('@')) {
      setFormError('Please enter a valid email address')
      return
    }
    setCustomerEmail(emailToCheck)
    checkReviewEligibility(emailToCheck)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (images.length + files.length > 5) {
      setFormError('Maximum 5 images allowed')
      return
    }

    setUploadingImages(true)
    setFormError('')

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        if (file.size > 5 * 1024 * 1024) {
          setFormError('Image must be less than 5MB')
          continue
        }

        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/upload', { method: 'POST', body: formData })
        if (response.ok) {
          const data = await response.json()
          setImages(prev => [...prev, data.url])
        }
      }
    } catch (err) {
      setFormError('Failed to upload image')
    } finally {
      setUploadingImages(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (rating === 0) { setFormError('Please select a star rating'); return }
    if (!comment.trim()) { setFormError('Please write a review'); return }
    if (!customerName.trim()) { setFormError('Please enter your name'); return }
    if (!customerEmail.trim() || !customerEmail.includes('@')) { 
      setFormError('Please enter a valid email address'); return 
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId, rating,
          title: title.trim() || null,
          comment: comment.trim(),
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerId: customerId || null,
          orderId: verifiedOrderId || null,
          images: images.length > 0 ? images : null
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to submit review')

      setFormSuccess(true)
      setRating(0)
      setTitle('')
      setComment('')
      setCustomerName('')
      setImages([])
      onReviewSubmitted?.()
      
      setTimeout(() => {
        setFormSuccess(false)
        setActiveTab('reviews')
        loadReviewsData()
      }, 3000)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleReview = (id: string) => {
    setExpandedReviews(prev => {
      const newSet = new Set(prev)
      newSet.has(id) ? newSet.delete(id) : newSet.add(id)
      return newSet
    })
  }

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

  const renderStars = (rating: number, size: number = 16) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star 
          key={i}
          size={size} 
          weight={i <= Math.floor(rating) ? 'fill' : 'regular'}
          className={i <= Math.floor(rating) ? 'text-amber-400' : 'text-gray-300'}
        />
      ))}
    </div>
  )

  // Loading state
  if (loading && !stats) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-center gap-3">
          <CircleNotch size={24} className="text-violet-500 animate-spin" />
          <span className="text-gray-600">Loading reviews...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header with Rating Overview */}
      <div className="bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 p-6 border-b border-violet-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Large Rating Display */}
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900">
                {stats?.averageRating.toFixed(1) || '0.0'}
              </div>
              <div className="flex justify-center mt-1">
                {renderStars(stats?.averageRating || 0, 14)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.totalReviews || 0} reviews
              </p>
            </div>

            {/* Rating Distribution Mini */}
            <div className="hidden sm:flex items-end gap-1 h-12 px-4 border-l border-violet-200">
              {[5, 4, 3, 2, 1].map(rating => {
                const count = stats?.distribution[rating] || 0
                const percentage = stats?.totalReviews ? (count / stats.totalReviews) * 100 : 0
                return (
                  <div key={rating} className="flex flex-col items-center gap-1">
                    <div 
                      className="w-3 bg-gradient-to-t from-amber-400 to-amber-300 rounded-t transition-all"
                      style={{ height: `${Math.max(percentage * 0.4, 4)}px` }}
                    />
                    <span className="text-[10px] text-gray-400">{rating}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Write Review Button */}
          <Button
            onClick={() => setActiveTab('write')}
            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl"
          >
            <PencilSimple size={18} className="mr-2" />
            Write a Review
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'overview' as TabType, label: 'Overview', icon: Sparkle },
          { id: 'reviews' as TabType, label: `Reviews (${stats?.totalReviews || 0})`, icon: ChatCircle },
          { id: 'write' as TabType, label: 'Write Review', icon: PencilSimple },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 sm:flex-none px-6 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-violet-500 text-violet-600 bg-violet-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon size={16} weight={activeTab === tab.id ? 'fill' : 'regular'} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* Overview Tab - Reggie's AI Summary */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {loadingAI ? (
                <div className="flex items-center gap-3 p-4">
                  <CircleNotch size={20} className="text-violet-500 animate-spin" />
                  <span className="text-gray-600">Reggie is analyzing reviews...</span>
                </div>
              ) : aiSummary ? (
                <>
                  {/* Reggie Header */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-200">
                      <Robot size={24} className="text-white" weight="fill" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">Reggie&apos;s Take</span>
                        <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-medium rounded-full">AI Summary</span>
                      </div>
                      <p className="text-lg font-semibold text-violet-700 mt-1">{aiSummary.headline}</p>
                    </div>
                  </div>

                  <p className="text-gray-700">{aiSummary.summary}</p>

                  {/* Pros and Cons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {aiSummary.pros.length > 0 && (
                      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-3">
                          <ThumbsUp size={16} weight="fill" className="text-emerald-600" />
                          <span className="font-semibold text-emerald-800 text-sm">What Customers Love</span>
                        </div>
                        <ul className="space-y-1.5">
                          {aiSummary.pros.map((pro, i) => (
                            <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                              <span className="text-emerald-500">•</span> {pro}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiSummary.cons.length > 0 && (
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                        <div className="flex items-center gap-2 mb-3">
                          <ThumbsDown size={16} weight="fill" className="text-amber-600" />
                          <span className="font-semibold text-amber-800 text-sm">Worth Noting</span>
                        </div>
                        <ul className="space-y-1.5">
                          {aiSummary.cons.map((con, i) => (
                            <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                              <span className="text-amber-500">•</span> {con}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Best For & Verdict */}
                  {aiSummary.bestFor && (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex items-start gap-3">
                      <Target size={18} weight="fill" className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-blue-800 text-sm">Perfect For</span>
                        <p className="text-sm text-blue-700 mt-0.5">{aiSummary.bestFor}</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-gradient-to-r from-violet-100 to-purple-100 rounded-xl p-4 border border-violet-200">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Robot size={14} className="text-white" weight="fill" />
                      </div>
                      <div>
                        <span className="font-semibold text-violet-800 text-sm">Reggie&apos;s Verdict</span>
                        <p className="text-violet-700 mt-0.5 italic">&ldquo;{aiSummary.reggieVerdict}&rdquo;</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Robot size={48} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Not enough reviews yet for an AI summary.</p>
                  <p className="text-sm text-gray-400 mt-1">Be one of the first to share your experience!</p>
                  <Button 
                    onClick={() => setActiveTab('write')}
                    variant="outline"
                    className="mt-4"
                  >
                    Write a Review
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <motion.div
              key="reviews"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Sort Controls */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  Showing {reviews.length} of {stats?.totalReviews || 0} reviews
                </p>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-200"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="highest">Highest Rated</option>
                  <option value="lowest">Lowest Rated</option>
                  <option value="helpful">Most Helpful</option>
                </select>
              </div>

              {/* Reviews List */}
              {reviews.length === 0 ? (
                <div className="text-center py-12">
                  <ChatCircle size={48} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No reviews yet.</p>
                  <Button 
                    onClick={() => setActiveTab('write')}
                    variant="outline"
                    className="mt-4"
                  >
                    Be the first to review
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      isExpanded={expandedReviews.has(review.id)}
                      onToggle={() => toggleReview(review.id)}
                      onVote={handleVote}
                      formatDate={formatDate}
                    />
                  ))}

                  {hasMore && (
                    <div className="text-center pt-4">
                      <Button
                        onClick={loadMoreReviews}
                        variant="outline"
                        disabled={loadingMore}
                        className="text-violet-600 border-violet-200 hover:bg-violet-50"
                      >
                        {loadingMore ? 'Loading...' : 'Load More Reviews'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Write Review Tab */}
          {activeTab === 'write' && (
            <motion.div
              key="write"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Purchase Verification */}
              {canReview === null && !checkingEligibility && !customerId && !initialEmail && (
                <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-start gap-3 mb-4">
                    <ShoppingBag size={24} className="text-violet-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Verify Your Purchase</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Only customers who have purchased this item can leave a review.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={emailToCheck}
                      onChange={(e) => setEmailToCheck(e.target.value)}
                      placeholder="Enter the email used for your order"
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-200 text-sm"
                    />
                    <Button onClick={handleEmailCheck} className="bg-violet-500 hover:bg-violet-600 text-white rounded-xl">
                      Verify
                    </Button>
                  </div>
                  {formError && <p className="text-sm text-red-600 mt-2">{formError}</p>}
                </div>
              )}

              {checkingEligibility && (
                <div className="mb-6 p-5 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
                  <CircleNotch size={24} className="text-violet-500 animate-spin" />
                  <p className="text-gray-600">Verifying your purchase...</p>
                </div>
              )}

              {canReview === false && (
                <div className="mb-6 p-5 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-start gap-3">
                    <Warning size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">{eligibilityMessage}</p>
                      <p className="text-sm text-amber-700 mt-1">
                        Reviews are limited to verified purchasers.
                      </p>
                      <Link href="/products" className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-violet-600 hover:text-violet-700">
                        <ShoppingBag size={16} /> Browse our products
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {canReview === true && (
                <>
                  <div className="mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
                    <CheckCircle size={20} className="text-emerald-600" weight="fill" />
                    <p className="text-sm text-emerald-700">
                      <span className="font-medium">Verified Purchase</span> — You&apos;re eligible to review this product
                    </p>
                  </div>

                  {formSuccess && (
                    <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                      ✨ Thank you for your review! It will be published after moderation.
                    </div>
                  )}

                  {formError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                      {formError}
                    </div>
                  )}

                  <form onSubmit={handleSubmitReview} className="space-y-5">
                    {/* Star Rating */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating *</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="p-1 transition-transform hover:scale-110"
                          >
                            <Star
                              size={32}
                              weight={star <= (hoverRating || rating) ? 'fill' : 'regular'}
                              className={star <= (hoverRating || rating) ? 'text-amber-400' : 'text-gray-300'}
                            />
                          </button>
                        ))}
                      </div>
                      {rating > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
                        </p>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Review Title (Optional)</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Summarize your experience"
                        maxLength={100}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-200"
                      />
                    </div>

                    {/* Comment */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Your Review *</label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={`Share your thoughts about ${productName}...`}
                        rows={4}
                        maxLength={1000}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-200 resize-none"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">{comment.length}/1000</p>
                    </div>

                    {/* Image Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Add Photos (Optional)</label>
                      <div className="flex flex-wrap gap-3">
                        {images.map((url, index) => (
                          <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-violet-200 group">
                            <Image src={url} alt={`Review image ${index + 1}`} fill className="object-cover" />
                            <button
                              type="button"
                              onClick={() => setImages(prev => prev.filter((_, i) => i !== index))}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={12} weight="bold" className="text-white" />
                            </button>
                          </div>
                        ))}

                        {images.length < 5 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImages}
                            className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50/50 flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50"
                          >
                            {uploadingImages ? (
                              <CircleNotch size={20} className="text-violet-500 animate-spin" />
                            ) : (
                              <>
                                <Camera size={20} className="text-gray-400" />
                                <span className="text-[10px] text-gray-400">Add</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        <ImageIcon size={12} className="inline mr-1" />
                        Up to 5 images, max 5MB each
                      </p>
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Your Name *</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter your name"
                        maxLength={100}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-200"
                        required
                      />
                    </div>

                    <p className="text-xs text-gray-500 -mt-3">
                      Reviewing as: <span className="font-medium">{customerEmail}</span>
                    </p>

                    <Button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl py-3"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Review'}
                    </Button>
                  </form>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Review Card Sub-component
function ReviewCard({ 
  review, 
  isExpanded, 
  onToggle, 
  onVote,
  formatDate 
}: {
  review: Review
  isExpanded: boolean
  onToggle: () => void
  onVote: (id: string, type: 'helpful' | 'not_helpful') => Promise<void>
  formatDate: (date: string) => string
}) {
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount)
  const [notHelpfulCount, setNotHelpfulCount] = useState(review.notHelpfulCount)
  const [voted, setVoted] = useState<'helpful' | 'not_helpful' | null>(null)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    const votedReviews = JSON.parse(localStorage.getItem('votedReviews') || '{}')
    if (votedReviews[review.id]) setVoted(votedReviews[review.id])
  }, [review.id])

  const handleVote = async (voteType: 'helpful' | 'not_helpful', e: React.MouseEvent) => {
    e.stopPropagation()
    if (voted || voting) return
    
    setVoting(true)
    try {
      await onVote(review.id, voteType)
      if (voteType === 'helpful') setHelpfulCount(prev => prev + 1)
      else setNotHelpfulCount(prev => prev + 1)
      
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

  const shouldTruncate = review.comment.length > 150
  const displayComment = isExpanded || !shouldTruncate 
    ? review.comment 
    : review.comment.substring(0, 150) + '...'

  let reviewImages: string[] = []
  try {
    if (review.images) reviewImages = JSON.parse(review.images)
  } catch { /* ignore */ }

  return (
    <div 
      className={`p-4 rounded-xl border transition-all cursor-pointer ${
        isExpanded ? 'bg-gray-50 border-violet-200' : 'bg-white border-gray-100 hover:border-gray-200'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center flex-shrink-0">
          <User size={18} className="text-violet-500" weight="fill" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900">{review.customerName}</span>
              {review.isVerified && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  <CheckCircle size={10} weight="fill" /> Verified
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">{formatDate(review.createdAt)}</span>
          </div>

          {/* Rating */}
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} size={14} weight={i <= review.rating ? 'fill' : 'regular'} className={i <= review.rating ? 'text-amber-400' : 'text-gray-300'} />
            ))}
          </div>

          {/* Title */}
          {review.title && (
            <p className="font-medium text-gray-900 mt-2">{review.title}</p>
          )}

          {/* Comment */}
          <p className="text-sm text-gray-600 mt-1">{displayComment}</p>
          {shouldTruncate && (
            <button className="text-xs text-violet-600 mt-1 hover:underline">
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          )}

          {/* Images */}
          {isExpanded && reviewImages.length > 0 && (
            <div className="flex gap-2 mt-3">
              {reviewImages.map((url, i) => (
                <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                  <Image src={url} alt="" width={64} height={64} className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
          )}

          {/* Admin Reply */}
          {isExpanded && review.adminReply && (
            <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
              <p className="text-xs font-medium text-violet-700 mb-1">Response from Head Over Feels</p>
              <p className="text-sm text-gray-700">{review.adminReply}</p>
            </div>
          )}

          {/* Voting */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Helpful?</span>
            <button
              onClick={(e) => handleVote('helpful', e)}
              disabled={voted !== null || voting}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all ${
                voted === 'helpful' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'hover:bg-gray-100 text-gray-500 disabled:opacity-50'
              }`}
            >
              <ThumbsUp size={12} weight={voted === 'helpful' ? 'fill' : 'regular'} />
              <span>{helpfulCount}</span>
            </button>
            <button
              onClick={(e) => handleVote('not_helpful', e)}
              disabled={voted !== null || voting}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all ${
                voted === 'not_helpful' 
                  ? 'bg-red-100 text-red-700' 
                  : 'hover:bg-gray-100 text-gray-500 disabled:opacity-50'
              }`}
            >
              <ThumbsDown size={12} weight={voted === 'not_helpful' ? 'fill' : 'regular'} />
              <span>{notHelpfulCount}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
