'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'

interface WishlistButtonProps {
  productId: string
  productVariantId?: string
  size?: 'sm' | 'md' | 'lg'
  customerId?: string
  initialIsInWishlist?: boolean
  onToggle?: (isInWishlist: boolean) => void
}

export function WishlistButton({
  productId,
  productVariantId,
  size = 'md',
  customerId,
  initialIsInWishlist = false,
  onToggle
}: WishlistButtonProps) {
  const [isInWishlist, setIsInWishlist] = useState(initialIsInWishlist)
  const [isLoading, setIsLoading] = useState(false)

  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  }

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  }

  const handleToggle = async () => {
    setIsLoading(true)

    try {
      if (isInWishlist) {
        // Remove from wishlist - need to find the wishlist item ID first
        const response = await fetch(`/api/wishlist?customerId=${customerId || ''}`)
        const { data } = await response.json()
        
        const item = data?.find((item: { productId: string; productVariantId?: string | null }) => 
          item.productId === productId && 
          (productVariantId ? item.productVariantId === productVariantId : !item.productVariantId)
        )

        if (item) {
          await fetch(`/api/wishlist/${item.id}`, {
            method: 'DELETE'
          })
        }

        setIsInWishlist(false)
        onToggle?.(false)
      } else {
        // Add to wishlist
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            productId,
            productVariantId,
            customerId
          })
        })

        if (response.ok) {
          setIsInWishlist(true)
          onToggle?.(true)
        } else if (response.status === 409) {
          // Already in wishlist
          setIsInWishlist(true)
          onToggle?.(true)
        }
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`
        ${sizes[size]}
        flex items-center justify-center
        rounded-full
        border-2
        transition-all
        disabled:opacity-50
        ${isInWishlist 
          ? 'bg-red-500 border-red-500 text-white hover:bg-red-600' 
          : 'bg-white border-gray-300 text-gray-600 hover:border-red-500 hover:text-red-500'
        }
      `}
      aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart
        size={iconSizes[size]}
        fill={isInWishlist ? 'currentColor' : 'none'}
        strokeWidth={2}
      />
    </button>
  )
}
