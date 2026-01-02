'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Heart } from '@phosphor-icons/react'
import { useWishlistStore } from '@/lib/store/wishlist'

interface WishlistIconProps {
  customerId?: string
}

export function WishlistIcon({}: WishlistIconProps = {}) {
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
      className="relative p-2.5 rounded-full text-black/70 hover:text-black hover:bg-black/5 transition-all duration-200"
      aria-label={`Wishlist (${count} items)`}
    >
      <Heart size={20} weight={count > 0 ? 'fill' : 'bold'} />
      {count > 0 && (
        <span className="absolute top-0.5 right-0.5 bg-black text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
