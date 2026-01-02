'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { useRef } from 'react';
import { ArrowRight, ArrowDown } from '@phosphor-icons/react';

export default function NeonHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start']
  });

  const textY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section 
      ref={containerRef}
      className="relative min-h-[115svh] flex flex-col justify-between overflow-hidden bg-black -mt-24"
    >
      {/* Grain overlay for texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Subtle gradient accent */}
      <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Animated corner accents */}
      <motion.div 
        className="absolute top-24 left-8 w-24 h-24 border-l border-t border-white/10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
      />
      <motion.div 
        className="absolute top-24 right-8 w-24 h-24 border-r border-t border-white/10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.6 }}
      />

      {/* Main Content */}
      <motion.div 
        style={{ y: textY, opacity }}
        className="relative z-10 flex-1 flex items-center justify-center px-6"
      >
        <div className="max-w-7xl mx-auto w-full pt-24">
          {/* Minimal top label */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-8"
          >
            <span className="text-[10px] font-medium tracking-[0.3em] text-white/40 uppercase">
              Streetwear for the Soul
            </span>
          </motion.div>

          {/* Giant Typography - The Hero */}
          <div className="relative mb-12">
            <motion.h1
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(3.5rem,15vw,12rem)] font-black leading-[0.85] tracking-tighter text-white"
            >
              HEAD
            </motion.h1>
            <motion.h1
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(3.5rem,15vw,12rem)] font-black leading-[0.85] tracking-tighter text-white"
            >
              OVER
            </motion.h1>
            <motion.h1
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(3.5rem,15vw,12rem)] font-black leading-[0.85] tracking-tighter text-transparent bg-clip-text bg-linear-to-r from-white via-white/80 to-white/60"
            >
              FEELS
            </motion.h1>

            {/* Floating descriptor - positioned absolutely */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block max-w-xs"
            >
              <p className="text-sm text-white/50 leading-relaxed font-light">
                Thoughtfully designed streetwear that honors mental wellness and authentic self-expression.
              </p>
            </motion.div>
          </div>

          {/* Mobile description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="lg:hidden text-sm text-white/50 leading-relaxed font-light max-w-sm mb-12"
          >
            Thoughtfully designed streetwear that honors mental wellness and authentic self-expression.
          </motion.p>

          {/* CTA Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex flex-col sm:flex-row gap-4 sm:items-center"
          >
            <Link href="/products">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group flex items-center gap-4 px-8 py-4 bg-white text-black font-semibold text-sm uppercase tracking-wider transition-all duration-300"
              >
                <span>Shop Collection</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" weight="bold" />
              </motion.button>
            </Link>
            <Link href="/about" className="text-white/60 hover:text-white text-sm font-medium transition-colors px-4 py-4 uppercase tracking-wider">
              Our Story
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom Section - Stats & Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="relative z-10 px-6 pb-12"
      >
        <div className="max-w-7xl mx-auto flex items-end justify-between">
          {/* Stats - Minimal */}
          <div className="hidden md:flex gap-16">
            {[
              { value: '10K+', label: 'Community' },
              { value: '4.9', label: 'Rating' },
              { value: '100%', label: 'Ethical' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.3 + idx * 0.1 }}
                className="space-y-1"
              >
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/40">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Scroll indicator */}
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-[10px] uppercase tracking-widest text-white/40">Scroll</span>
            <ArrowDown className="w-4 h-4 text-white/40" weight="bold" />
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-black to-transparent pointer-events-none" />
    </section>
  );
}