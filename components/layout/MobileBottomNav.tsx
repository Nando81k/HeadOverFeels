'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { House, Storefront, MagnifyingGlass, Heart, Bag } from '@phosphor-icons/react'
import { useCartStore } from '@/lib/store/cart'
import { useWishlistStore } from '@/lib/store/wishlist'

interface MobileBottomNavProps {
  onSearchClick: () => void
}

export function MobileBottomNav({ onSearchClick }: MobileBottomNavProps) {
  const pathname = usePathname()
  // Defer pathname-driven active state until after mount so SSR markup
  // matches the initial client render and avoids hydration mismatches
  // when the prerendered pathname doesn't match the client's current URL.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const cartItems = useCartStore(s => s.items ?? [])
  const wishlistItems = useWishlistStore(s => s.items ?? [])
  // Suppress badge counts until mount — Zustand `persist` rehydrates from
  // localStorage on the client which would otherwise mismatch SSR (always 0).
  const cartCount = mounted ? cartItems.reduce((n, i) => n + i.quantity, 0) : 0
  const wishlistCount = mounted ? wishlistItems.length : 0

  if (mounted && pathname?.startsWith('/checkout')) return null

  const isHome = mounted && pathname === '/'
  const isShop = mounted && (pathname?.startsWith('/products') || pathname?.startsWith('/collections'))
  const isWishlist = mounted && pathname?.startsWith('/wishlist')
  const isCart = mounted && pathname === '/cart'

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-black/8 bg-white/95 backdrop-blur-xl supports-backdrop-filter:bg-white/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch">
        <Link
          href="/"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-14 transition-colors ${isHome ? 'text-black' : 'text-black/35 hover:text-black/70'}`}
          aria-current={isHome ? 'page' : undefined}
        >
          <House size={22} weight={isHome ? 'fill' : 'regular'} />
          <span className="text-[10px] font-semibold tracking-wide">Home</span>
        </Link>

        <Link
          href="/products"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-14 transition-colors ${isShop ? 'text-black' : 'text-black/35 hover:text-black/70'}`}
          aria-current={isShop ? 'page' : undefined}
        >
          <Storefront size={22} weight={isShop ? 'fill' : 'regular'} />
          <span className="text-[10px] font-semibold tracking-wide">Shop</span>
        </Link>

        <button
          onClick={onSearchClick}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-14 text-black/35 hover:text-black/70 transition-colors"
          aria-label="Open search"
        >
          <MagnifyingGlass size={22} weight="regular" />
          <span className="text-[10px] font-semibold tracking-wide">Search</span>
        </button>

        <Link
          href="/wishlist"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-14 transition-colors ${isWishlist ? 'text-black' : 'text-black/35 hover:text-black/70'}`}
          aria-current={isWishlist ? 'page' : undefined}
        >
          <span className="relative">
            <Heart size={22} weight={isWishlist ? 'fill' : 'regular'} />
            {wishlistCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[9px] font-bold leading-none text-white">
                {wishlistCount > 99 ? '99+' : wishlistCount}
              </span>
            )}
          </span>
          <span className="text-[10px] font-semibold tracking-wide">Wishlist</span>
        </Link>

        <Link
          href="/cart"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-14 transition-colors ${isCart ? 'text-black' : 'text-black/35 hover:text-black/70'}`}
          aria-current={isCart ? 'page' : undefined}
        >
          <span className="relative">
            <Bag size={22} weight={isCart ? 'fill' : 'regular'} />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[9px] font-bold leading-none text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </span>
          <span className="text-[10px] font-semibold tracking-wide">Cart</span>
        </Link>
      </div>
    </nav>
  )
}
