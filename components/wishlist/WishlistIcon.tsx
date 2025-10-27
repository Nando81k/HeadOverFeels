'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'

interface WishlistIconProps {
  customerId?: string
}

export function WishlistIcon({ customerId }: WishlistIconProps) {
  const [count, setCount] = useState(0)

  const fetchWishlistCount = useCallback(async () => {
    try {
      const response = await fetch(`/api/wishlist?customerId=${customerId || ''}`)
      const { count: wishlistCount } = await response.json()
      setCount(wishlistCount || 0)
    } catch (error) {
      console.error('Error fetching wishlist count:', error)
    }
  }, [customerId])

  useEffect(() => {
    fetchWishlistCount()
  }, [fetchWishlistCount])

  return (
    <Link
      href="/wishlist"
      className="relative flex items-center justify-center h-10 w-10 rounded-full hover:bg-gray-100 transition-colors"
      aria-label={`Wishlist (${count} items)`}
    >
      <Heart size={24} strokeWidth={2} className="text-gray-700" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
