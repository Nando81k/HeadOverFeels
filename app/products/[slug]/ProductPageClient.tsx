'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/layout/Navigation'
import { Product, ProductVariant } from '@/lib/api/products'
import { useCartStore } from '@/lib/store/cart'
import { ImageGallery } from '@/components/products/ImageGallery'
import { VariantSelector } from '@/components/products/VariantSelector'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { Button } from '@/components/ui/button'
import UnifiedReviewSection from '@/components/products/UnifiedReviewSection'
import { SimilarProducts } from '@/components/recommendations/SimilarProducts'
import { useProductView } from '@/hooks/useProductView'
import { ArrowLeft, ShoppingCart, ShareNetwork, CircleNotch, Check } from '@phosphor-icons/react'

interface ProductPageClientProps {
  slug: string
}

export default function ProductPageClient({ slug }: ProductPageClientProps) {
  const router = useRouter()
  const addItem = useCartStore(state => state.addItem)
  
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [showAddedMessage, setShowAddedMessage] = useState(false)

  // Track product view for analytics and recommendations
  useProductView({
    productId: product?.id || '',
    customerId: undefined, // TODO: Add user ID when auth is implemented
    source: 'product_page',
  })

  // Load product and reviews
  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true)
      try {
        // Fetch product by slug
        const response = await fetch(`/api/products/slug/${slug}`)
        
        if (response.ok) {
          const foundProduct = await response.json()
          setProduct(foundProduct)
          // Set default variant
          const defaultVariant = foundProduct.variants.find((v: ProductVariant) => v.inventory > 0) || foundProduct.variants[0]
          setSelectedVariant(defaultVariant || null)
        } else {
          // Product not found or not yet available
          console.error('Product not found')
        }
      } catch (error) {
        console.error('Failed to load product:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [slug])

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
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-black mb-4">Product Not Found</h1>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-6">
        <Link 
          href="/products"
          className="inline-flex items-center text-black/60 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} weight="bold" className="mr-2" />
          Back to Products
        </Link>
      </div>

      {/* Product Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery - Sticky on desktop */}
          <div className="relative">
            <div className="lg:sticky lg:top-24">
              <ImageGallery images={images} productName={product.name} />
              {/* Wishlist Button - Positioned on Image */}
              <div className="absolute top-4 right-4 z-10">
                <WishlistButton
                  productId={product.id}
                  productVariantId={selectedVariant?.id}
                  size="lg"
                />
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Badges */}
            <div className="flex gap-2">
              {onSale && (
                <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-none">
                  SALE
                </span>
              )}
              {!inStock && (
                <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-none">
                  SOLD OUT
                </span>
              )}
              {lowStock && inStock && (
                <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-none">
                  LOW STOCK
                </span>
              )}
              {product.isFeatured && (
                <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-none">
                  FEATURED
                </span>
              )}
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-black mb-2">
                {product.name}
              </h1>
              {product.category && (
                <p className="text-black/60">{product.category.name}</p>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              {onSale ? (
                <>
                  <span className="text-3xl font-bold text-black">
                    ${displayPrice.toFixed(2)}
                  </span>
                  <span className="text-xl text-black/40 line-through">
                    ${product.compareAtPrice?.toFixed(2)}
                  </span>
                  <span className="text-sm font-bold text-black bg-black/5 px-2 py-1 rounded-none">
                    {Math.round((1 - displayPrice / (product.compareAtPrice || displayPrice)) * 100)}% OFF
                  </span>
                </>
              ) : (
                <span className="text-3xl font-bold text-black">
                  ${displayPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-black">Description</h3>
                <p className="text-black/70 leading-relaxed">
                  {product.description}
                </p>
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
              <label className="block text-sm font-bold text-black mb-2">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center border border-black/10 rounded-none hover:bg-black/5 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 h-10 text-center border border-black/10 rounded-none focus:ring-2 focus:ring-black focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min="1"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center border border-black/10 rounded-none hover:bg-black/5 transition-colors"
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
                    <Check size={20} weight="bold" />
                    Added to Cart!
                  </>
                ) : (
                  <>
                    <ShoppingCart size={20} weight="bold" />
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

              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
              >
                <ShareNetwork size={16} weight="bold" />
                Share
              </Button>
            </div>

            {/* Additional Info */}
            <div className="space-y-4 pt-6 border-t border-black/10">
              {product.materials && (
                <div>
                  <h3 className="text-sm font-bold text-black mb-2">Materials</h3>
                  <p className="text-sm text-black/70">{product.materials}</p>
                </div>
              )}
              
              {product.careGuide && (
                <div>
                  <h3 className="text-sm font-bold text-black mb-2">Care Instructions</h3>
                  <p className="text-sm text-black/70">{product.careGuide}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Similar Products */}
        <div className="mt-16">
          <SimilarProducts productId={product.id} />
        </div>

        {/* Reviews Section */}
        {product && (
          <div className="mt-16">
            <UnifiedReviewSection 
              productId={product.id}
              productName={product.name}
            />
          </div>
        )}
      </div>
    </div>
  )
}
