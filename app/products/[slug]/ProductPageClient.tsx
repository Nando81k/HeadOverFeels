'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Navigation } from '@/components/layout/Navigation'
import { Product, ProductVariant } from '@/lib/api/products'
import { useCartStore } from '@/lib/store/cart'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { SimilarProducts } from '@/components/recommendations/SimilarProducts'
import {
  clampQuantity,
  getAvailableColorsForSize,
  getAvailableSizesForColor,
  getColorOptions,
  getDefaultVariant,
  getQuantityCap,
  getSelectionFromVariant,
  getSortedSizes,
  isColorAvailableForSelection,
  isSizeAvailableForSelection,
  resolveVariantForSelection,
} from '@/components/products/variant-selection'
import {
  buildProductPlaceholderImages,
  buildVariantPlaceholderImages,
  parseImageList,
} from '@/lib/commerce/product-placeholders'
import { useProductView } from '@/hooks/useProductView'
import { ExpressCheckout } from '@/components/checkout/ExpressCheckout'
import { motion, AnimatePresence } from 'framer-motion'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { ReviewImageLightbox } from '@/components/products/ReviewImageLightbox'
import {
  ArrowLeft, CaretLeft, CaretRight, CircleNotch, Check,
  Star, ThumbsUp, ThumbsDown, Minus, Plus, X,
  ShoppingBag, Warning, CheckCircle, Camera, CaretDown
} from '@phosphor-icons/react'

interface ProductPageClientProps {
  slug: string
  initialProduct?: Product
}

// Types for reviews
interface Review {
  id: string
  rating: number
  title?: string | null
  comment: string
  images?: string | null
  customerName: string
  /** Cloudinary-hosted customer avatar URL (or null when unset). */
  profilePictureUrl?: string | null
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

export default function ProductPageClient({ slug, initialProduct }: ProductPageClientProps) {
  const router = useRouter()
  const addItem = useCartStore(state => state.addItem)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const buyBoxRef = useRef<HTMLDivElement>(null)
  const [buyBarVisible, setBuyBarVisible] = useState(false)

  const [product, setProduct] = useState<Product | null>(initialProduct ?? null)
  const [loading, setLoading] = useState(!initialProduct)
  const [quantity, setQuantity] = useState(1)
  const [showAddedMessage, setShowAddedMessage] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  
  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false)
  const [sortBy, setSortBy] = useState('newest')
  const [reviewPage, setReviewPage] = useState(1)
  const [reviewsHasNextPage, setReviewsHasNextPage] = useState(false)
  const [reviewsTotalCount, setReviewsTotalCount] = useState(0)
  const [selectedReviewRating, setSelectedReviewRating] = useState<number | null>(null)
  const [reviewVerifiedOnly, setReviewVerifiedOnly] = useState(false)
  const [reviewWithPhotosOnly, setReviewWithPhotosOnly] = useState(false)
  const [showWriteReview, setShowWriteReview] = useState(false)
  // Lightbox is rendered once at the page level so review cards can open it
  // without each card mounting its own copy. Cards call openReviewLightbox
  // with the image set + a starting index.
  const [reviewLightbox, setReviewLightbox] = useState<{
    open: boolean
    images: string[]
    startIndex: number
  }>({ open: false, images: [], startIndex: 0 })
  const openReviewLightbox = useCallback((images: string[], startIndex = 0) => {
    if (!images.length) return
    setReviewLightbox({ open: true, images, startIndex })
  }, [])
  const closeReviewLightbox = useCallback(() => {
    setReviewLightbox((prev) => ({ ...prev, open: false }))
  }, [])
  
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

  // Load product — skipped when RSC page passes initialProduct
  useEffect(() => {
    if (initialProduct) {
      const defaultVariant = getDefaultVariant(initialProduct.variants as ProductVariant[])
      const defaultSelection = getSelectionFromVariant(defaultVariant)
      setSelectedSize(defaultSelection.size)
      setSelectedColor(defaultSelection.color)
      return
    }

    const loadProduct = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/products/slug/${slug}`)
        if (response.ok) {
          const foundProduct = await response.json()
          setProduct(foundProduct)
          const defaultVariant = getDefaultVariant(foundProduct.variants as ProductVariant[])
          const defaultSelection = getSelectionFromVariant(defaultVariant)
          setSelectedSize(defaultSelection.size)
          setSelectedColor(defaultSelection.color)
        }
      } catch (error) {
        console.error('Failed to load product:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProduct()
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const REVIEWS_PAGE_LIMIT = 6

  const buildReviewQueryParams = useCallback((pageNumber: number) => {
    const params = new URLSearchParams({
      page: pageNumber.toString(),
      limit: REVIEWS_PAGE_LIMIT.toString(),
      sortBy,
    })

    if (reviewVerifiedOnly) {
      params.set('verified', 'true')
    }
    if (reviewWithPhotosOnly) {
      params.set('hasMedia', 'true')
    }
    if (selectedReviewRating !== null) {
      params.set('rating', selectedReviewRating.toString())
    }

    return params.toString()
  }, [sortBy, reviewVerifiedOnly, reviewWithPhotosOnly, selectedReviewRating])

  const loadReviews = useCallback(async ({
    append = false,
    pageNumber = 1,
  }: {
    append?: boolean
    pageNumber?: number
  } = {}) => {
    if (!product?.id) return

    if (append) {
      setReviewsLoadingMore(true)
    } else {
      setReviewsLoading(true)
    }

    try {
      const query = buildReviewQueryParams(pageNumber)
      const response = await fetch(`/api/products/${product.id}/reviews?${query}`)
      const data = await response.json()

      if (data.data) {
        setReviews((prev) => (append ? [...prev, ...data.data] : data.data))
        setReviewStats({
          averageRating: data.stats?.averageRating || 0,
          totalReviews: data.stats?.totalReviews || 0,
          distribution: data.stats?.distribution || {}
        })
        setReviewPage(data.pagination?.page || pageNumber)
        setReviewsHasNextPage(Boolean(data.pagination?.hasNextPage))
        setReviewsTotalCount(data.pagination?.totalCount || 0)
      }
    } catch (error) {
      console.error('Failed to load reviews:', error)
    } finally {
      if (append) {
        setReviewsLoadingMore(false)
      } else {
        setReviewsLoading(false)
      }
    }
  }, [product?.id, buildReviewQueryParams])

  // Load reviews when product, sorting, or filters change.
  useEffect(() => {
    if (!product?.id) return
    loadReviews({ pageNumber: 1, append: false })
  }, [product?.id, loadReviews])

  // Show sticky buy bar when buy box scrolls out of view
  useEffect(() => {
    const el = buyBoxRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setBuyBarVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [product])

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
        loadReviews({ pageNumber: 1, append: false })
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

  const variants = useMemo(() => product?.variants || [], [product])

  const sizes = useMemo(() => getSortedSizes(variants), [variants])
  const colorOptions = useMemo(() => getColorOptions(variants), [variants])

  const selectedVariant = useMemo(
    () =>
      resolveVariantForSelection(variants, {
        size: selectedSize,
        color: selectedColor,
      }),
    [variants, selectedSize, selectedColor]
  )

  const availableSizeSet = useMemo(
    () => getAvailableSizesForColor(variants, selectedColor),
    [variants, selectedColor]
  )
  const availableColorSet = useMemo(
    () => getAvailableColorsForSize(variants, selectedSize),
    [variants, selectedSize]
  )

  const unavailableSizeCount = useMemo(
    () => sizes.filter((size) => !availableSizeSet.has(size)).length,
    [sizes, availableSizeSet]
  )
  const unavailableColorCount = useMemo(
    () => colorOptions.filter((option) => !availableColorSet.has(option.color)).length,
    [colorOptions, availableColorSet]
  )

  const availabilityHelperText = useMemo(() => {
    if (selectedColor && unavailableSizeCount > 0) {
      return 'Some sizes are unavailable in the selected color.'
    }
    if (selectedSize && unavailableColorCount > 0) {
      return 'Some colors are unavailable in the selected size.'
    }
    return null
  }, [selectedColor, selectedSize, unavailableSizeCount, unavailableColorCount])

  const variantImagesById = useMemo(() => {
    const imageMap = new Map<string, string[]>()
    for (const variant of variants) {
      imageMap.set(variant.id, parseImageList(variant.images))
    }
    return imageMap
  }, [variants])

  const selectedColorImages = useMemo(() => {
    if (!selectedColor) return []

    for (const variant of variants) {
      if (variant.color !== selectedColor) continue
      const imagesForVariant = variantImagesById.get(variant.id) || []
      if (imagesForVariant.length > 0) return imagesForVariant
    }

    return []
  }, [variants, variantImagesById, selectedColor])

  // Get images based on selected variant
  const images = useMemo(() => {
    if (!product) return []

    if (selectedVariant) {
      const selectedVariantImages = variantImagesById.get(selectedVariant.id) || []
      if (selectedVariantImages.length > 0) return selectedVariantImages
    }

    if (selectedColorImages.length > 0) return selectedColorImages

    const productImages = parseImageList(product.images)
    if (productImages.length > 0) return productImages

    if (selectedVariant || selectedColor) {
      return buildVariantPlaceholderImages({
        productName: product.name,
        productSlug: product.slug,
        color: selectedVariant?.color || selectedColor,
        colorHex: selectedVariant?.colorHex,
        size: selectedVariant?.size || selectedSize,
      })
    }

    return buildProductPlaceholderImages({
      productName: product.name,
      productSlug: product.slug,
    })
  }, [product, selectedVariant, selectedColorImages, variantImagesById, selectedColor, selectedSize])

  const imageSelectionKey = `${selectedVariant?.id || 'none'}::${selectedColor || 'none'}`

  // Reset image index when image-driving selection changes.
  useEffect(() => {
    setCurrentImageIndex(0)
  }, [imageSelectionKey])

  // Keep quantity valid whenever variant or cap changes.
  const maxSelectableQuantity = useMemo(
    () => getQuantityCap(selectedVariant, product?.maxQuantity),
    [selectedVariant, product?.maxQuantity]
  )

  useEffect(() => {
    setQuantity((prev) => clampQuantity(prev, maxSelectableQuantity))
  }, [maxSelectableQuantity])

  const handleSizeChange = (size: string) => {
    if (!isSizeAvailableForSelection(variants, size, selectedColor)) return

    const nextVariant = resolveVariantForSelection(variants, {
      size,
      color: selectedColor,
    })
    const nextSelection = getSelectionFromVariant(nextVariant)

    setSelectedSize(nextSelection.size || size)
    if (colorOptions.length > 0) {
      setSelectedColor(nextSelection.color)
    }
  }

  const handleColorChange = (color: string) => {
    if (!isColorAvailableForSelection(variants, color, selectedSize)) return

    const nextVariant = resolveVariantForSelection(variants, {
      size: selectedSize,
      color,
    })
    const nextSelection = getSelectionFromVariant(nextVariant)

    if (sizes.length > 0) {
      setSelectedSize(nextSelection.size)
    }
    setSelectedColor(nextSelection.color || color)
  }

  const handleQuantityChange = (nextQuantity: number) => {
    setQuantity(clampQuantity(nextQuantity, maxSelectableQuantity))
  }

  const handleAddToCart = () => {
    if (!product || !selectedVariant || maxSelectableQuantity <= 0) return
    const safeQuantity = clampQuantity(quantity, maxSelectableQuantity)
    if (safeQuantity !== quantity) {
      setQuantity(safeQuantity)
    }
    addItem(product, selectedVariant, safeQuantity)
    setShowAddedMessage(true)
    setTimeout(() => setShowAddedMessage(false), 2000)
  }

  const handleBuyNow = () => {
    if (!product || !selectedVariant || maxSelectableQuantity <= 0) return
    const safeQuantity = clampQuantity(quantity, maxSelectableQuantity)
    if (safeQuantity !== quantity) {
      setQuantity(safeQuantity)
    }
    addItem(product, selectedVariant, safeQuantity)
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

  // Human-friendly relative date for review cards. Falls back to the absolute
  // date once the review is more than ~30 days old, so older reviews still
  // anchor to a real date.
  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return ''
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
    const weeks = Math.floor(days / 7)
    if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`
    return formatDate(dateString)
  }

  const hasActiveReviewFilters =
    selectedReviewRating !== null || reviewVerifiedOnly || reviewWithPhotosOnly
  const hasAnyApprovedReviews = (reviewStats?.totalReviews || 0) > 0

  const handleLoadMoreReviews = () => {
    if (reviewsLoadingMore || !reviewsHasNextPage) return
    loadReviews({ append: true, pageNumber: reviewPage + 1 })
  }

  const handleClearReviewFilters = () => {
    setSelectedReviewRating(null)
    setReviewVerifiedOnly(false)
    setReviewWithPhotosOnly(false)
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
        <div className="pt-16 md:pt-28 flex flex-col items-center justify-center">
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
  const selectedStock = selectedVariant?.inventory || 0
  const selectedInStock = selectedStock > 0
  const selectedLowStock = selectedStock > 0 && selectedStock <= 5
  const canPurchaseSelectedVariant = Boolean(selectedVariant) && maxSelectableQuantity > 0
  const canIncreaseQuantity = maxSelectableQuantity > 0 && quantity < maxSelectableQuantity

  const selectedStockText = !selectedVariant
    ? 'Select an option'
    : !selectedInStock
      ? 'Sold out'
      : selectedLowStock
        ? `Only ${selectedStock} left`
        : 'In stock'

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Sticky buy bar — appears when the in-panel buy box scrolls out of
          view. Carries a thumbnail + name + price + Add to Bag so customers
          can purchase from anywhere on the page (reviews, similar products,
          materials section, etc.) without scrolling back up. */}
      <AnimatePresence>
        {buyBarVisible && product && (
          <motion.div
            data-testid="sticky-buy-bar"
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-x-0 top-16 md:top-20 z-30 border-b border-black/10 bg-white/95 backdrop-blur-xl shadow-sm"
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-2.5 flex items-center gap-3 sm:gap-4">
              {/* Thumbnail — uses the active gallery image so it matches the
                  customer's currently-selected colorway. */}
              {images[0] && (
                <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden border border-black/10 bg-neutral-100">
                  <Image
                    src={images[0]}
                    alt={product.name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.12em] text-black truncate">
                  {product.name}
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-sm font-black text-black">${displayPrice.toFixed(2)}</span>
                  {onSale && product.compareAtPrice && (
                    <span className="text-[11px] text-black/40 line-through">
                      ${product.compareAtPrice.toFixed(2)}
                    </span>
                  )}
                  {(selectedColor || selectedSize) && (
                    <span className="hidden sm:inline text-[10px] text-black/50 truncate">
                      · {[selectedColor, selectedSize].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              </div>
              <motion.button
                data-testid="sticky-add-to-bag"
                whileTap={{ scale: 0.97 }}
                onClick={handleAddToCart}
                disabled={!canPurchaseSelectedVariant}
                className={`shrink-0 h-10 px-4 sm:px-6 inline-flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-[0.14em] transition-colors ${
                  !canPurchaseSelectedVariant
                    ? 'bg-black/10 text-black/30 cursor-not-allowed'
                    : showAddedMessage
                      ? 'bg-black/70 text-white'
                      : 'bg-black text-white hover:bg-black/85'
                }`}
              >
                {showAddedMessage ? (
                  <>
                    <Check size={14} weight="bold" />
                    <span className="hidden sm:inline">Added</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag size={14} weight="bold" className="sm:hidden" />
                    <span>{canPurchaseSelectedVariant ? 'Add to Bag' : 'Sold Out'}</span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 md:pt-12 pb-3 md:pb-4">
        <Link 
          href="/products"
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-black/40 hover:text-black transition-colors"
        >
          <ArrowLeft size={12} weight="bold" />
          Back to Shop
        </Link>
      </div>

      {/* Main Product Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
          {/* Left: Image Gallery */}
          <div className="relative">
            <div className="lg:sticky lg:top-28 space-y-2">
              {/* Hero frame — edge-to-edge portrait 4:5, no border, no rounding,
                  no gray fallback. Photo is the loudest element on the page;
                  chrome retreats. `group` lets nav chevrons react to hover. */}
              <div className="group relative aspect-[4/5] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentImageIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
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

                {/* Status badges — sharp corners, tighter padding to match
                    the storefront's editorial language. */}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                  {!inStock && (
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white bg-black px-2.5 py-1">
                      Sold Out
                    </span>
                  )}
                  {onSale && inStock && (
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white bg-black px-2.5 py-1">
                      −{discountPercent}%
                    </span>
                  )}
                  {lowStock && inStock && !onSale && (
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black bg-white/90 px-2.5 py-1">
                      Only {totalStock} left
                    </span>
                  )}
                </div>

                <div className="absolute top-3 right-3">
                  <WishlistButton
                    productId={product.id}
                    productVariantId={selectedVariant?.id}
                    size="lg"
                  />
                </div>

                {images.length > 1 && (
                  <>
                    {/* Edge-flush chevrons. Mobile: always visible (no hover
                        affordance). Desktop: fade in on hover. Wide vertical
                        hit zone with a small visible glyph. */}
                    <button
                      onClick={goToPrevImage}
                      aria-label="Previous image"
                      className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-start pl-2 text-white/90 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 focus-visible:opacity-100 focus-visible:outline-none"
                    >
                      <span className="inline-flex items-center justify-center h-10 w-8 bg-black/40 backdrop-blur-sm hover:bg-black/70 transition-colors">
                        <CaretLeft size={18} weight="bold" />
                      </span>
                    </button>
                    <button
                      onClick={goToNextImage}
                      aria-label="Next image"
                      className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-end pr-2 text-white/90 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 focus-visible:opacity-100 focus-visible:outline-none"
                    >
                      <span className="inline-flex items-center justify-center h-10 w-8 bg-black/40 backdrop-blur-sm hover:bg-black/70 transition-colors">
                        <CaretRight size={18} weight="bold" />
                      </span>
                    </button>

                    {/* Image counter — replaces the visual weight the loud
                        arrow buttons used to carry. */}
                    <div className="absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-[0.16em] tabular-nums text-white bg-black/55 backdrop-blur-sm px-2.5 py-1">
                      {currentImageIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail strip — single row, sharp corners, selected gets a
                  thin bottom rule rather than swapping the whole border. */}
              {images.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto">
                  {images.slice(0, 6).map((image, index) => {
                    const isActive = index === currentImageIndex
                    return (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        aria-label={`View image ${index + 1}`}
                        aria-pressed={isActive}
                        className={`relative aspect-square w-20 shrink-0 overflow-hidden border-b-2 transition-all ${
                          isActive
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
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Product Info */}
          <div className="space-y-4">
            {product.category && (
              <Link
                href={`/products?category=${product.category.slug}`}
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 hover:text-black transition-colors"
              >
                {product.category.name}
              </Link>
            )}

            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight leading-tight">
              {product.name}
            </h1>

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

            {/* Always-visible price — sits at the top of the panel so customers
                see the cost immediately, without depending on scroll. */}
            <div data-testid="product-price" className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black text-black tracking-tight">
                ${displayPrice.toFixed(2)}
              </span>
              {onSale && product.compareAtPrice && (
                <>
                  <span className="text-base sm:text-lg text-black/30 line-through">
                    ${product.compareAtPrice.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] bg-black text-white px-2 py-1">
                    Save {discountPercent}%
                  </span>
                </>
              )}
            </div>

            {product.description && (
              <p className="text-sm text-black/65 leading-relaxed">
                {product.description}
              </p>
            )}

            {/* Buy box — flush column with hairline dividers, no bordered card. */}
            <div ref={buyBoxRef} className="space-y-4">
              {colorOptions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-black">Color</span>
                    <span data-testid="selected-color-value" className="text-[10px] uppercase tracking-[0.12em] text-black/60">
                      {(selectedColor || 'N/A').toUpperCase()}
                    </span>
                  </div>
                  {/* Single-row circular swatches matching ProductCard. Selected
                      gets a black ring; unavailable-in-current-size dims to
                      40% with a diagonal line overlay. */}
                  <div className="flex flex-wrap gap-2.5">
                    {colorOptions.map((option) => {
                      const isSelected = selectedColor === option.color
                      const available = availableColorSet.has(option.color)
                      const hasValidHex =
                        Boolean(option.colorHex) &&
                        /^#[0-9A-Fa-f]{6}$/.test(option.colorHex || '')
                      const swatchColor = hasValidHex ? (option.colorHex || '#D4D4D4') : '#D4D4D4'
                      // Diagonal "unavailable" line drawn via background gradient
                      // when the color isn't valid for the currently selected
                      // size — reads at a glance without taking extra space.
                      const unavailableOverlay = !available
                        ? 'linear-gradient(45deg, transparent 47%, rgba(0,0,0,0.45) 49%, rgba(0,0,0,0.45) 51%, transparent 53%)'
                        : undefined

                      return (
                        <button
                          key={option.color}
                          type="button"
                          onClick={() => handleColorChange(option.color)}
                          disabled={!available}
                          aria-label={`Select color ${option.color}${!available ? ' — unavailable in current size' : ''}`}
                          aria-pressed={isSelected}
                          title={option.color}
                          className={`relative h-9 w-9 rounded-full border-2 transition-[box-shadow,border-color] focus-visible:outline-none ${
                            isSelected
                              ? 'border-transparent ring-2 ring-black ring-offset-2 ring-offset-white'
                              : 'border-black/15 hover:border-black/45'
                          } ${!available ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                          style={{
                            backgroundColor: swatchColor,
                            backgroundImage: unavailableOverlay,
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {sizes.length > 0 && (
                <div className="border-t border-black/5 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-black">Size</span>
                    <span data-testid="selected-size-value" className="text-[10px] uppercase tracking-[0.12em] text-black/60">
                      {(selectedSize || 'N/A').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => {
                      const isSelected = selectedSize === size
                      const available = availableSizeSet.has(size)

                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handleSizeChange(size)}
                          disabled={!available}
                          aria-label={`Select size ${size}`}
                          className={`
                            min-w-[44px] h-10 px-3 border text-xs font-black uppercase tracking-[0.1em] transition-colors
                            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black
                            ${isSelected ? 'bg-black text-white border-black' : 'bg-white text-black border-black/15 hover:border-black'}
                            ${!available ? 'bg-neutral-50 text-black/35 border-black/10 line-through cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          {size}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {availabilityHelperText && (
                <p data-testid="availability-helper" className="text-[11px] text-black/55 -mt-2">
                  {availabilityHelperText}
                </p>
              )}

              <div className="border-t border-black/5 pt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-black">Quantity</span>
                  <span className="text-[10px] text-black/55">
                    {maxSelectableQuantity > 0 ? (
                      <>Max {maxSelectableQuantity}</>
                    ) : (
                      <>Unavailable</>
                    )}
                  </span>
                </div>
                <div className="flex items-center w-fit border border-black/15">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1 || maxSelectableQuantity <= 0}
                    aria-label="Decrease quantity"
                    className="w-10 h-10 flex items-center justify-center hover:bg-black/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus size={12} weight="bold" />
                  </button>
                  <span data-testid="selected-quantity" className="w-10 text-center text-xs font-bold tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={!canIncreaseQuantity}
                    aria-label="Increase quantity"
                    className="w-10 h-10 flex items-center justify-center hover:bg-black/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} weight="bold" />
                  </button>
                </div>
                {/* selection-cap-text retained for tests; visually superseded
                    by the inline "Max N" label above. Visually hidden so
                    layout collapses but data-testid still resolves. */}
                <p data-testid="selection-cap-text" className="sr-only">
                  {maxSelectableQuantity > 0 ? (
                    <>Max {maxSelectableQuantity} for this selection</>
                  ) : (
                    <>Unavailable for selected options</>
                  )}
                </p>
              </div>

              <div className="space-y-2 border-t border-black/5 pt-4">
                <motion.button
                  data-testid="add-to-bag-button"
                  onClick={handleAddToCart}
                  disabled={!canPurchaseSelectedVariant}
                  whileTap={{ scale: 0.98 }}
                  className={`
                    w-full h-12 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.16em] transition-colors
                    ${!canPurchaseSelectedVariant
                      ? 'bg-black/10 text-black/30 cursor-not-allowed'
                      : showAddedMessage
                        ? 'bg-black/70 text-white'
                        : 'bg-black text-white hover:bg-black/85'
                    }
                  `}
                >
                  {showAddedMessage ? (
                    <>
                      <Check size={16} weight="bold" />
                      Added to Bag
                    </>
                  ) : (
                    canPurchaseSelectedVariant ? 'Add to Bag' : 'Sold Out'
                  )}
                </motion.button>

                <button
                  onClick={handleBuyNow}
                  disabled={!canPurchaseSelectedVariant}
                  className={`
                    w-full h-12 flex items-center justify-center text-xs font-black uppercase tracking-[0.16em] border transition-colors
                    ${!canPurchaseSelectedVariant
                      ? 'border-black/10 text-black/30 cursor-not-allowed'
                      : 'border-black text-black hover:bg-black hover:text-white'
                    }
                  `}
                >
                  Buy Now
                </button>
              </div>

              {canPurchaseSelectedVariant && product && selectedVariant && (
                <ExpressCheckout
                  items={[{ product, variant: selectedVariant, quantity }]}
                  subtotal={displayPrice * quantity}
                  onSuccess={(orderId) => {
                    router.push(`/order/confirmation?orderId=${orderId}&success=true`)
                  }}
                />
              )}
            </div>

            {(product.materials || product.careGuide) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-black/5">
                {product.materials && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-black">Materials</span>
                    <p className="text-sm text-black/65 mt-1.5 leading-relaxed">{product.materials}</p>
                  </div>
                )}
                {product.careGuide && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-black">Care</span>
                    <p className="text-sm text-black/65 mt-1.5 leading-relaxed">{product.careGuide}</p>
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
          {/* Heading row — title + subtitle on the left, primary CTA right. */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF3131] mb-2">Reviews</p>
              <h2 className="text-3xl sm:text-4xl font-black text-black tracking-tight">
                What customers are saying
              </h2>
              {reviewStats && reviewStats.totalReviews > 0 ? (
                <p className="text-sm text-black/55 mt-2">
                  Based on {reviewStats.totalReviews} verified {reviewStats.totalReviews === 1 ? 'review' : 'reviews'}
                  {(() => {
                    const top = (reviewStats.distribution[5] || 0) + (reviewStats.distribution[4] || 0)
                    const pct = reviewStats.totalReviews ? Math.round((top / reviewStats.totalReviews) * 100) : 0
                    return pct >= 50 ? ` · ${pct}% rated 4 stars or higher` : ''
                  })()}
                </p>
              ) : null}
            </div>

            <button
              onClick={() => setShowWriteReview(true)}
              className="self-start sm:self-auto px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-[0.14em] hover:bg-black/85 transition-colors"
            >
              Write a Review
            </button>
          </div>

          {reviewStats && reviewStats.totalReviews > 0 ? (
            /* Unified stats panel — numeric + distribution share one card with
               a vertical divider between columns at md+. The bars are
               clickable filters; an inline hint communicates that. */
            <div className="bg-white border border-black/10 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] divide-y md:divide-y-0 md:divide-x divide-black/10">
                {/* Left — numeric */}
                <div className="p-5 sm:p-6">
                  <p className="text-[64px] leading-none font-black text-black tracking-tight tabular-nums">
                    {reviewStats.averageRating.toFixed(1)}
                  </p>
                  <div className="flex gap-0.5 mt-2.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        size={18}
                        weight={i <= Math.round(reviewStats.averageRating) ? 'fill' : 'regular'}
                        className={i <= Math.round(reviewStats.averageRating) ? 'text-amber-500' : 'text-black/15'}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-black/55 mt-3 uppercase tracking-[0.14em] font-bold">
                    {reviewStats.totalReviews} {reviewStats.totalReviews === 1 ? 'review' : 'reviews'}
                  </p>
                  {(() => {
                    const top = (reviewStats.distribution[5] || 0) + (reviewStats.distribution[4] || 0)
                    const pct = reviewStats.totalReviews ? Math.round((top / reviewStats.totalReviews) * 100) : 0
                    if (pct < 50) return null
                    return (
                      <p className="text-[11px] text-emerald-700 mt-1 font-semibold">
                        {pct}% recommend
                      </p>
                    )
                  })()}
                </div>

                {/* Right — distribution bars (clickable to filter) */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-black/45">
                      Rating breakdown
                    </p>
                    {selectedReviewRating === null ? (
                      <p className="text-[10px] text-black/35 hidden sm:block">
                        Click a row to filter
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = reviewStats.distribution[star] || 0
                      const pct = reviewStats.totalReviews
                        ? Math.round((count / reviewStats.totalReviews) * 100)
                        : 0
                      const isSelected = selectedReviewRating === star

                      return (
                        <button
                          key={star}
                          type="button"
                          data-testid={`review-rating-bar-${star}`}
                          onClick={() =>
                            setSelectedReviewRating((prev) => (prev === star ? null : star))
                          }
                          aria-label={`Filter by ${star} star reviews · ${count} ${count === 1 ? 'review' : 'reviews'} · ${pct}%`}
                          aria-pressed={isSelected}
                          className={`w-full flex items-center gap-3 text-left px-2 py-1.5 transition-colors ${
                            isSelected
                              ? 'bg-black text-white'
                              : 'hover:bg-black/5 text-black focus:bg-black/5 focus:outline-none'
                          }`}
                        >
                          <span className={`w-12 text-xs font-bold tabular-nums inline-flex items-center gap-0.5 ${isSelected ? 'text-white' : 'text-black/70'}`}>
                            {star}
                            <Star size={11} weight="fill" className={isSelected ? 'text-white' : 'text-amber-500'} />
                          </span>
                          <div className={`flex-1 h-2 overflow-hidden ${isSelected ? 'bg-white/25' : 'bg-black/10'}`}>
                            <div
                              className={isSelected ? 'h-full bg-white' : 'h-full bg-black'}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`w-10 text-right text-xs font-medium tabular-nums ${isSelected ? 'text-white' : 'text-black/60'}`}>
                            {count}
                          </span>
                          <span className={`w-10 text-right text-[10px] tabular-nums ${isSelected ? 'text-white/75' : 'text-black/40'} hidden sm:inline-block`}>
                            {pct}%
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-black/55 mb-6">
              No reviews yet. Be the first to share your experience.
            </p>
          )}

          {hasAnyApprovedReviews && (
            /* Single toolbar row — sort chips left, filters + counter right.
               Star quick-filters were dropped because the distribution bars
               above already do the same job. */
            <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-black/10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-black/45 mr-1">Sort</span>
                {[
                  { value: 'newest', label: 'Newest' },
                  { value: 'helpful', label: 'Most helpful' },
                  { value: 'highest', label: 'Highest' },
                  { value: 'lowest', label: 'Lowest' },
                ].map(({ value, label }) => {
                  const isActive = sortBy === value
                  return (
                    <button
                      key={value}
                      type="button"
                      data-testid={`review-sort-${value}`}
                      onClick={() => setSortBy(value)}
                      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] border transition-colors ${
                        isActive
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black/70 border-black/15 hover:border-black hover:text-black'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  data-testid="review-filter-verified"
                  type="button"
                  onClick={() => setReviewVerifiedOnly((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] border transition-colors ${
                    reviewVerifiedOnly
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black/70 border-black/15 hover:border-black'
                  }`}
                >
                  <CheckCircle size={13} weight={reviewVerifiedOnly ? 'fill' : 'regular'} />
                  Verified
                </button>
                <button
                  data-testid="review-filter-photos"
                  type="button"
                  onClick={() => setReviewWithPhotosOnly((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] border transition-colors ${
                    reviewWithPhotosOnly
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black/70 border-black/15 hover:border-black'
                  }`}
                >
                  <Camera size={13} weight={reviewWithPhotosOnly ? 'fill' : 'regular'} />
                  With photos
                </button>
                {hasActiveReviewFilters && (
                  <button
                    data-testid="review-filter-clear"
                    type="button"
                    onClick={handleClearReviewFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black/55 hover:text-black transition-colors"
                  >
                    <X size={13} weight="bold" />
                    Clear
                  </button>
                )}
                <span className="hidden lg:inline-block w-px h-5 bg-black/10 mx-1" aria-hidden />
                <span className="text-[11px] text-black/55 tabular-nums">
                  {reviews.length} of {reviewsTotalCount}
                </span>
                {reviewsLoading && reviews.length > 0 && (
                  <span className="text-[11px] text-black/45">· Updating…</span>
                )}
              </div>
            </div>
          )}

          {/* Reviews List */}
          {reviewsLoading && reviews.length === 0 ? (
            <div className="flex justify-center py-12">
              <CircleNotch size={24} weight="bold" className="animate-spin text-black/30" />
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onVote={handleVote}
                  formatDate={formatRelativeDate}
                  onOpenImages={openReviewLightbox}
                />
              ))}

              {reviewsHasNextPage && (
                <div className="pt-2 text-center">
                  <button
                    data-testid="review-load-more"
                    type="button"
                    onClick={handleLoadMoreReviews}
                    disabled={reviewsLoadingMore}
                    className="inline-flex items-center justify-center px-6 py-3 border border-black text-sm font-bold uppercase tracking-[0.14em] rounded-lg hover:bg-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {reviewsLoadingMore ? 'Loading…' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          ) : hasAnyApprovedReviews && hasActiveReviewFilters ? (
            <div className="text-center py-14 bg-white border border-black/10 rounded-xl">
              <p className="text-black/55 mb-4">No reviews match your current filters.</p>
              <button
                type="button"
                onClick={handleClearReviewFilters}
                className="px-5 py-2 border border-black text-xs font-bold uppercase tracking-[0.14em] rounded-lg hover:bg-black hover:text-white transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="text-center py-16 bg-white border border-black/10 rounded-xl">
              <p className="text-black/45 mb-4">No reviews yet. Be the first to share your experience!</p>
              <button
                onClick={() => setShowWriteReview(true)}
                className="px-6 py-3 border-2 border-black text-sm font-bold uppercase tracking-widest rounded-lg hover:bg-black hover:text-white transition-colors"
              >
                Write a Review
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Review image lightbox — mounted once at the page level so any review
          card can open it via openReviewLightbox(images, startIndex). */}
      <ReviewImageLightbox
        isOpen={reviewLightbox.open}
        images={reviewLightbox.images}
        startIndex={reviewLightbox.startIndex}
        onClose={closeReviewLightbox}
      />

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
              className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-black/10 shadow-2xl"
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
                  <div className="mb-6 p-4 bg-neutral-50 border border-black/10 rounded-lg">
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
                        className="flex-1 px-3 py-2 border border-black/20 rounded-lg text-sm focus:outline-none focus:border-black"
                      />
                      <button 
                        onClick={handleEmailCheck}
                        className="px-4 py-2 bg-black text-white text-sm font-bold uppercase tracking-wider rounded-lg hover:bg-black/80 transition-colors"
                      >
                        Verify
                      </button>
                    </div>
                    {formError && <p className="text-xs text-red-600 mt-2">{formError}</p>}
                  </div>
                )}

                {checkingEligibility && (
                  <div className="mb-6 p-4 bg-neutral-50 border border-black/10 rounded-lg flex items-center gap-3">
                    <CircleNotch size={20} className="text-black animate-spin" />
                    <p className="text-sm text-black/60">Verifying your purchase...</p>
                  </div>
                )}

                {canReview === false && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
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
                      <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <p className="text-sm text-emerald-800">✨ Thank you! Your review will be published after moderation.</p>
                      </div>
                    )}

                    {formError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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
                              <Image src={url} alt={`Review photo ${index + 1}`} fill className="object-cover" />
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <SimilarProducts productId={product.id} />
        </div>
      </section>

    </div>
  )
}

// Review Card Component
function ReviewCard({
  review,
  onVote,
  formatDate,
  onOpenImages,
}: {
  review: Review
  onVote: (id: string, type: 'helpful' | 'not_helpful') => Promise<void>
  formatDate: (date: string) => string
  onOpenImages: (images: string[], startIndex?: number) => void
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

  // Photo grid presents up to 4 visible thumbnails in a row with a 5th
  // "+N more" tile when the review has additional images. Click any tile to
  // open the page-level lightbox at that index.
  const visibleImageCount = 4
  const overflowCount = Math.max(0, images.length - visibleImageCount)
  const visibleImages = images.slice(0, visibleImageCount)

  return (
    <article className="bg-white border border-black/10 p-5 sm:p-6">
      {/* Header — avatar + identity + meta */}
      <header className="flex items-start gap-3 sm:gap-4 mb-4">
        <UserAvatar
          src={review.profilePictureUrl ?? undefined}
          name={review.customerName}
          size={48}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
            <span className="font-bold text-black text-[15px]">{review.customerName}</span>
            {review.isVerified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5">
                <CheckCircle size={12} weight="fill" />
                Verified Purchase
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={16}
                  weight={i <= review.rating ? 'fill' : 'regular'}
                  className={i <= review.rating ? 'text-amber-500' : 'text-black/15'}
                />
              ))}
            </div>
            <span className="text-[11px] text-black/45" title={review.createdAt}>
              · {formatDate(review.createdAt)}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      {review.title && (
        <h4 className="font-bold text-black text-[17px] tracking-tight mb-2">{review.title}</h4>
      )}
      <p className="text-[14px] text-black/75 leading-relaxed whitespace-pre-wrap">{displayComment}</p>
      {shouldTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-bold text-black mt-2 hover:underline"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* Photo grid — 96×96 squares, click → lightbox. The 5th tile shows
          "+N" with a darkened overlay when there are more than 4 images. */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-4">
          {visibleImages.map((url, i) => {
            const isOverflowTile = overflowCount > 0 && i === visibleImageCount - 1
            return (
              <button
                key={`${review.id}-img-${i}`}
                type="button"
                onClick={() => onOpenImages(images, i)}
                className="relative aspect-square w-full overflow-hidden border border-black/10 transition-transform hover:scale-[1.02] focus:scale-[1.02] focus:outline-none focus:border-black"
                aria-label={`View review photo ${i + 1} of ${images.length}`}
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
                {isOverflowTile ? (
                  <span className="absolute inset-0 bg-black/55 text-white inline-flex items-center justify-center text-base font-bold">
                    +{overflowCount + 1}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      {/* Admin Reply */}
      {review.adminReply && (
        <div className="mt-4 p-3 bg-neutral-50 border-l-2 border-black">
          <p className="text-xs font-bold text-black mb-1 uppercase tracking-[0.08em]">Response from Head Over Feels</p>
          <p className="text-sm text-black/70">{review.adminReply}</p>
        </div>
      )}

      {/* Voting */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-black/10">
        <span className="text-xs text-black/45">Was this helpful?</span>
        <button
          onClick={() => handleVote('helpful')}
          disabled={voted !== null}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border transition-colors ${
            voted === 'helpful'
              ? 'bg-black text-white border-black'
              : 'border-black/15 text-black/70 hover:bg-black/5 hover:border-black/30 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          <ThumbsUp size={14} weight={voted === 'helpful' ? 'fill' : 'regular'} />
          <span>{helpfulCount}</span>
        </button>
        <button
          onClick={() => handleVote('not_helpful')}
          disabled={voted !== null}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border transition-colors ${
            voted === 'not_helpful'
              ? 'bg-black text-white border-black'
              : 'border-black/15 text-black/70 hover:bg-black/5 hover:border-black/30 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          <ThumbsDown size={14} weight={voted === 'not_helpful' ? 'fill' : 'regular'} />
          <span>{notHelpfulCount}</span>
        </button>
      </div>
    </article>
  )
}
