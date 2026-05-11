'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Star, Camera, X, CircleNotch, ShoppingBag, Warning, CheckCircle } from '@phosphor-icons/react'
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
  const [isDragOver, setIsDragOver] = useState(false)
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

  // Shared upload pipeline used by both the file-picker `<input>` and the
  // drag-and-drop dropzone. Validates each file (type + 5MB cap), uploads to
  // /api/upload (Cloudinary), and appends the returned URL to `images`.
  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    if (images.length + files.length > 5) {
      setError('Maximum 5 images allowed')
      return
    }

    setUploadingImages(true)
    setError('')

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          setError('Only image files are allowed')
          continue
        }
        if (file.size > 5 * 1024 * 1024) {
          setError('Each image must be under 5MB')
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
          setImages((prev) => [...prev, data.url])
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await processFiles(e.target.files)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!isDragOver) setIsDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) await processFiles(e.dataTransfer.files)
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

  // ===== Shared input class so every form field reads as one family =====
  const inputClass =
    'w-full px-4 py-3 bg-white border border-black/15 text-[14px] text-black placeholder:text-black/35 focus:outline-none focus:border-black transition-colors'

  return (
    <div className="bg-white border border-black/10 p-5 sm:p-6">
      <h3 className="text-xl font-black text-black tracking-tight mb-5">Write a review</h3>

      {/* Purchase Verification — email check */}
      {canReview === null && !checkingEligibility && !customerId && !initialEmail && (
        <div className="mb-6 p-4 sm:p-5 bg-neutral-50 border border-black/10">
          <div className="flex items-start gap-3 mb-4">
            <ShoppingBag size={22} className="text-black flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-black">Verify your purchase</p>
              <p className="text-sm text-black/65 mt-1">
                Only customers who have purchased this item can leave a review. Enter the email used for your order.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={emailToCheck}
              onChange={(e) => setEmailToCheck(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
            <Button
              type="button"
              onClick={handleEmailCheck}
              className="bg-black hover:bg-black/85 text-white px-5 h-12 sm:h-auto rounded-none font-bold uppercase tracking-[0.12em] text-xs"
            >
              Verify
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
      )}

      {/* Verifying spinner */}
      {checkingEligibility && (
        <div className="mb-6 p-5 bg-neutral-50 border border-black/10 flex items-center gap-3">
          <CircleNotch size={22} className="text-black animate-spin" />
          <p className="text-black/70 text-sm">Verifying your purchase…</p>
        </div>
      )}

      {/* Not eligible */}
      {canReview === false && (
        <div className="mb-6 p-5 bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <Warning size={22} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">{eligibilityMessage}</p>
              <p className="text-sm text-amber-800 mt-2">
                Reviews are limited to verified purchasers to keep feedback authentic.
              </p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 mt-3 text-sm font-bold text-black hover:underline"
              >
                <ShoppingBag size={16} />
                Browse products
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Eligible — show the form */}
      {canReview === true && (
        <>
          <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-700" weight="fill" />
            <p className="text-sm text-emerald-800">
              <span className="font-bold">Verified buyer</span> — your review will be marked verified.
            </p>
          </div>

          {success && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
              <span className="font-bold">Thanks for your review.</span> It will appear after moderation.
            </div>
          )}

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Star Rating */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-black/60 mb-2">
                Your rating <span className="text-[#FF3131]">*</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-0.5 transition-transform hover:scale-110"
                      aria-label={`${star} star${star === 1 ? '' : 's'}`}
                    >
                      <Star
                        size={28}
                        weight={star <= (hoverRating || rating) ? 'fill' : 'regular'}
                        className={star <= (hoverRating || rating) ? 'text-amber-500' : 'text-black/15'}
                      />
                    </button>
                  ))}
                </div>
                {(hoverRating || rating) > 0 && (
                  <span className="text-sm font-semibold text-black">
                    {{
                      1: 'Poor',
                      2: 'Fair',
                      3: 'Good',
                      4: 'Very good',
                      5: 'Excellent',
                    }[hoverRating || rating]}
                  </span>
                )}
              </div>
            </div>

            {/* Review Title */}
            <div>
              <label htmlFor="title" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-black/60 mb-2">
                Headline <span className="text-black/35 normal-case font-normal tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sum it up in one line"
                maxLength={100}
                className={inputClass}
              />
            </div>

            {/* Review Comment */}
            <div>
              <label htmlFor="comment" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-black/60 mb-2">
                Your review <span className="text-[#FF3131]">*</span>
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={`Share your thoughts on the ${productName}…`}
                rows={4}
                maxLength={1000}
                className={`${inputClass} resize-none`}
                required
              />
              <p className="text-[11px] text-black/45 mt-1 text-right tabular-nums">
                {comment.length}/1000
              </p>
            </div>

            {/* Image Upload — drag & drop dropzone + preview grid */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-black/60 mb-2">
                Add photos <span className="text-black/35 normal-case font-normal tracking-normal">(optional)</span>
              </label>

              {images.length > 0 && (
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 mb-3">
                  {images.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="group relative aspect-square overflow-hidden border border-black/10"
                    >
                      <Image
                        src={url}
                        alt={`Photo ${index + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="absolute inset-0 bg-black/55 text-white inline-flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        <X size={18} weight="bold" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < 5 && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-[#FF3131] bg-[#FF3131]/5'
                      : 'border-black/20 hover:border-black/40 bg-neutral-50'
                  } ${uploadingImages ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  {uploadingImages ? (
                    <>
                      <CircleNotch size={24} className="text-black animate-spin" />
                      <span className="text-[12px] text-black/60">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <Camera size={24} className="text-black/55" />
                      <span className="text-[13px] text-black/75">
                        <span className="font-bold">Drag photos here</span> or click to upload
                      </span>
                      <span className="text-[11px] text-black/45">
                        Up to 5 photos · max 5MB each
                      </span>
                    </>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Customer Name */}
            <div>
              <label htmlFor="name" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-black/60 mb-2">
                Display name <span className="text-[#FF3131]">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="How you'd like to be shown"
                maxLength={100}
                className={inputClass}
                required
              />
              <p className="text-[11px] text-black/45 mt-1">
                Reviewing as <span className="font-semibold text-black/70">{customerEmail}</span>
              </p>
            </div>

            <input type="hidden" value={customerEmail} />

            {/* Submit Button — brand red, sharp, full width on mobile */}
            <Button
              type="submit"
              disabled={isSubmitting || uploadingImages}
              className="w-full bg-[#FF3131] hover:bg-[#ff4747] text-white font-bold uppercase tracking-[0.14em] text-xs py-4 rounded-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting…' : 'Post review'}
            </Button>
          </form>
        </>
      )}
    </div>
  )
}
