'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Clock, TrendUp, X, SquaresFour, Fire } from '@phosphor-icons/react'
import { Category } from './useSearch'
import { Product } from '@/lib/api/products'

interface SearchSuggestionsProps {
  recentSearches: string[]
  trendingSearches: string[]
  categories: Category[]
  featuredProducts: Product[]
  onSearchClick: (search: string) => void
  onRemoveRecent: (search: string) => void
  onClearRecent: () => void
  onClose: () => void
}

export function SearchSuggestions({
  recentSearches,
  trendingSearches,
  categories,
  featuredProducts,
  onSearchClick,
  onRemoveRecent,
  onClearRecent,
  onClose,
}: SearchSuggestionsProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12"
    >
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-black/40" weight="bold" />
              <h3 className="text-xs font-medium tracking-widest uppercase text-black/50">
                Recent
              </h3>
            </div>
            <button
              onClick={onClearRecent}
              className="text-xs text-black/40 hover:text-black transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1">
            {recentSearches.map((search) => (
              <div
                key={search}
                className="group flex items-center justify-between"
              >
                <button
                  onClick={() => onSearchClick(search)}
                  className="text-left text-sm text-black/70 hover:text-black transition-colors py-1.5"
                >
                  {search}
                </button>
                <button
                  onClick={() => onRemoveRecent(search)}
                  className="p-1 text-black/30 hover:text-black opacity-0 group-hover:opacity-100 transition-all"
                  aria-label={`Remove ${search} from recent searches`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Trending Searches */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendUp size={16} className="text-black/40" weight="bold" />
          <h3 className="text-xs font-medium tracking-widest uppercase text-black/50">
            Trending
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {trendingSearches.map((search) => (
            <button
              key={search}
              onClick={() => onSearchClick(search)}
              className="px-4 py-2 bg-black/5 hover:bg-black hover:text-white text-sm text-black/70 rounded-full transition-all duration-200"
            >
              {search}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Categories */}
      {categories.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="flex items-center gap-2">
            <SquaresFour size={16} className="text-black/40" weight="bold" />
            <h3 className="text-xs font-medium tracking-widest uppercase text-black/50">
              Categories
            </h3>
          </div>
          <div className="space-y-1">
            {categories.slice(0, 6).map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                onClick={onClose}
                className="block text-sm text-black/70 hover:text-black transition-colors py-1.5"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <motion.div variants={itemVariants} className="md:col-span-3 space-y-4 mt-8 pt-8 border-t border-black/10">
          <div className="flex items-center gap-2">
            <Fire size={16} className="text-amber-500" weight="fill" />
            <h3 className="text-xs font-medium tracking-widest uppercase text-black/50">
              Popular Products
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {featuredProducts.slice(0, 6).map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                onClick={onClose}
                className="group"
              >
                <div className="aspect-square rounded-2xl bg-black/5 overflow-hidden mb-2 relative">
                  {product.images?.[0] ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-black/20">
                      <SquaresFour size={24} />
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-black/80 group-hover:text-black truncate">
                  {product.name}
                </p>
                <p className="text-xs text-black/50">
                  ${product.price.toFixed(2)}
                </p>
              </Link>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
