'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trash2, ShoppingCart } from 'lucide-react'

interface WishlistItem {
  id: string
  productId: string
  notes?: string | null
  createdAt: Date
  product: {
    id: string
    name: string
    slug: string
    price: number
    images: string
    isActive: boolean
  }
  productVariant?: {
    id: string
    size?: string | null
    color?: string | null
    price?: number | null
    inventory: number
  } | null
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchWishlist = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/wishlist')
      const { data } = await response.json()
      setItems(data || [])
    } catch (error) {
      console.error('Error fetching wishlist:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const handleRemove = async (id: string) => {
    try {
      await fetch(`/api/wishlist/${id}`, {
        method: 'DELETE'
      })
      setItems(items.filter(item => item.id !== id))
    } catch (error) {
      console.error('Error removing item:', error)
    }
  }

  const getProductImage = (imagesJson: string) => {
    try {
      const images = JSON.parse(imagesJson)
      return images[0] || '/placeholder-product.jpg'
    } catch {
      return '/placeholder-product.jpg'
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <p className="text-gray-600">Loading wishlist...</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">My Wishlist</h1>
        <div className="text-center py-16">
          <p className="text-xl text-gray-600 mb-6">Your wishlist is empty</p>
          <Link
            href="/products"
            className="inline-block bg-black text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">My Wishlist</h1>
      <p className="text-gray-600 mb-8">{items.length} {items.length === 1 ? 'item' : 'items'}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map(item => {
          const productPrice = item.productVariant?.price || item.product.price
          const images = getProductImage(item.product.images)

          return (
            <div key={item.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              <Link href={`/products/${item.product.slug}`}>
                <div className="relative aspect-square">
                  <Image
                    src={images}
                    alt={item.product.name}
                    fill
                    className="object-cover"
                  />
                  {!item.product.isActive && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold">Out of Stock</span>
                    </div>
                  )}
                </div>
              </Link>

              <div className="p-4">
                <Link href={`/products/${item.product.slug}`}>
                  <h3 className="font-semibold text-lg mb-2 hover:text-gray-600 transition-colors line-clamp-2">
                    {item.product.name}
                  </h3>
                </Link>

                {item.productVariant && (
                  <p className="text-sm text-gray-600 mb-2">
                    {item.productVariant.size && `Size: ${item.productVariant.size}`}
                    {item.productVariant.size && item.productVariant.color && ' • '}
                    {item.productVariant.color && `Color: ${item.productVariant.color}`}
                  </p>
                )}

                <p className="text-xl font-bold mb-4">${productPrice.toFixed(2)}</p>

                {item.notes && (
                  <p className="text-sm text-gray-500 italic mb-4">{item.notes}</p>
                )}

                <div className="flex gap-2">
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="flex-1 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={18} />
                    View
                  </Link>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 size={18} className="text-gray-600" />
                  </button>
                </div>

                <p className="text-xs text-gray-400 mt-3">
                  Added {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
