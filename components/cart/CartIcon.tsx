'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart'

export function CartIcon() {
  const totalItems = useCartStore(state => state.getTotalItems())

  return (
    <Link 
      href="/cart"
      className="relative text-gray-700 hover:text-black transition-colors"
    >
      <ShoppingCart className="w-6 h-6" />
      {totalItems > 0 && (
        <span className="absolute -top-2 -right-2 bg-black text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </Link>
  )
}
