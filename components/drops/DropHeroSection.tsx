'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface DropHeroProps {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string;
    price: number;
    compareAtPrice?: number;
    images: string[];
    releaseDate?: Date;
    dropEndDate?: Date;
    maxQuantity?: number;
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

  // Countdown timer logic
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const releaseTime = product.releaseDate ? new Date(product.releaseDate).getTime() : now;
      const endTime = product.dropEndDate ? new Date(product.dropEndDate).getTime() : 0;

      // Check if drop is live
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
        // Drop hasn't started yet
        setIsDropLive(false);
        const difference = releaseTime - now;
        
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        };
      }

      return null; // Drop has ended
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
    return null; // Drop has ended
  }

  return (
    <section className="relative bg-[#000000] rounded-2xl overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-0">
        {/* Left side - Product image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative aspect-square lg:aspect-auto lg:min-h-[600px]"
        >
          {product.images && product.images.length > 0 ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-linear-to-br from-[#FF3131] to-[#CDA09B] flex items-center justify-center">
              <span className="text-6xl animate-pulse">🔥</span>
            </div>
          )}
          
          {/* Limited edition badge */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-6 left-6"
          >
            <div className="bg-[#FF3131] text-white px-6 py-2 rounded-full font-bold text-xs tracking-widest uppercase shadow-lg animate-pulse">
              Limited Edition
            </div>
          </motion.div>
        </motion.div>

        {/* Right side - Drop info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col justify-center p-8 lg:p-16 text-white"
        >
          <div className="space-y-6">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm font-semibold text-[#FF3131] tracking-widest uppercase mb-3"
              >
                {isDropLive ? '🔴 Live Now' : '⏰ Coming Soon'}
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 leading-tight text-white"
              >
                {product.name}
              </motion.h1>
              {product.description && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-lg text-white/80 leading-relaxed"
                >
                  {product.description}
                </motion.p>
              )}
            </div>

            {/* Countdown timer */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white/5 backdrop-blur-sm border border-[#CDA09B]/30 rounded-xl p-6"
            >
              <p className="text-sm text-white/60 mb-4 uppercase tracking-wide">
                {isDropLive ? 'Drop ends in' : 'Drops in'}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Days', value: timeLeft.days },
                  { label: 'Hours', value: timeLeft.hours },
                  { label: 'Minutes', value: timeLeft.minutes },
                  { label: 'Seconds', value: timeLeft.seconds },
                ].map((unit) => (
                  <div key={unit.label} className="text-center">
                    <motion.div
                      key={`${unit.label}-${unit.value}`}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                      className="bg-[#FF3131] rounded-lg p-3 mb-2 shadow-lg"
                    >
                      <span className="text-2xl sm:text-3xl font-bold text-white">
                        {String(unit.value).padStart(2, '0')}
                      </span>
                    </motion.div>
                    <span className="text-xs text-white/60 font-medium uppercase tracking-wide">
                      {unit.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Price */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex items-baseline gap-4"
            >
              <span className="text-5xl font-bold text-[#FF3131]">${product.price}</span>
              {product.compareAtPrice && (
                <span className="text-2xl text-white/40 line-through">
                  ${product.compareAtPrice}
                </span>
              )}
            </motion.div>

            {/* CTA Section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="space-y-4 pt-4"
            >
              {isDropLive ? (
                <Link
                  href={`/products/${product.slug}`}
                  className="block w-full"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-[#FF3131] hover:bg-[#FF3131]/90 text-white text-lg font-bold py-5 px-8 rounded-xl transition-colors uppercase tracking-wide shadow-lg hover:shadow-xl"
                  >
                    Shop Now →
                  </motion.button>
                </Link>
              ) : (
                <AnimatePresence mode="wait">
                  {subscribed ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-[#CDA09B]/20 border border-[#CDA09B] rounded-xl p-6 text-center"
                    >
                      <p className="text-white font-semibold text-lg">
                        ✓ You&apos;re on the list! We&apos;ll notify you when this drop goes live.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onSubmit={handleSubscribe}
                      className="space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          required
                          disabled={loading}
                          className="flex-1 px-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF3131] disabled:opacity-50 transition-all"
                        />
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={loading}
                          className="px-8 py-4 bg-[#FF3131] hover:bg-[#FF3131]/90 text-white font-bold rounded-xl transition-colors disabled:opacity-50 uppercase tracking-wide shadow-lg"
                        >
                          {loading ? 'Joining...' : 'Notify Me'}
                        </motion.button>
                      </div>
                      {error && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-[#FF3131] text-sm"
                        >
                          {error}
                        </motion.p>
                      )}
                      <p className="text-white/60 text-sm text-center">
                        Be the first to know when this exclusive drop launches
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
