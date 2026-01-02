'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Star, Check, X, Eye, Flag, Trash, ChatText, PaperPlaneTilt, PencilSimple, X as XIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { AdminLayout } from '@/components/admin/AdminLayout'

interface Review {
  id: string
  rating: number
  title?: string | null
  comment: string
  customerName: string
  customerEmail: string
  isVerified: boolean
  status: string
  createdAt: string
  adminReply?: string | null
  adminReplyAt?: string | null
  product: {
    id: string
    name: string
    slug: string
    images: string
  }
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<string>('')
  const [submittingReply, setSubmittingReply] = useState(false)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(statusFilter !== 'all' && { status: statusFilter })
      })

      const response = await fetch(`/api/reviews?${params}`)
      const data = await response.json()

      if (response.ok) {
        setReviews(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotalCount(data.pagination.totalCount)
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const handleStatusChange = async (reviewId: string, newStatus: string, rejectionReason?: string) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          ...(rejectionReason && { rejectionReason }),
          moderatedBy: 'admin' // In production, use actual admin ID
        })
      })

      if (response.ok) {
        fetchReviews() // Refresh list
      } else {
        console.error('Failed to update review status')
      }
    } catch (error) {
      console.error('Error updating review:', error)
    }
  }

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchReviews() // Refresh list
      } else {
        console.error('Failed to delete review')
      }
    } catch (error) {
      console.error('Error deleting review:', error)
    }
  }

  const handleSubmitReply = async (reviewId: string) => {
    if (!replyText.trim()) {
      alert('Please enter a reply message')
      return
    }

    setSubmittingReply(true)
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminReply: replyText,
          adminReplyBy: 'admin' // In production, use actual admin ID
        })
      })

      if (response.ok) {
        setReplyingTo(null)
        setReplyText('')
        fetchReviews() // Refresh list
      } else {
        console.error('Failed to submit reply')
        alert('Failed to submit reply. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting reply:', error)
      alert('Failed to submit reply. Please try again.')
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleDeleteReply = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this reply?')) {
      return
    }

    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminReply: '',
          adminReplyBy: 'admin'
        })
      })

      if (response.ok) {
        fetchReviews() // Refresh list
      } else {
        console.error('Failed to delete reply')
      }
    } catch (error) {
      console.error('Error deleting reply:', error)
    }
  }

  const handleStartReply = (reviewId: string, existingReply?: string | null) => {
    setReplyingTo(reviewId)
    setReplyText(existingReply || '')
  }

  const handleCancelReply = () => {
    setReplyingTo(null)
    setReplyText('')
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-500/20 text-emerald-400'
      case 'REJECTED':
        return 'bg-red-500/20 text-red-400'
      case 'FLAGGED':
        return 'bg-amber-500/20 text-amber-400'
      default:
        return 'bg-white/10 text-white/70'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getProductImage = (product: Review['product']) => {
    try {
      const images = typeof product.images === 'string' 
        ? JSON.parse(product.images) 
        : product.images
      
      if (Array.isArray(images) && images.length > 0) {
        // Handle both formats: string[] or {url: string}[]
        return typeof images[0] === 'string' 
          ? images[0] 
          : images[0]?.url || '/placeholder-product.jpg'
      }
      return '/placeholder-product.jpg'
    } catch {
      return '/placeholder-product.jpg'
    }
  }

  return (
    <AdminLayout
      title="Review Moderation"
      subtitle="Moderate customer reviews and manage product feedback"
    >
      {/* Filters */}
      <div className="bg-neutral-900 border border-white/10 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label htmlFor="status" className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-1">
                Status
              </label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="px-4 py-2 bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-white/20 focus:border-white/30"
              >
                <option value="all" className="bg-neutral-900">All Reviews</option>
                <option value="PENDING" className="bg-neutral-900">Pending</option>
                <option value="APPROVED" className="bg-neutral-900">Approved</option>
                <option value="REJECTED" className="bg-neutral-900">Rejected</option>
                <option value="FLAGGED" className="bg-neutral-900">Flagged</option>
              </select>
            </div>

            <div className="flex-1 flex items-end justify-end">
              <p className="text-sm text-white/40">
                Showing {reviews.length} of {totalCount} reviews
              </p>
            </div>
          </div>
        </div>

      {/* Reviews List */}
      <div className="mt-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin h-8 w-8 border-b-2 border-white" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-neutral-900 border border-white/10 p-12 text-center">
            <p className="text-white/40">No reviews found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-neutral-900 border border-white/10 p-6">
                <div className="flex gap-6">
                  {/* Product Image */}
                  <div className="shrink-0 relative w-24 h-24 overflow-hidden border border-white/10">
                    <Image
                      src={getProductImage(review.product)}
                      alt={review.product.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Review Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold ${getStatusBadgeColor(review.status)}`}>
                            {review.status}
                          </span>
                          {review.isVerified && (
                            <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-500/20 text-blue-400">
                              Verified Purchase
                            </span>
                          )}
                        </div>
                        <Link 
                          href={`/products/${review.product.slug}`}
                          className="text-sm font-medium text-white hover:text-white/80"
                        >
                          {review.product.name}
                        </Link>
                      </div>
                      <span className="text-sm text-white/40">{formatDate(review.createdAt)}</span>
                    </div>

                    {/* Rating and Title */}
                    <div className="mb-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-white/20'
                            }`}
                          />
                        ))}
                      </div>
                      {review.title && (
                        <h4 className="font-semibold text-white">{review.title}</h4>
                      )}
                    </div>

                    {/* Comment */}
                    <p className="text-white/70 mb-3">{review.comment}</p>

                    {/* Customer Info */}
                    <div className="text-sm text-white/40 mb-4">
                      <span className="font-medium text-white/70">{review.customerName}</span>
                      <span className="mx-2">•</span>
                      <span>{review.customerEmail}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {review.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusChange(review.id, 'APPROVED')}
                            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-0"
                          >
                            <Check size={16} weight="bold" className="mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const reason = prompt('Rejection reason (optional):')
                              handleStatusChange(review.id, 'REJECTED', reason || undefined)
                            }}
                            className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                          >
                            <X size={16} weight="bold" className="mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      
                      {review.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(review.id, 'PENDING')}
                          className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        >
                          <Eye size={16} weight="bold" className="mr-1" />
                          Unapprove
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(review.id, 'FLAGGED')}
                        className="bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                      >
                        <Flag size={16} weight="bold" className="mr-1" />
                        Flag
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(review.id)}
                        className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash size={16} weight="bold" className="mr-1" />
                        Delete
                      </Button>
                    </div>

                    {/* Admin Reply Section */}
                    {review.status === 'APPROVED' && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        {/* Existing Reply Display */}
                        {review.adminReply && replyingTo !== review.id && (
                          <div className="mb-4 bg-purple-500/10 border-l-4 border-purple-500 p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-purple-500 flex items-center justify-center shrink-0">
                                  <span className="text-white text-xs font-bold">HF</span>
                                </div>
                                <div>
                                  <p className="font-semibold text-white text-sm">Head Over Feels Team</p>
                                  {review.adminReplyAt && (
                                    <p className="text-xs text-white/40">{formatDate(review.adminReplyAt)}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleStartReply(review.id, review.adminReply)}
                                  className="text-purple-400 hover:text-purple-300 p-1"
                                  title="Edit reply"
                                >
                                  <PencilSimple size={16} weight="bold" />
                                </button>
                                <button
                                  onClick={() => handleDeleteReply(review.id)}
                                  className="text-red-400 hover:text-red-300 p-1"
                                  title="Delete reply"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-white/70 text-sm whitespace-pre-wrap">{review.adminReply}</p>
                          </div>
                        )}

                        {/* Reply Form */}
                        {replyingTo === review.id ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                              <ChatText size={16} weight="bold" />
                              <span className="font-medium">
                                {review.adminReply ? 'Edit Reply' : 'Reply to Customer'}
                              </span>
                            </div>
                            <div>
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a helpful and professional response..."
                                rows={4}
                                maxLength={1000}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none"
                              />
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-white/40">
                                  {replyText.length}/1000 characters
                                </span>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelReply}
                                    disabled={submittingReply}
                                    className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSubmitReply(review.id)}
                                    disabled={submittingReply || !replyText.trim()}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                  >
                                    <PaperPlaneTilt size={16} weight="bold" className="mr-1" />
                                    {submittingReply ? 'Sending...' : review.adminReply ? 'Update Reply' : 'Send Reply'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : !review.adminReply && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartReply(review.id)}
                            className="bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                          >
                            <ChatText size={16} weight="bold" className="mr-1" />
                            Reply to Customer
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(page - 1)}
              disabled={page === 1 || loading}
              className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 disabled:opacity-50"
            >
              Previous
            </Button>
            <span className="text-sm text-white/40">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages || loading}
              className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 disabled:opacity-50"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
