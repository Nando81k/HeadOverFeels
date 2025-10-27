'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useCartStore } from '@/lib/store/cart'
import { useAuth } from '@/lib/auth/context'
import { SearchBar } from '@/components/products/SearchBar'
import { WishlistIcon } from '@/components/wishlist/WishlistIcon'
import { ShoppingCart, Search, User, Menu, X, ChevronDown } from 'lucide-react'

export function Navigation() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const getTotalItems = useCartStore(state => state.getTotalItems)
  const { user, loading: authLoading } = useAuth()
  
  const cartItemCount = mounted ? getTotalItems() : 0

  useEffect(() => {
    setMounted(true)
  }, [])

  // Smart scroll behavior
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Don't hide if at top of page
      if (currentScrollY < 10) {
        setIsVisible(true)
        lastScrollY.current = currentScrollY
        return
      }

      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsVisible(false)
      } else if (currentScrollY < lastScrollY.current) {
        setIsVisible(true)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { href: '/products', label: 'Shop' },
    { href: '/collections', label: 'Collections' },
  ]

  const categories = [
    { name: 'Hoodies & Sweatshirts', href: '/products?category=hoodies' },
    { name: 'T-Shirts', href: '/products?category=tshirts' },
    { name: 'Jackets', href: '/products?category=jackets' },
    { name: 'Bottoms', href: '/products?category=bottoms' },
    { name: 'Accessories', href: '/products?category=accessories' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav 
      className={`border-b border-[#E5DDD5] bg-[#FAF8F5] fixed top-0 left-0 right-0 z-50 shadow-sm transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-24">
          {/* Left Navigation */}
          <div className="hidden md:flex items-center space-x-8 z-10">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-xs font-medium tracking-wider transition-all uppercase ${
                  isActive(link.href)
                    ? 'text-[#1A1A1A] font-semibold'
                    : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            
            {/* Categories Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => setCategoriesOpen(true)}
              onMouseLeave={() => setCategoriesOpen(false)}
            >
              <button
                className="text-xs font-medium tracking-wider transition-all uppercase text-[#6B6B6B] hover:text-[#1A1A1A] flex items-center gap-1"
              >
                Categories
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {categoriesOpen && (
                <div className="absolute top-full left-0 pt-2">
                  <div className="w-56 bg-[#FAF8F5] border border-[#E5DDD5] rounded-xl shadow-lg py-2">
                    {categories.map(category => (
                      <Link
                        key={category.href}
                        href={category.href}
                        className="block px-4 py-2.5 text-sm text-[#1A1A1A] hover:bg-[#F5F1EB] transition-colors"
                        onClick={() => setCategoriesOpen(false)}
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center Logo - Chanel Style */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity absolute left-1/2 transform -translate-x-1/2">
            <Image
              src="/assets/head-over-feels-logo.png"
              alt="Head Over Feels Logo"
              width={60}
              height={60}
              className="object-contain"
            />
            <span className="text-2xl md:text-3xl text-[#1A1A1A]" style={{ fontFamily: "'Harlow Solid Italic', 'Harlow', sans-serif" }}>
              Head Over Feels
            </span>
            <Image
              src="/assets/head-over-feels-logo.png"
              alt="Head Over Feels Logo"
              width={60}
              height={60}
              className="object-contain"
            />
          </Link>

          {/* Right side empty for spacing */}
          <div className="hidden md:flex items-center space-x-8 z-10">
          </div>

          {/* Icons */}
          <div className="flex items-center space-x-6 z-10">
            <button 
              onClick={() => setSearchOpen(!searchOpen)}
              className="text-[#1A1A1A] hover:opacity-70 transition-opacity"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            
            {/* Sign In / Profile Link */}
            {!authLoading && (
              <Link
                href={user ? "/profile" : "/signin"}
                className="text-[#1A1A1A] hover:opacity-70 transition-opacity hidden md:block"
                aria-label={user ? "Profile" : "Sign In"}
              >
                <User className="w-5 h-5" />
              </Link>
            )}

            {/* Wishlist Icon */}
            <WishlistIcon />
            
            <Link
              href="/cart"
              className="text-[#1A1A1A] hover:opacity-70 transition-opacity relative"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#2B2B2B] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[#1A1A1A] hover:opacity-70 transition-opacity"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-6 border-t border-[#E5DDD5]">
            <div className="flex flex-col space-y-5">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-base font-medium tracking-wide transition-all uppercase ${
                    isActive(link.href)
                      ? 'text-[#1A1A1A] font-semibold'
                      : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {!authLoading && (
                <Link
                  href={user ? "/profile" : "/signin"}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium tracking-wide text-[#6B6B6B] hover:text-[#1A1A1A] transition-all uppercase"
                >
                  {user ? 'Profile' : 'Sign In'}
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Search Bar Overlay */}
        {searchOpen && (
          <div className="py-6 border-t border-[#E5DDD5] bg-[#F5F1EB]">
            <SearchBar
              placeholder="Search for products..."
              onSearch={() => setSearchOpen(false)}
              autoFocus
            />
          </div>
        )}
      </div>
    </nav>
  )
}
