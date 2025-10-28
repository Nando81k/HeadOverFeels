'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useWishlistStore } from '@/lib/store/wishlist'

interface WishlistIconProps {
  customerId?: string
  size?: number
}

export function WishlistIcon({ size = 24 }: WishlistIconProps) {
  const { items, loadWishlist, isLoaded } = useWishlistStore()

  // Load wishlist on mount if not already loaded
  useEffect(() => {
    if (!isLoaded) {
      loadWishlist()
    }
  }, [isLoaded, loadWishlist])

  const count = items.length

  return (
    <Link
      href="/wishlist"
      className="relative group transition-all duration-200 hover:scale-110"
      aria-label={`Wishlist (${count} items)`}
    >
      <div className="relative">
        <Image
          src="/assets/wishlist-icon.png"
          alt="Wishlist"
          width={size}
          height={size}
          className="object-contain brightness-0 transition-all duration-200"
        />
        <Image
          src="/assets/wishlist-icon.png"
          alt="Wishlist"
          width={size}
          height={size}
          className="object-contain brightness-0 absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            filter: 'brightness(0) saturate(100%) invert(21%) sepia(89%) saturate(7426%) hue-rotate(357deg) brightness(94%) contrast(119%)'
          }}
        />
      </div>
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-[#2B2B2B] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center group-hover:bg-red-500 transition-colors duration-200">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
