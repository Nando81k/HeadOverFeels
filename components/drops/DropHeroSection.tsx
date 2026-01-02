'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from '@phosphor-icons/react';

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
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-stretch">
          
          {/* LEFT: Hero Content - Bold Typography */}
          <div className="lg:col-span-2 flex flex-col justify-center space-y-8">
            {/* Status Indicator - Compact */}
            <div className="inline-flex items-center gap-1.5 w-fit">
              <div className={`w-2 h-2 rounded-full ${isDropLive ? 'bg-white animate-pulse' : 'bg-white/40'}`} />
              <span className="text-xs tracking-widest uppercase font-bold text-white/70">
                {isDropLive ? 'Live' : 'Incoming'}
              </span>
            </div>

            {/* Main Headline - Ultra Bold */}
            <div className="space-y-3">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-black logo-font leading-none text-white">
                Midnight
              </h1>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white/40 leading-none logo-font">
                Legend Hoodie [Limited Drop]
              </h2>
            </div>

            {/* Price - Bold Display */}
            <div className="flex items-baseline gap-3 text-5xl md:text-6xl font-black">
              <span className="text-white">${product.price.toFixed(2)}</span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-2xl md:text-3xl text-white/30 line-through">
                  ${product.compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Description - Minimal */}
            {product.description && (
              <p className="text-sm md:text-base text-white/60 leading-relaxed max-w-sm">
                {product.description.substring(0, 120)}
                {product.description.length > 120 ? '...' : ''}
              </p>
            )}

            {/* CTA Section */}
            {isDropLive ? (
              <Link href={`/products/${product.slug}`}>
                <button className="w-full md:w-auto group relative overflow-hidden">
                  <div className="relative px-8 md:px-12 py-5 md:py-6 bg-white text-black font-black text-base md:text-lg uppercase tracking-wider flex items-center gap-3 hover:gap-4 transition-all duration-300">
                    <span>Shop Now</span>
                    <ArrowRight size={20} weight="bold" />
                  </div>
                </button>
              </Link>
            ) : (
              <form onSubmit={handleSubscribe} className="w-full md:w-auto space-y-3">
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
                          placeholder="Your Email"
                          required
                          className="flex-1 px-4 py-3 md:py-4 bg-white/10 border border-white/20 rounded-none text-white placeholder:text-white/50 text-sm md:text-base font-medium focus:border-white/50 focus:outline-none transition-all"
                        />
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-6 md:px-8 py-3 md:py-4 bg-white text-black font-black text-sm md:text-base uppercase tracking-wider hover:bg-white/90 transition-all disabled:opacity-50"
                        >
                          {loading ? '...' : 'Go'}
                        </button>
                      </div>
                      {error && (
                        <p className="text-xs text-white/60 font-medium">
                          ⚠️ {error}
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-white/80"
                    >
                      ✨ Check Your Email
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            )}
          </div>

          {/* RIGHT: Visual Section - Image Focus */}
          <div className="lg:col-span-3 flex flex-col gap-8">
            
            {/* Main Product Image - Optimized Size */}
            <div className="relative h-full min-h-96 lg:min-h-[60vh]">
              <div className="relative w-full h-full bg-white/5 border border-white/10 overflow-hidden group">
                {heroImage ? (
                  <Image
                    src={heroImage}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-1000"
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-white/10 to-white/5" />
                )}
                
                {/* Limited Badge - Corner */}
                <div className="absolute top-0 right-0 z-20 px-4 py-2 bg-black text-white text-xs font-black uppercase tracking-widest border-l border-b border-white/20">
                  Limited
                </div>
              </div>
            </div>

            {/* Countdown - Bottom Card */}
            <div className="bg-white/5 border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-white/70">
                  {isDropLive ? '🔥 Ends' : '⏰ Starts'}
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'D', value: timeLeft.days },
                  { label: 'H', value: timeLeft.hours },
                  { label: 'M', value: timeLeft.minutes },
                  { label: 'S', value: timeLeft.seconds },
                ].map((unit) => (
                  <div key={unit.label} className="text-center">
                    <p className="text-2xl font-black text-white tabular-nums leading-none">
                      {String(unit.value).padStart(2, '0')}
                    </p>
                    <p className="text-[9px] text-white/60 mt-1 font-bold uppercase">
                      {unit.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

