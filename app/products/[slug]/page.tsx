'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/layout/Navigation'
import { productApi, Product, ProductVariant } from '@/lib/api/products'
import { useCartStore } from '@/lib/store/cart'
import { ImageGallery } from '@/components/products/ImageGallery'
import { VariantSelector } from '@/components/products/VariantSelector'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { Button } from '@/components/ui/button'
import ProductRating from '@/components/products/ProductRating'
import { ReviewList } from '@/components/products/ReviewList'
import ReviewForm from '@/components/products/ReviewForm'
import { ArrowLeft, ShoppingCart, Share2, Loader2, Check } from 'lucide-react'

interface ProductPageProps {
  params: Promise<{
    slug: string
  }>
}

export default function ProductPage({ params }: ProductPageProps) {
  const { slug } = use(params)
  const router = useRouter()
  const addItem = useCartStore(state => state.addItem)
  
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [showAddedMessage, setShowAddedMessage] = useState(false)
  const [reviewStats, setReviewStats] = useState<{
    averageRating: number
    totalReviews: number
    distribution: Record<number, number>
  } | null>(null)
  const [reviews, setReviews] = useState<unknown[]>([])

  // Load product and reviews
  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true)
      try {
        // Since we don't have a getBySlug method, we'll fetch all and filter
        const response = await productApi.getAll({ isActive: true })
        
        if (response.data) {
          const foundProduct = response.data.data.find(p => p.slug === slug)
          if (foundProduct) {
            setProduct(foundProduct)
            // Set default variant
            const defaultVariant = foundProduct.variants.find(v => v.inventory > 0) || foundProduct.variants[0]
            setSelectedVariant(defaultVariant || null)
            
            // Fetch reviews for this product
            loadReviews(foundProduct.id)
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

  const loadReviews = async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}/reviews?page=1&limit=10&sortBy=newest`)
      const data = await response.json()
      
      if (response.ok) {
        setReviewStats(data.stats)
        setReviews(data.data)
      }
    } catch (error) {
      console.error('Failed to load reviews:', error)
    }
  }

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return
    
    addItem(product, selectedVariant, quantity)
    setShowAddedMessage(true)
    
    // Hide message after 2 seconds
    setTimeout(() => {
      setShowAddedMessage(false)
    }, 2000)
  }

  const handleBuyNow = () => {
    if (!product || !selectedVariant) return
    
    addItem(product, selectedVariant, quantity)
    router.push('/cart')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
        <Link href="/products">
          <Button>Back to Products</Button>
        </Link>
      </div>
    )
  }

  // Parse images - use variant images if available, otherwise product images
  let images: Array<{ url: string; alt?: string }> = []
  try {
    // Check if selected variant has images
    if (selectedVariant?.images) {
      const variantParsed = JSON.parse(selectedVariant.images)
      images = variantParsed && variantParsed.length > 0 ? variantParsed : []
    }
    
    // Fallback to product images if no variant images
    if (images.length === 0 && product.images) {
      const parsed = JSON.parse(product.images)
      images = parsed && parsed.length > 0 ? parsed : []
    }
  } catch {
    images = []
  }

  // Check stock
  const totalStock = product.variants.reduce((sum, v) => sum + v.inventory, 0)
  const inStock = totalStock > 0
  const lowStock = totalStock > 0 && totalStock <= 5

  // Calculate price
  const displayPrice = selectedVariant?.price || product.price
  const onSale = product.compareAtPrice && product.compareAtPrice > displayPrice

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link 
          href="/products"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </Link>
      </div>

      {/* Product Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div>
            <ImageGallery images={images} productName={product.name} />
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Badges */}
            <div className="flex gap-2">
              {onSale && (
                <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded">
                  SALE
                </span>
              )}
              {!inStock && (
                <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded">
                  SOLD OUT
                </span>
              )}
              {lowStock && inStock && (
                <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded">
                  LOW STOCK
                </span>
              )}
              {product.isFeatured && (
                <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded">
                  FEATURED
                </span>
              )}
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                {product.name}
              </h1>
              {product.category && (
                <p className="text-gray-500">{product.category.name}</p>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              {onSale ? (
                <>
                  <span className="text-3xl font-bold text-red-600">
                    ${displayPrice.toFixed(2)}
                  </span>
                  <span className="text-xl text-gray-400 line-through">
                    ${product.compareAtPrice?.toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
                    {Math.round((1 - displayPrice / (product.compareAtPrice || displayPrice)) * 100)}% OFF
                  </span>
                </>
              ) : (
                <span className="text-3xl font-bold text-gray-900">
                  ${displayPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="prose prose-sm text-gray-600">
                <p>{product.description}</p>
              </div>
            )}

            {/* Variant Selector */}
            {product.variants.length > 0 && (
              <VariantSelector
                variants={product.variants}
                onVariantChange={setSelectedVariant}
              />
            )}

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-10 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  min="1"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleAddToCart}
                disabled={!inStock || !selectedVariant}
                className="w-full flex items-center justify-center gap-2"
                size="lg"
              >
                {showAddedMessage ? (
                  <>
                    <Check className="w-5 h-5" />
                    Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    {inStock ? 'Add to Cart' : 'Out of Stock'}
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleBuyNow}
                disabled={!inStock || !selectedVariant}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Buy Now
              </Button>

              <div className="flex gap-2">
                <WishlistButton
                  productId={product.id}
                  productVariantId={selectedVariant?.id}
                  size="lg"
                />
                <Button
                  variant="outline"
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </div>

            {/* Additional Info */}
            <div className="space-y-4 pt-6 border-t border-gray-200">
              {product.materials && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Materials</h3>
                  <p className="text-sm text-gray-600">{product.materials}</p>
                </div>
              )}
              
              {product.careGuide && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Care Instructions</h3>
                  <p className="text-sm text-gray-600">{product.careGuide}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        {product && (
          <div className="mt-16 space-y-8">
            {/* Rating Summary */}
            {reviewStats && (
              <ProductRating stats={reviewStats} />
            )}

            {/* Reviews List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold mb-6">Customer Reviews</h3>
              <ReviewList 
                productId={product.id}
                initialReviews={reviews as never[]}
                initialStats={reviewStats || undefined}
              />
            </div>

            {/* Review Form */}
            <ReviewForm 
              productId={product.id}
              productName={product.name}
              onSuccess={() => product && loadReviews(product.id)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
