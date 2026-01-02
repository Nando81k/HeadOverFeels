'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Star, Camera, X, CircleNotch, Image as ImageIcon, ShoppingBag, Warning, CheckCircle } from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'

interface ReviewFormProps {
  productId: string
  productName: string
  customerId?: string
  customerEmail?: string
  orderId?: string
  onSuccess?: () => void
}

interface CanReviewResponse {
  canReview: boolean
  reason?: string
  message?: string
  orderId?: string
  orderNumber?: string
  existingReviewId?: string
  reviewStatus?: string
}

export default function ReviewForm({ 
  productId, 
  productName, 
  customerId, 
  customerEmail: initialEmail,
  orderId,
  onSuccess 
}: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState(initialEmail || '')
  const [images, setImages] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Purchase verification state
  const [checkingEligibility, setCheckingEligibility] = useState(false)
  const [canReview, setCanReview] = useState<boolean | null>(null)
  const [eligibilityMessage, setEligibilityMessage] = useState('')
  const [verifiedOrderId, setVerifiedOrderId] = useState<string | null>(orderId || null)
  const [emailToCheck, setEmailToCheck] = useState('')

  // Check eligibility on mount if we have customerId or email
  useEffect(() => {
    if (customerId || initialEmail) {
      checkReviewEligibility(initialEmail || undefined)
    }
  }, [customerId, initialEmail, productId])

  const checkReviewEligibility = async (email?: string) => {
    setCheckingEligibility(true)
    setError('')
    
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

      const data: CanReviewResponse = await response.json()
      
      setCanReview(data.canReview)
      setEligibilityMessage(data.message || '')
      
      if (data.canReview && data.orderId) {
        setVerifiedOrderId(data.orderId)
        if (email) {
          setCustomerEmail(email)
        }
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
      setError('Please enter a valid email address')
      return
    }
    setCustomerEmail(emailToCheck)
    checkReviewEligibility(emailToCheck)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Max 5 images
    if (images.length + files.length > 5) {
      setError('Maximum 5 images allowed')
      return
    }

    setUploadingImages(true)
    setError('')

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError('Only image files are allowed')
          continue
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setError('Image must be less than 5MB')
          continue
        }

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          setImages(prev => [...prev, data.url])
        } else {
          setError('Failed to upload image')
        }
      }
    } catch (err) {
      setError('Failed to upload image')
      console.error('Upload error:', err)
    } finally {
      setUploadingImages(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (rating === 0) {
      setError('Please select a star rating')
      return
    }

    if (!comment.trim()) {
      setError('Please write a review')
      return
    }

    if (!customerName.trim()) {
      setError('Please enter your name')
      return
    }

    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          rating,
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

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit review')
      }

      // Success
      setSuccess(true)
      setRating(0)
      setTitle('')
      setComment('')
      setCustomerName('')
      setCustomerEmail('')
      setImages([])

      if (onSuccess) {
        onSuccess()
      }

      // Hide success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-violet-50/50 to-purple-50/50 rounded-2xl border border-violet-100/50 p-6">
      <h3 className="text-xl font-bold mb-4 text-gray-900">Write a Review</h3>

      {/* Purchase Verification - Check Email First */}
      {canReview === null && !checkingEligibility && !customerId && !initialEmail && (
        <div className="mb-6 p-5 bg-white rounded-xl border border-gray-200">
          <div className="flex items-start gap-3 mb-4">
            <ShoppingBag size={24} className="text-violet-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Verify Your Purchase</p>
              <p className="text-sm text-gray-600 mt-1">
                Only customers who have purchased this item can leave a review. Enter your email to verify.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={emailToCheck}
              onChange={(e) => setEmailToCheck(e.target.value)}
              placeholder="Enter the email used for your order"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-all text-sm"
            />
            <Button
              type="button"
              onClick={handleEmailCheck}
              className="bg-violet-500 hover:bg-violet-600 text-white rounded-xl px-4"
            >
              Verify
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
        </div>
      )}

      {/* Checking Eligibility */}
      {checkingEligibility && (
        <div className="mb-6 p-5 bg-white rounded-xl border border-gray-200 flex items-center gap-3">
          <CircleNotch size={24} className="text-violet-500 animate-spin" />
          <p className="text-gray-600">Verifying your purchase...</p>
        </div>
      )}

      {/* Not Eligible - No Purchase */}
      {canReview === false && (
        <div className="mb-6 p-5 bg-amber-50 rounded-xl border border-amber-200">
          <div className="flex items-start gap-3">
            <Warning size={24} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">{eligibilityMessage}</p>
              <p className="text-sm text-amber-700 mt-2">
                Reviews are limited to verified purchasers to ensure authentic feedback.
              </p>
              <Link 
                href="/products" 
                className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-violet-600 hover:text-violet-700"
              >
                <ShoppingBag size={16} />
                Browse our products
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Eligible - Show Form */}
      {canReview === true && (
        <>
          <div className="mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
            <CheckCircle size={20} className="text-emerald-600" weight="fill" />
            <p className="text-sm text-emerald-700">
              <span className="font-medium">Verified Purchase</span> — You&apos;re eligible to review this product
            </p>
          </div>

          {success && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
              ✨ Thank you for your review! It will be published after moderation.
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Star Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Rating *
              </label>
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
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </p>
          )}
        </div>

        {/* Review Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Review Title (Optional)
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summarize your experience"
            maxLength={100}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-all"
          />
        </div>

        {/* Review Comment */}
        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
            Your Review *
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={`Share your thoughts about ${productName}...`}
            rows={4}
            maxLength={1000}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-all resize-none"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {comment.length}/1000 characters
          </p>
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Photos (Optional)
          </label>
          
          <div className="flex flex-wrap gap-3">
            {/* Uploaded Images */}
            {images.map((url, index) => (
              <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-violet-200 group">
                <Image
                  src={url}
                  alt={`Review image ${index + 1}`}
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} weight="bold" className="text-white" />
                </button>
              </div>
            ))}

            {/* Upload Button */}
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

        {/* Customer Name - Email is already verified */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Your Name *
          </label>
          <input
            type="text"
            id="name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={100}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-all"
            required
          />
        </div>

        {/* Hidden email field - already verified */}
        <input type="hidden" value={customerEmail} />
        <p className="text-xs text-gray-500 -mt-3">
          Reviewing as: <span className="font-medium">{customerEmail}</span>
        </p>

        {/* Submit Button */}
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
    </div>
  )
}
