'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Navigation } from '@/components/layout/Navigation'
import { Product, ProductVariant } from '@/lib/api/products'
import { useCartStore } from '@/lib/store/cart'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { MobileAddToCartBar } from '@/components/products/MobileAddToCartBar'
import { SimilarProducts } from '@/components/recommendations/SimilarProducts'
import { useProductView } from '@/hooks/useProductView'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, ArrowRight, CircleNotch, Check,
  Star, ThumbsUp, ThumbsDown, Minus, Plus, X,
  ShoppingBag, Warning, CheckCircle, Camera, CaretDown
} from '@phosphor-icons/react'

interface ProductPageClientProps {
  slug: string
}

// Types for reviews
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
}

interface ReviewStats {
  averageRating: number
  totalReviews: number
  distribution: Record<number, number>
}

// Helper function to determine if color is light
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

// Helper to parse images
const parseImageArray = (imagesStr: string | undefined): string[] => {
  if (!imagesStr) return []
  try {
    const parsed = JSON.parse(imagesStr)
    if (Array.isArray(parsed)) {
      return parsed.map((img: string | { url: string }) => 
        typeof img === 'string' ? img : img.url
      ).filter((url: string) => url && url.trim() !== '')
    }
  } catch {
    // Parse failed
  }
  return []
}

export default function ProductPageClient({ slug }: ProductPageClientProps) {
  const router = useRouter()
  const addItem = useCartStore(state => state.addItem)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [showAddedMessage, setShowAddedMessage] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  
  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [sortBy, setSortBy] = useState('newest')
  const [showWriteReview, setShowWriteReview] = useState(false)
  
  // Review form state
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [reviewImages, setReviewImages] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState(false)
  
  // Purchase verification state
  const [emailToCheck, setEmailToCheck] = useState('')
  const [checkingEligibility, setCheckingEligibility] = useState(false)
  const [canReview, setCanReview] = useState<boolean | null>(null)
  const [eligibilityMessage, setEligibilityMessage] = useState('')
  const [verifiedOrderId, setVerifiedOrderId] = useState<string | null>(null)

  // Track product view
  useProductView({
    productId: product?.id || '',
    customerId: undefined,
    source: 'product_page',
  })

  // Load product
  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/products/slug/${slug}`)
        if (response.ok) {
          const foundProduct = await response.json()
          setProduct(foundProduct)
          const defaultVariant = foundProduct.variants.find((v: ProductVariant) => v.inventory > 0) || foundProduct.variants[0]
          setSelectedVariant(defaultVariant || null)
          if (defaultVariant) {
            setSelectedSize(defaultVariant.size || null)
            setSelectedColor(defaultVariant.color || null)
          }
        }
      } catch (error) {
        console.error('Failed to load product:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProduct()
  }, [slug])

  // Load reviews
  useEffect(() => {
    const loadReviews = async () => {
      if (!product?.id) return
      setReviewsLoading(true)
      try {
        const response = await fetch(`/api/products/${product.id}/reviews?sortBy=${sortBy}&limit=10`)
        const data = await response.json()
        if (data.data) {
          setReviews(data.data)
          setReviewStats({
            averageRating: data.stats?.averageRating || 0,
            totalReviews: data.stats?.totalReviews || 0,
            distribution: data.stats?.distribution || {}
          })
        }
      } catch (error) {
        console.error('Failed to load reviews:', error)
      } finally {
        setReviewsLoading(false)
      }
    }
    loadReviews()
  }, [product?.id, sortBy])

  // Check review eligibility
  const checkReviewEligibility = async (email: string) => {
    if (!product?.id) return
    setCheckingEligibility(true)
    setFormError('')
    
    try {
      const response = await fetch('/api/reviews/can-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          customerEmail: email,
        }),
      })

      const data = await response.json()
      setCanReview(data.canReview)
      setEligibilityMessage(data.message || '')
      
      if (data.canReview && data.orderId) {
        setVerifiedOrderId(data.orderId)
        setCustomerEmail(email)
      }
    } catch {
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
    checkReviewEligibility(emailToCheck)
  }

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (reviewImages.length + files.length > 5) {
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
          setReviewImages(prev => [...prev, data.url])
        }
      }
    } catch {
      setFormError('Failed to upload image')
    } finally {
      setUploadingImages(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Submit review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (rating === 0) { setFormError('Please select a star rating'); return }
    if (!reviewComment.trim()) { setFormError('Please write a review'); return }
    if (!customerName.trim()) { setFormError('Please enter your name'); return }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product?.id,
          rating,
          title: reviewTitle.trim() || null,
          comment: reviewComment.trim(),
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          orderId: verifiedOrderId || null,
          images: reviewImages.length > 0 ? reviewImages : null
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to submit review')

      setFormSuccess(true)
      setRating(0)
      setReviewTitle('')
      setReviewComment('')
      setCustomerName('')
      setReviewImages([])
      
      setTimeout(() => {
        setFormSuccess(false)
        setShowWriteReview(false)
        // Reload reviews
        if (product?.id) {
          fetch(`/api/products/${product.id}/reviews?sortBy=${sortBy}&limit=10`)
            .then(res => res.json())
            .then(data => {
              if (data.data) {
                setReviews(data.data)
                setReviewStats({
                  averageRating: data.stats?.averageRating || 0,
                  totalReviews: data.stats?.totalReviews || 0,
                  distribution: data.stats?.distribution || {}
                })
              }
            })
        }
      }, 2000)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Vote on review
  const handleVote = async (reviewId: string, voteType: 'helpful' | 'not_helpful') => {
    await fetch(`/api/reviews/${reviewId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteType }),
    })
  }

  // Get sizes and colors from variants
  const sizes = useMemo(() => {
    if (!product) return []
    return [...new Set(product.variants.map(v => v.size).filter(Boolean))] as string[]
  }, [product])

  const colors = useMemo(() => {
    if (!product) return []
    const seenColors = new Set<string>()
    return product.variants.filter(v => {
      if (v.color && v.colorHex && !seenColors.has(v.color)) {
        seenColors.add(v.color)
        return true
      }
      return false
    })
  }, [product])

  // Get images based on selected variant
  const images = useMemo(() => {
    if (!product) return []
    
    if (selectedVariant?.images) {
      const variantImages = parseImageArray(selectedVariant.images)
      if (variantImages.length > 0) return variantImages
    }
    
    const productImages = parseImageArray(product.images)
    return productImages.length > 0 ? productImages : ['/placeholder-product.jpg']
  }, [product, selectedVariant])

  // Reset image index when variant changes
  useEffect(() => {
    setCurrentImageIndex(0)
  }, [selectedVariant?.id])

  // Handle size change
  const handleSizeChange = (size: string) => {
    setSelectedSize(size)
    if (product) {
      const variant = product.variants.find(
        v => v.size === size && (!selectedColor || v.color === selectedColor)
      )
      if (variant) {
        setSelectedVariant(variant)
      }
    }
  }

  // Handle color change
  const handleColorChange = (color: string) => {
    setSelectedColor(color)
    if (product) {
      const variant = product.variants.find(
        v => v.color === color && (!selectedSize || v.size === selectedSize)
      )
      if (variant) {
        setSelectedVariant(variant)
      }
    }
  }

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return
    addItem(product, selectedVariant, quantity)
    setShowAddedMessage(true)
    setTimeout(() => setShowAddedMessage(false), 2000)
  }

  const handleBuyNow = () => {
    if (!product || !selectedVariant) return
    addItem(product, selectedVariant, quantity)
    router.push('/cart')
  }

  const goToPrevImage = () => {
    setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const goToNextImage = () => {
    setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1))
  }

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="pt-32 flex flex-col items-center justify-center">
          <h1 className="text-4xl font-black text-black mb-4">Product Not Found</h1>
          <Link 
            href="/products"
            className="px-8 py-4 bg-black text-white font-bold uppercase tracking-wider hover:bg-black/80 transition-colors"
          >
            Back to Products
          </Link>
        </div>
      </div>
    )
  }

  // Stock and price calculations
  const totalStock = product.variants.reduce((sum, v) => sum + v.inventory, 0)
  const inStock = totalStock > 0
  const lowStock = totalStock > 0 && totalStock <= 5
  const displayPrice = selectedVariant?.price || product.price
  const onSale = product.compareAtPrice && product.compareAtPrice > displayPrice
  const discountPercent = onSale ? Math.round((1 - displayPrice / (product.compareAtPrice || displayPrice)) * 100) : 0

  // Check availability for selected combination
  const getVariantForSizeColor = (size: string | null, color: string | null) => {
    if (!product) return null
    return product.variants.find(v => 
      (!size || v.size === size) && (!color || v.color === color)
    )
  }

  const isSizeAvailable = (size: string) => {
    const variant = getVariantForSizeColor(size, selectedColor)
    return variant && variant.inventory > 0
  }

  const isColorAvailable = (color: string) => {
    const variant = getVariantForSizeColor(selectedSize, color)
    return variant && variant.inventory > 0
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-4">
        <Link 
          href="/products"
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-black/40 hover:text-black transition-colors"
        >
          <ArrowLeft size={12} weight="bold" />
          Back to Shop
        </Link>
      </div>

      {/* Main Product Section - Balanced Layout */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Left: Image Gallery */}
          <div className="relative">
            <div className="lg:sticky lg:top-28">
              {/* Main Image - Square aspect ratio */}
              <div className="relative aspect-square bg-neutral-50 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentImageIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={images[currentImageIndex]}
                      alt={product.name}
                      fill
                      className="object-cover"
                      priority
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Status Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {!inStock && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-white bg-black px-3 py-1.5">
                      Sold Out
                    </span>
                  )}
                  {onSale && inStock && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-white bg-black px-3 py-1.5">
                      −{discountPercent}%
                    </span>
                  )}
                  {lowStock && inStock && !onSale && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-black bg-white/90 px-3 py-1.5">
                      Only {totalStock} left
                    </span>
                  )}
                </div>

                {/* Wishlist */}
                <div className="absolute top-4 right-4">
                  <WishlistButton
                    productId={product.id}
                    productVariantId={selectedVariant?.id}
                    size="lg"
                  />
                </div>

                {/* Image Navigation */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-black hover:text-white transition-all"
                    >
                      <ArrowLeft size={16} weight="bold" />
                    </button>
                    <button
                      onClick={goToNextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-black hover:text-white transition-all"
                    >
                      <ArrowRight size={16} weight="bold" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {images.slice(0, 5).map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`relative aspect-square border-2 transition-all overflow-hidden ${
                        index === currentImageIndex 
                          ? 'border-black' 
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <Image
                        src={image}
                        alt={`View ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Product Info */}
          <div className="space-y-6">
            {/* Category */}
            {product.category && (
              <Link 
                href={`/products?category=${product.category.slug}`}
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 hover:text-black transition-colors"
              >
                {product.category.name}
              </Link>
            )}

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight leading-tight">
              {product.name}
            </h1>

            {/* Rating Summary */}
            {reviewStats && reviewStats.totalReviews > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star 
                      key={i}
                      size={14} 
                      weight={i <= Math.round(reviewStats.averageRating) ? 'fill' : 'regular'}
                      className={i <= Math.round(reviewStats.averageRating) ? 'text-black' : 'text-black/20'}
                    />
                  ))}
                </div>
                <span className="text-sm text-black/60">
                  {reviewStats.averageRating.toFixed(1)} ({reviewStats.totalReviews})
                </span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-black text-black">
                ${displayPrice.toFixed(2)}
              </span>
              {onSale && product.compareAtPrice && (
                <span className="text-lg text-black/30 line-through">
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-black/60 leading-relaxed">
                {product.description}
              </p>
            )}

            <div className="border-t border-black/10 pt-6 space-y-5">
              {/* Color Selection */}
              {colors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-black">Color:</span>
                    {selectedColor && <span className="text-xs text-black/60">{selectedColor}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((variant) => {
                      const isSelected = selectedColor === variant.color
                      const available = isColorAvailable(variant.color!)
                      return (
                        <button
                          key={variant.id}
                          onClick={() => handleColorChange(variant.color!)}
                          disabled={!available}
                          title={variant.color || undefined}
                          className={`
                            relative w-9 h-9 transition-all
                            ${isSelected ? 'ring-2 ring-black ring-offset-2' : 'ring-1 ring-black/20'}
                            ${!available ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:ring-black/50'}
                          `}
                          style={{ backgroundColor: variant.colorHex || '#ccc' }}
                        >
                          {isSelected && variant.colorHex && (
                            <Check 
                              size={12}
                              weight="bold"
                              className="absolute inset-0 m-auto"
                              style={{ color: isLightColor(variant.colorHex) ? '#000' : '#FFF' }} 
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Size Selection */}
              {sizes.length > 0 && (
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-black mb-3 block">Size</span>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => {
                      const isSelected = selectedSize === size
                      const available = isSizeAvailable(size)
                      return (
                        <button
                          key={size}
                          onClick={() => handleSizeChange(size)}
                          disabled={!available}
                          className={`
                            min-w-11 h-11 px-3 text-xs font-bold uppercase tracking-wider transition-all
                            ${isSelected 
                              ? 'bg-black text-white' 
                              : 'bg-white text-black border border-black/20 hover:border-black'
                            }
                            ${!available ? 'opacity-30 cursor-not-allowed line-through' : 'cursor-pointer'}
                          `}
                        >
                          {size}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-black mb-3 block">Quantity</span>
                <div className="flex items-center w-fit border border-black/20">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-11 h-11 flex items-center justify-center hover:bg-black/5 transition-colors"
                  >
                    <Minus size={14} weight="bold" />
                  </button>
                  <span className="w-12 text-center text-sm font-bold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-11 h-11 flex items-center justify-center hover:bg-black/5 transition-colors"
                  >
                    <Plus size={14} weight="bold" />
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4">
              <motion.button
                onClick={handleAddToCart}
                disabled={!inStock || !selectedVariant}
                whileTap={{ scale: 0.98 }}
                className={`
                  w-full h-14 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest transition-all
                  ${!inStock || !selectedVariant
                    ? 'bg-black/10 text-black/30 cursor-not-allowed'
                    : showAddedMessage
                      ? 'bg-emerald-500 text-white'
                      : 'bg-black text-white hover:bg-black/80'
                  }
                `}
              >
                {showAddedMessage ? (
                  <>
                    <Check size={18} weight="bold" />
                    Added to Bag
                  </>
                ) : (
                  inStock ? 'Add to Bag' : 'Sold Out'
                )}
              </motion.button>

              <button
                onClick={handleBuyNow}
                disabled={!inStock || !selectedVariant}
                className={`
                  w-full h-14 flex items-center justify-center text-sm font-black uppercase tracking-widest border-2 border-black transition-all
                  ${!inStock || !selectedVariant
                    ? 'border-black/10 text-black/30 cursor-not-allowed'
                    : 'text-black hover:bg-black hover:text-white'
                  }
                `}
              >
                Buy Now
              </button>
            </div>

            {/* Product Details */}
            {(product.materials || product.careGuide) && (
              <div className="pt-6 border-t border-black/10 space-y-4">
                {product.materials && (
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-black">Materials</span>
                    <p className="text-sm text-black/60 mt-1">{product.materials}</p>
                  </div>
                )}
                {product.careGuide && (
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-black">Care</span>
                    <p className="text-sm text-black/60 mt-1">{product.careGuide}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section className="border-t border-black/10 bg-neutral-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          {/* Reviews Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
            <div>
              <h2 className="text-2xl font-black text-black mb-2">Customer Reviews</h2>
              {reviewStats && reviewStats.totalReviews > 0 && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-4xl font-black text-black">{reviewStats.averageRating.toFixed(1)}</span>
                    <div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star 
                            key={i}
                            size={14} 
                            weight={i <= Math.round(reviewStats.averageRating) ? 'fill' : 'regular'}
                            className={i <= Math.round(reviewStats.averageRating) ? 'text-black' : 'text-black/20'}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-black/50">{reviewStats.totalReviews} reviews</p>
                    </div>
                  </div>
                  
                  {/* Rating Distribution */}
                  <div className="hidden sm:flex items-end gap-1 pl-4 border-l border-black/10">
                    {[5, 4, 3, 2, 1].map(r => {
                      const count = reviewStats.distribution[r] || 0
                      const pct = reviewStats.totalReviews ? (count / reviewStats.totalReviews) * 100 : 0
                      return (
                        <div key={r} className="flex flex-col items-center gap-1">
                          <div className="w-4 bg-black/10 rounded-t" style={{ height: `${Math.max(pct * 0.4, 4)}px` }}>
                            <div className="w-full bg-black rounded-t" style={{ height: `${pct}%` }} />
                          </div>
                          <span className="text-[9px] text-black/40">{r}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setShowWriteReview(true)}
              className="px-6 py-3 bg-black text-white text-sm font-bold uppercase tracking-widest hover:bg-black/80 transition-colors"
            >
              Write a Review
            </button>
          </div>

          {/* Sort Controls */}
          {reviews.length > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs text-black/50">Sort by:</span>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-white border border-black/20 px-4 py-2 pr-8 text-sm font-medium cursor-pointer hover:border-black transition-colors"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="highest">Highest Rated</option>
                  <option value="lowest">Lowest Rated</option>
                  <option value="helpful">Most Helpful</option>
                </select>
                <CaretDown size={14} weight="bold" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black/40" />
              </div>
            </div>
          )}

          {/* Reviews List */}
          {reviewsLoading ? (
            <div className="flex justify-center py-12">
              <CircleNotch size={24} weight="bold" className="animate-spin text-black/30" />
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-6">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onVote={handleVote}
                  formatDate={formatDate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white border border-black/10">
              <p className="text-black/40 mb-4">No reviews yet. Be the first to share your experience!</p>
              <button
                onClick={() => setShowWriteReview(true)}
                className="px-6 py-3 border-2 border-black text-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
              >
                Write a Review
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Write Review Modal */}
      <AnimatePresence>
        {showWriteReview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={() => setShowWriteReview(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-black/10 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-black text-black">Write a Review</h3>
                <button
                  onClick={() => setShowWriteReview(false)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-black/5 transition-colors"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>

              <div className="p-6">
                {/* Purchase Verification */}
                {canReview === null && !checkingEligibility && (
                  <div className="mb-6 p-4 bg-neutral-50 border border-black/10">
                    <div className="flex items-start gap-3 mb-4">
                      <ShoppingBag size={20} className="text-black/60 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-black">Verify Your Purchase</p>
                        <p className="text-xs text-black/60 mt-1">
                          Enter the email used for your order to leave a verified review.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={emailToCheck}
                        onChange={(e) => setEmailToCheck(e.target.value)}
                        placeholder="your@email.com"
                        className="flex-1 px-3 py-2 border border-black/20 text-sm focus:outline-none focus:border-black"
                      />
                      <button 
                        onClick={handleEmailCheck}
                        className="px-4 py-2 bg-black text-white text-sm font-bold uppercase tracking-wider hover:bg-black/80 transition-colors"
                      >
                        Verify
                      </button>
                    </div>
                    {formError && <p className="text-xs text-red-600 mt-2">{formError}</p>}
                  </div>
                )}

                {checkingEligibility && (
                  <div className="mb-6 p-4 bg-neutral-50 border border-black/10 flex items-center gap-3">
                    <CircleNotch size={20} className="text-black animate-spin" />
                    <p className="text-sm text-black/60">Verifying your purchase...</p>
                  </div>
                )}

                {canReview === false && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200">
                    <div className="flex items-start gap-3">
                      <Warning size={20} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-800">{eligibilityMessage}</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Only verified purchasers can leave reviews.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {canReview === true && (
                  <>
                    <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                      <CheckCircle size={18} className="text-emerald-600" weight="fill" />
                      <p className="text-sm text-emerald-700">
                        <span className="font-bold">Verified Purchase</span> — You can leave a review
                      </p>
                    </div>

                    {formSuccess && (
                      <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200">
                        <p className="text-sm text-emerald-800">✨ Thank you! Your review will be published after moderation.</p>
                      </div>
                    )}

                    {formError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
                        {formError}
                      </div>
                    )}

                    <form onSubmit={handleSubmitReview} className="space-y-5">
                      {/* Star Rating */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">Your Rating *</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRating(star)}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              className="p-0.5 transition-transform hover:scale-110"
                            >
                              <Star
                                size={28}
                                weight={star <= (hoverRating || rating) ? 'fill' : 'regular'}
                                className={star <= (hoverRating || rating) ? 'text-black' : 'text-black/20'}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Title */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">Title (Optional)</label>
                        <input
                          type="text"
                          value={reviewTitle}
                          onChange={(e) => setReviewTitle(e.target.value)}
                          placeholder="Summarize your experience"
                          maxLength={100}
                          className="w-full px-3 py-2.5 border border-black/20 text-sm focus:outline-none focus:border-black"
                        />
                      </div>

                      {/* Comment */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">Your Review *</label>
                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder={`Share your thoughts about ${product.name}...`}
                          rows={4}
                          maxLength={1000}
                          className="w-full px-3 py-2.5 border border-black/20 text-sm focus:outline-none focus:border-black resize-none"
                          required
                        />
                        <p className="text-[10px] text-black/40 mt-1">{reviewComment.length}/1000</p>
                      </div>

                      {/* Image Upload */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">Photos (Optional)</label>
                        <div className="flex flex-wrap gap-2">
                          {reviewImages.map((url, index) => (
                            <div key={index} className="relative w-16 h-16 border border-black/20 group">
                              <Image src={url} alt="" fill className="object-cover" />
                              <button
                                type="button"
                                onClick={() => setReviewImages(prev => prev.filter((_, i) => i !== index))}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={10} weight="bold" />
                              </button>
                            </div>
                          ))}
                          {reviewImages.length < 5 && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingImages}
                              className="w-16 h-16 border-2 border-dashed border-black/20 hover:border-black flex items-center justify-center transition-colors disabled:opacity-50"
                            >
                              {uploadingImages ? (
                                <CircleNotch size={16} className="animate-spin text-black/40" />
                              ) : (
                                <Camera size={18} className="text-black/40" />
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
                      </div>

                      {/* Name */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">Your Name *</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Enter your name"
                          maxLength={100}
                          className="w-full px-3 py-2.5 border border-black/20 text-sm focus:outline-none focus:border-black"
                          required
                        />
                      </div>

                      <p className="text-[10px] text-black/40">
                        Reviewing as: <span className="font-medium">{customerEmail}</span>
                      </p>

                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full py-4 bg-black text-white text-sm font-black uppercase tracking-widest hover:bg-black/80 transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Review'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Similar Products */}
      <section className="border-t border-black/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-xl font-black text-black mb-8">You May Also Like</h2>
          <SimilarProducts productId={product.id} />
        </div>
      </section>

      {/* Mobile Add to Cart Bar */}
      <MobileAddToCartBar
        price={displayPrice}
        compareAtPrice={product.compareAtPrice}
        inStock={inStock}
        selectedVariant={selectedVariant}
        quantity={quantity}
        onQuantityChange={setQuantity}
        onAddToCart={handleAddToCart}
        showAddedMessage={showAddedMessage}
      />
    </div>
  )
}

// Review Card Component
function ReviewCard({ 
  review, 
  onVote,
  formatDate 
}: {
  review: Review
  onVote: (id: string, type: 'helpful' | 'not_helpful') => Promise<void>
  formatDate: (date: string) => string
}) {
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount)
  const [notHelpfulCount, setNotHelpfulCount] = useState(review.notHelpfulCount)
  const [expanded, setExpanded] = useState(false)
  
  // Initialize from localStorage to avoid setState in useEffect
  const [voted, setVoted] = useState<'helpful' | 'not_helpful' | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const votedReviews = JSON.parse(localStorage.getItem('votedReviews') || '{}')
      return votedReviews[review.id] || null
    } catch {
      return null
    }
  })

  const handleVote = async (voteType: 'helpful' | 'not_helpful') => {
    if (voted) return
    
    await onVote(review.id, voteType)
    if (voteType === 'helpful') setHelpfulCount(prev => prev + 1)
    else setNotHelpfulCount(prev => prev + 1)
    
    const votedReviews = JSON.parse(localStorage.getItem('votedReviews') || '{}')
    votedReviews[review.id] = voteType
    localStorage.setItem('votedReviews', JSON.stringify(votedReviews))
    setVoted(voteType)
  }

  const shouldTruncate = review.comment.length > 200
  const displayComment = expanded || !shouldTruncate 
    ? review.comment 
    : review.comment.substring(0, 200) + '...'

  let images: string[] = []
  try {
    if (review.images) images = JSON.parse(review.images)
  } catch { /* ignore */ }

  return (
    <div className="bg-white border border-black/10 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-black">{review.customerName}</span>
            {review.isVerified && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5">
                Verified
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star 
                  key={i}
                  size={12} 
                  weight={i <= review.rating ? 'fill' : 'regular'}
                  className={i <= review.rating ? 'text-black' : 'text-black/20'}
                />
              ))}
            </div>
            <span className="text-xs text-black/40">{formatDate(review.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {review.title && (
        <h4 className="font-bold text-black mb-2">{review.title}</h4>
      )}
      <p className="text-sm text-black/70 leading-relaxed">{displayComment}</p>
      {shouldTruncate && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-bold text-black mt-2 hover:underline"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* Images */}
      {images.length > 0 && (
        <div className="flex gap-2 mt-4">
          {images.map((url, i) => (
            <div key={i} className="w-16 h-16 border border-black/10 overflow-hidden">
              <Image src={url} alt="" width={64} height={64} className="object-cover w-full h-full" />
            </div>
          ))}
        </div>
      )}

      {/* Admin Reply */}
      {review.adminReply && (
        <div className="mt-4 p-3 bg-neutral-50 border-l-2 border-black">
          <p className="text-xs font-bold text-black mb-1">Response from Head Over Feels</p>
          <p className="text-sm text-black/70">{review.adminReply}</p>
        </div>
      )}

      {/* Voting */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-black/10">
        <span className="text-xs text-black/40">Helpful?</span>
        <button
          onClick={() => handleVote('helpful')}
          disabled={voted !== null}
          className={`flex items-center gap-1 text-xs px-2 py-1 transition-colors ${
            voted === 'helpful' 
              ? 'bg-black text-white' 
              : 'hover:bg-black/5 text-black/60 disabled:opacity-50'
          }`}
        >
          <ThumbsUp size={12} weight={voted === 'helpful' ? 'fill' : 'regular'} />
          <span>{helpfulCount}</span>
        </button>
        <button
          onClick={() => handleVote('not_helpful')}
          disabled={voted !== null}
          className={`flex items-center gap-1 text-xs px-2 py-1 transition-colors ${
            voted === 'not_helpful' 
              ? 'bg-black text-white' 
              : 'hover:bg-black/5 text-black/60 disabled:opacity-50'
          }`}
        >
          <ThumbsDown size={12} weight={voted === 'not_helpful' ? 'fill' : 'regular'} />
          <span>{notHelpfulCount}</span>
        </button>
      </div>
    </div>
  )
}
