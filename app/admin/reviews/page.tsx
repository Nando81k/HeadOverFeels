'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Star, Check, X, Eye, Flag, Trash2, MessageSquare, Send, Edit, X as XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'FLAGGED':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Review Moderation</h1>
              <p className="mt-1 text-sm text-gray-500">
                Moderate customer reviews and manage product feedback
              </p>
            </div>
            <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="all">All Reviews</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="FLAGGED">Flagged</option>
              </select>
            </div>

            <div className="flex-1 flex items-end justify-end">
              <p className="text-sm text-gray-600">
                Showing {reviews.length} of {totalCount} reviews
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No reviews found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex gap-6">
                  {/* Product Image */}
                  <div className="shrink-0 relative w-24 h-24 rounded-lg overflow-hidden">
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
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeColor(review.status)}`}>
                            {review.status}
                          </span>
                          {review.isVerified && (
                            <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                              Verified Purchase
                            </span>
                          )}
                        </div>
                        <Link 
                          href={`/products/${review.product.slug}`}
                          className="text-sm font-medium text-gray-900 hover:text-black"
                        >
                          {review.product.name}
                        </Link>
                      </div>
                      <span className="text-sm text-gray-500">{formatDate(review.createdAt)}</span>
                    </div>

                    {/* Rating and Title */}
                    <div className="mb-2">
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
                      {review.title && (
                        <h4 className="font-semibold text-gray-900">{review.title}</h4>
                      )}
                    </div>

                    {/* Comment */}
                    <p className="text-gray-700 mb-3">{review.comment}</p>

                    {/* Customer Info */}
                    <div className="text-sm text-gray-600 mb-4">
                      <span className="font-medium">{review.customerName}</span>
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
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const reason = prompt('Rejection reason (optional):')
                              handleStatusChange(review.id, 'REJECTED', reason || undefined)
                            }}
                            className="border-red-600 text-red-600 hover:bg-red-50"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      
                      {review.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(review.id, 'PENDING')}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Unapprove
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(review.id, 'FLAGGED')}
                        className="border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                      >
                        <Flag className="w-4 h-4 mr-1" />
                        Flag
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(review.id)}
                        className="border-red-600 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>

                    {/* Admin Reply Section */}
                    {review.status === 'APPROVED' && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {/* Existing Reply Display */}
                        {review.adminReply && replyingTo !== review.id && (
                          <div className="mb-4 bg-purple-50 border-l-4 border-purple-600 p-4 rounded-r-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center shrink-0">
                                  <span className="text-white text-xs font-bold">HF</span>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 text-sm">Head Over Feels Team</p>
                                  {review.adminReplyAt && (
                                    <p className="text-xs text-gray-500">{formatDate(review.adminReplyAt)}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleStartReply(review.id, review.adminReply)}
                                  className="text-purple-600 hover:text-purple-700 p-1"
                                  title="Edit reply"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteReply(review.id)}
                                  className="text-red-600 hover:text-red-700 p-1"
                                  title="Delete reply"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-gray-700 text-sm whitespace-pre-wrap">{review.adminReply}</p>
                          </div>
                        )}

                        {/* Reply Form */}
                        {replyingTo === review.id ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <MessageSquare className="w-4 h-4" />
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                              />
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500">
                                  {replyText.length}/1000 characters
                                </span>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelReply}
                                    disabled={submittingReply}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSubmitReply(review.id)}
                                    disabled={submittingReply || !replyText.trim()}
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                  >
                                    <Send className="w-4 h-4 mr-1" />
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
                            className="border-purple-600 text-purple-600 hover:bg-purple-50"
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
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
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages || loading}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
