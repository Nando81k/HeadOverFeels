'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/lib/store/cart'
import { useAuth } from '@/lib/auth/context'
import { WishlistIcon } from '@/components/wishlist/WishlistIcon'
import { SearchModal } from '@/components/search'
import { ShoppingCart, MagnifyingGlass, User, List, X, Medal } from '@phosphor-icons/react'

export function Navigation() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showNav, setShowNav] = useState(true)
  const [userPoints, setUserPoints] = useState<number | null>(null)
  const cartItemCount = useCartStore(state => mounted ? state.getTotalItems() : 0)
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  // Keyboard shortcut: Cmd/Ctrl + K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    let lastScroll = 0
    let ticking = false

    const onScroll = () => {
      const current = window.scrollY || 0

      if (mobileMenuOpen) {
        setShowNav(true)
        lastScroll = current
        return
      }

      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (current > lastScroll && current > 80) {
            setShowNav(false)
          } else {
            setShowNav(true)
          }
          lastScroll = current
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [mobileMenuOpen])

  const fetchUserPoints = useCallback(async () => {
    try {
      const response = await fetch('/api/loyalty/me')
      if (response.ok) {
        const data = await response.json()
        setUserPoints(data.points)
      }
    } catch (error) {
      console.error('Failed to fetch user points:', error)
    }
  }, [])

  useEffect(() => {
    if (user && mounted) {
      void fetchUserPoints()
    }
  }, [user, mounted, fetchUserPoints])

  const navLinks = [
    { href: '/products', label: 'Shop' },
    { href: '/collections', label: 'Collections' },
    { href: '/about', label: 'About' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <>
      <nav 
        className={`bg-white/95 backdrop-blur-md fixed top-0 left-0 right-0 z-50 transform transition-transform duration-300 ${showNav ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-20">
          
            {/* Left - Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium tracking-wide transition-colors duration-200 ${
                  isActive(link.href)
                    ? 'text-black'
                    : 'text-black/60 hover:text-black'
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="block h-0.5 bg-black mt-0.5 rounded-full" />
                )}
              </Link>
            ))}
          </div>

          {/* Center - Logo */}
          <Link 
            href="/" 
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 transition-all duration-300 hover:opacity-80"
          >
            <Image
              src="/assets/head-over-feels-logo.png"
              alt="Head Over Feels Logo"
              width={100}
              height={100}
              className="object-contain hidden sm:block"
            />
            <span 
              className="text-2xl sm:text-3xl md:text-4xl text-[#1A1A1A]" 
              style={{ 
                fontFamily: "'Harlow Solid Italic', 'Harlow', sans-serif",
                WebkitTextStroke: '2px #1A1A1A',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Head Over Feels
            </span>
            <Image
              src="/assets/head-over-feels-logo.png"
              alt="Head Over Feels Logo"
              width={100}
              height={100}
              className="object-contain hidden sm:block"
            />
          </Link>

          {/* Right - Icons */}
          <div className="flex items-center gap-1">
            {/* Rewards - Compact */}
            {user && userPoints !== null && (
              <Link
                href="/loyalty/rewards"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-black/70 hover:text-black hover:bg-black/5 transition-all duration-200"
                title="View Rewards"
              >
                <Medal size={18} weight="fill" />
                <span className="text-sm font-semibold">{userPoints.toLocaleString()}</span>
              </Link>
            )}
            
            {/* Search */}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2.5 rounded-full text-black/70 hover:text-black hover:bg-black/5 transition-all duration-200"
              aria-label="Search"
            >
              <MagnifyingGlass size={20} weight="bold" />
            </button>
            
            {/* Profile */}
            {!authLoading && (
              <Link
                href={user ? "/profile" : "/signin"}
                className="hidden md:flex p-2.5 rounded-full text-black/70 hover:text-black hover:bg-black/5 transition-all duration-200"
                aria-label={user ? "Profile" : "Sign In"}
              >
                <User size={20} weight="bold" />
              </Link>
            )}

            {/* Wishlist */}
            <WishlistIcon />
            
            {/* Cart */}
            <Link
              href="/cart"
              className="relative p-2.5 rounded-full text-black/70 hover:text-black hover:bg-black/5 transition-all duration-200"
              aria-label="Shopping cart"
            >
              <ShoppingCart size={20} weight="bold" />
              {cartItemCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-black text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {cartItemCount > 9 ? '9+' : cartItemCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-full text-black/70 hover:text-black hover:bg-black/5 transition-all duration-200"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-black/5 overflow-hidden"
          >
            <div className="px-4 py-6 space-y-1">
              {/* Rewards - Mobile */}
              {user && userPoints !== null && (
                <Link
                  href="/loyalty/rewards"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-black/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Medal size={20} weight="fill" className="text-black" />
                    <span className="text-sm font-medium text-black/60">Rewards</span>
                  </div>
                  <span className="text-sm font-bold text-black">{userPoints.toLocaleString()} pts</span>
                </Link>
              )}
              
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-black text-white'
                      : 'text-black hover:bg-black/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              
              {!authLoading && (
                <Link
                  href={user ? "/profile" : "/signin"}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-base font-medium text-black hover:bg-black/5 transition-colors"
                >
                  {user ? 'Profile' : 'Sign In'}
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
    
    {/* Search Modal */}
    <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
