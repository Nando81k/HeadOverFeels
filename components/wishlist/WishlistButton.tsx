'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useWishlistStore } from '@/lib/store/wishlist'

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
  onToggle
}: WishlistButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { isInWishlist, addToWishlist, removeFromWishlist, loadWishlist, isLoaded } = useWishlistStore()
  
  // Check if item is in wishlist
  const inWishlist = isInWishlist(productId, productVariantId)

  // Load wishlist on mount if not already loaded
  useEffect(() => {
    if (!isLoaded) {
      loadWishlist()
    }
  }, [isLoaded, loadWishlist])

  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  }

  const iconSizes = {
    sm: 32,
    md: 40,
    lg: 48
  }

  const handleToggle = async () => {
    setIsLoading(true)

    try {
      if (inWishlist) {
        // Remove from wishlist
        const success = await removeFromWishlist(productId, productVariantId)
        if (success) {
          onToggle?.(false)
        }
      } else {
        // Add to wishlist
        const success = await addToWishlist(productId, productVariantId, customerId)
        if (success) {
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
        group
        relative
        ${inWishlist 
          ? 'bg-red-500 border-red-500 hover:bg-red-600' 
          : 'bg-white border-gray-300 hover:border-red-500'
        }
      `}
      aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <div className="relative flex items-center justify-center w-full h-full">
        <Image
          src="/assets/wishlist-icon.png"
          alt="Wishlist"
          width={iconSizes[size]}
          height={iconSizes[size]}
          className={`object-contain transition-opacity duration-300 ${
            inWishlist 
              ? 'brightness-0 invert' 
              : 'brightness-0 group-hover:opacity-0'
          }`}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
        {!inWishlist && (
          <Image
            src="/assets/wishlist-icon.png"
            alt="Wishlist"
            width={iconSizes[size]}
            height={iconSizes[size]}
            className="object-contain absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              filter: 'brightness(0) saturate(100%) invert(27%) sepia(98%) saturate(7471%) hue-rotate(357deg) brightness(95%) contrast(118%)',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          />
        )}
      </div>
    </button>
  )
}
