'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Fire, Clock } from '@phosphor-icons/react';

interface DropHeroProps {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price: number;
    compareAtPrice?: number | null;
    images: string[];
    releaseDate?: Date | null;
    dropEndDate?: Date | null;
    maxQuantity?: number | null;
    variants: Array<{
      inventory: number;
    }>;
  };
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function DropHeroSection({ product }: DropHeroProps) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isDropLive, setIsDropLive] = useState(false);

  // Helpers
  const getFirstImageUrl = (images: Array<string | { url?: string }> | undefined) => {
    if (!images || images.length === 0) return null
    const first = images[0]
    if (!first) return null
    if (typeof first === 'string') return first.trim() || null
    if (typeof first === 'object' && first.url) return first.url.trim() || null
    return null
  }

  const heroImage = getFirstImageUrl(product.images)
  
  // Calculate total inventory and sold count
  const totalInventory = product.variants.reduce((sum, v) => sum + v.inventory, 0);
  const maxQty = product.maxQuantity || totalInventory;
  const soldCount = maxQty - totalInventory;
  const soldPercentage = maxQty > 0 ? Math.min(100, Math.max(0, Math.round((soldCount / maxQty) * 100))) : 0;

  // Countdown timer logic
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const releaseTime = product.releaseDate ? new Date(product.releaseDate).getTime() : now;
      const endTime = product.dropEndDate ? new Date(product.dropEndDate).getTime() : 0;

      if (now >= releaseTime && now < endTime) {
        setIsDropLive(true);
        const difference = endTime - now;
        
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      } else if (now < releaseTime) {
        setIsDropLive(false);
        const difference = releaseTime - now;
        
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      }

      return null;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [product.releaseDate, product.dropEndDate]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/drop-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          productId: product.id,
          source: 'homepage',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }

      setSubscribed(true);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!timeLeft) {
    return null;
  }

  return (
    <section className="relative w-full overflow-hidden bg-black text-white">
      {/* Grain texture overlay - matching NeonHero */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Subtle top border accent */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Corner accents - matching site style */}
      <motion.div 
        className="absolute top-8 left-8 w-16 h-16 border-l border-t border-white/10 hidden md:block"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      />
      <motion.div 
        className="absolute bottom-8 right-8 w-16 h-16 border-r border-b border-white/10 hidden md:block"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-28">
        {/* Section Label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 sm:mb-12"
        >
          <span className="text-[10px] font-medium tracking-[0.3em] text-white/40 uppercase">
            Limited Edition Drop
          </span>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 items-center">
          
          {/* LEFT: Hero Content */}
          <div className="flex flex-col space-y-5 sm:space-y-8 order-2 lg:order-1">
            {/* Status Badge */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-2 w-fit"
            >
              {isDropLive ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20">
                  <Fire size={14} weight="fill" className="text-white animate-pulse" />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white">
                    Live Now
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10">
                  <Clock size={14} weight="bold" className="text-white/60" />
                  <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-white/60">
                    Coming Soon
                  </span>
                </div>
              )}
            </motion.div>

            {/* Main Headline - Giant Typography matching site style */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-1 sm:space-y-2"
            >
              <h1 className="text-3xl sm:text-[clamp(2.5rem,8vw,5rem)] font-black leading-[0.95] sm:leading-[0.9] tracking-tight text-white">
                {product.name.split(' ').slice(0, 2).join(' ')}
              </h1>
              <h2 className="text-xl sm:text-[clamp(1.5rem,4vw,2.5rem)] font-black leading-[0.95] sm:leading-[0.9] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white/60 via-white/40 to-white/20">
                {product.name.split(' ').slice(2).join(' ') || 'Limited Edition'}
              </h2>
            </motion.div>

            {/* Price Display */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex items-baseline gap-3 sm:gap-4"
            >
              <span className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                ${product.price.toFixed(2)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-base sm:text-xl text-white/30 line-through font-medium">
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </motion.div>

            {/* Description */}
            {product.description && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-sm text-white/50 leading-relaxed font-light max-w-sm"
              >
                {product.description.substring(0, 150)}
                {product.description.length > 150 ? '...' : ''}
              </motion.p>
            )}

            {/* Countdown Timer - Inline Style */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="space-y-2 sm:space-y-3"
            >
              <span className="text-[10px] font-medium tracking-[0.2em] text-white/40 uppercase">
                {isDropLive ? 'Ends In' : 'Drops In'}
              </span>
              <div className="flex gap-3 sm:gap-4">
                {[
                  { label: 'Days', value: timeLeft.days },
                  { label: 'Hrs', value: timeLeft.hours },
                  { label: 'Min', value: timeLeft.minutes },
                  { label: 'Sec', value: timeLeft.seconds },
                ].map((unit) => (
                  <div key={unit.label} className="text-center">
                    <p className="text-2xl sm:text-3xl md:text-4xl font-black text-white tabular-nums leading-none tracking-tight">
                      {String(unit.value).padStart(2, '0')}
                    </p>
                    <p className="text-[8px] sm:text-[9px] text-white/40 mt-1 sm:mt-1.5 font-medium uppercase tracking-wider">
                      {unit.label}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Stock Indicator */}
            {isDropLive && totalInventory > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                  <span className="text-white/40">{soldCount} Sold</span>
                  <span className="text-white/60 font-medium">{totalInventory} Left</span>
                </div>
                <div className="h-1 w-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${soldPercentage}%` }}
                    transition={{ duration: 1, delay: 0.8 }}
                    className="h-full bg-gradient-to-r from-white/80 to-white/40"
                  />
                </div>
              </motion.div>
            )}

            {/* CTA Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              {isDropLive ? (
                <Link href={`/products/${product.slug}`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="group flex items-center gap-4 px-8 py-4 bg-white text-black font-semibold text-sm uppercase tracking-wider transition-all duration-300"
                  >
                    <span>Shop Now</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" weight="bold" />
                  </motion.button>
                </Link>
              ) : (
                <form onSubmit={handleSubscribe} className="space-y-3">
                  <AnimatePresence mode="wait">
                    {!subscribed ? (
                      <motion.div
                        key="form"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-2"
                      >
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                            className="flex-1 px-5 py-4 bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:border-white/30 focus:outline-none transition-all"
                          />
                          <button
                            type="submit"
                            disabled={loading}
                            className="group flex items-center gap-3 px-6 py-4 bg-white text-black font-semibold text-sm uppercase tracking-wider hover:bg-white/90 transition-all disabled:opacity-50"
                          >
                            <span>{loading ? '...' : 'Notify'}</span>
                            <ArrowRight className="w-4 h-4" weight="bold" />
                          </button>
                        </div>
                        {error && (
                          <p className="text-xs text-white/50">
                            {error}
                          </p>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-sm text-white/70"
                      >
                        <span className="text-white">✓</span>
                        <span>You&apos;re on the list. Check your email.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              )}
            </motion.div>
          </div>

          {/* RIGHT: Product Image - Shows first on mobile */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative order-1 lg:order-2"
          >
            <div className="relative aspect-square sm:aspect-[4/5] w-full max-w-sm mx-auto lg:max-w-none overflow-hidden group">
              {heroImage ? (
                <Image
                  src={heroImage}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5" />
              )}
              
              {/* Limited Badge */}
              <div className="absolute top-0 right-0 z-20 px-4 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-[0.2em] border-l border-b border-white/20">
                Limited
              </div>

              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </section>
  );
}

