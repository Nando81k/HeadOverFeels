'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Image from 'next/image';

const SECTIONS = [
  {
    tag: '01 / Materials',
    title: ['MINDFUL', 'MATERIALS'],
    description: 'Premium cotton blends and breathable fabrics crafted with intention. Every stitch honors comfort and quality.',
    features: ['100% Premium Cotton', 'Triple-Stitched Seams', 'Comfort-First Design'],
    image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1200&h=1600&fit=crop&q=80'
  },
  {
    tag: '02 / Design',
    title: ['THOUGHTFUL', 'DESIGN'],
    description: 'Clean silhouettes and versatile styles that adapt to your journey. From self-care days to creative moments.',
    features: ['Calming Aesthetic', 'Gentle Palettes', 'Inclusive Fits'],
    image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200&h=1600&fit=crop&q=80'
  },
  {
    tag: '03 / Releases',
    title: ['LIMITED', 'EDITIONS'],
    description: 'Each release is purposefully created. Own something meaningful that celebrates your unique story.',
    features: ['Purposeful Designs', 'Mindfully Limited', 'Meaningful Stories'],
    image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=1200&h=1600&fit=crop&q=80'
  },
  {
    tag: '04 / Values',
    title: ['CONSCIOUS', 'CHOICES'],
    description: 'Thoughtfully made with care for our planet. Sustainable practices that honor both you and the Earth.',
    features: ['Ethically Sourced', 'Eco-Friendly Packaging', 'Carbon-Neutral'],
    image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=1200&h=1600&fit=crop&q=80'
  }
];

// Separate component to use hooks properly
function ProgressBar({ scrollYProgress, threshold, endThreshold }: { 
  scrollYProgress: ReturnType<typeof useScroll>['scrollYProgress'], 
  threshold: number,
  endThreshold: number 
}) {
  const width = useTransform(
    scrollYProgress, 
    [threshold, endThreshold], 
    ['0%', '100%']
  );
  
  return (
    <motion.div 
      className="relative w-16 h-px bg-black/10 overflow-hidden"
    >
      <motion.div 
        className="absolute inset-y-0 left-0 bg-black"
        style={{ width }}
      />
    </motion.div>
  );
}

export function PinnedProductShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end']
  });

  // Opacity transitions - Extended ranges for longer visibility
  // Each section now has more "hold" time at full opacity before fading
  // Format: [fadeIn start, full opacity start, full opacity end, fadeOut end]
  const opacities = [
    // Section 1: Visible 0-22%, fade out 22-28%
    useTransform(scrollYProgress, [0, 0.05, 0.22, 0.28], [1, 1, 1, 0]),
    // Section 2: Fade in 22-28%, visible 28-47%, fade out 47-53%
    useTransform(scrollYProgress, [0.22, 0.28, 0.47, 0.53], [0, 1, 1, 0]),
    // Section 3: Fade in 47-53%, visible 53-72%, fade out 72-78%
    useTransform(scrollYProgress, [0.47, 0.53, 0.72, 0.78], [0, 1, 1, 0]),
    // Section 4: Fade in 72-78%, visible 78-100%
    useTransform(scrollYProgress, [0.72, 0.78, 0.95, 1], [0, 1, 1, 1])
  ];

  // Subtle scale with smoother transitions
  const scales = [
    useTransform(scrollYProgress, [0, 0.22, 0.28], [1, 1, 0.96]),
    useTransform(scrollYProgress, [0.22, 0.28, 0.47], [0.96, 1, 1]),
    useTransform(scrollYProgress, [0.47, 0.53, 0.72], [0.96, 1, 1]),
    useTransform(scrollYProgress, [0.72, 0.78, 1], [0.96, 1, 1])
  ];

  return (
    <section ref={containerRef} className="relative h-[500vh] bg-neutral-50">
      {/* Subtle grid pattern */}
      <div 
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(black 1px, transparent 1px), linear-gradient(90deg, black 1px, transparent 1px)`,
          backgroundSize: '80px 80px'
        }}
      />

      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        {SECTIONS.map((section, idx) => {
          const isReversed = idx % 2 === 1;
          
          return (
            <motion.div
              key={idx}
              style={{ opacity: opacities[idx] }}
              className="absolute inset-0 flex items-center justify-center px-6"
            >
              <div className="max-w-7xl mx-auto w-full">
                <div className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${isReversed ? '' : ''}`}>
                  {/* Image */}
                  <motion.div 
                    style={{ scale: scales[idx] }}
                    className={`relative h-[50vh] lg:h-[70vh] ${isReversed ? 'lg:order-2' : 'lg:order-1'}`}
                  >
                    <div className="relative h-full overflow-hidden bg-neutral-200">
                      <Image
                        src={section.image}
                        alt={section.title.join(' ')}
                        fill
                        className="object-cover grayscale hover:grayscale-0 transition-all duration-700"
                        priority={idx === 0}
                      />
                      {/* Image overlay gradient */}
                      <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
                    </div>
                    
                    {/* Corner accent */}
                    <div className="absolute -bottom-4 -right-4 w-32 h-32 border-r border-b border-black/10" />
                  </motion.div>

                  {/* Content */}
                  <div className={`space-y-8 ${isReversed ? 'lg:order-1' : 'lg:order-2'}`}>
                    {/* Tag */}
                    <span className="text-[10px] font-medium tracking-[0.3em] text-black/40 uppercase">
                      {section.tag}
                    </span>

                    {/* Title */}
                    <div>
                      {section.title.map((line, i) => (
                        <h2 
                          key={i}
                          className="text-[clamp(2.5rem,7vw,5rem)] font-black text-black leading-[0.9] tracking-tight"
                        >
                          {line}
                        </h2>
                      ))}
                    </div>

                    {/* Description */}
                    <p className="text-base text-black/50 font-light leading-relaxed max-w-md">
                      {section.description}
                    </p>

                    {/* Features */}
                    <div className="space-y-3 pt-4">
                      {section.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <div className="w-8 h-px bg-black/20" />
                          <span className="text-sm font-medium text-black/70">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Progress indicator - Minimal */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
          {[
            { start: 0, end: 0.25 },
            { start: 0.25, end: 0.5 },
            { start: 0.5, end: 0.75 },
            { start: 0.75, end: 1 }
          ].map((range, idx) => (
            <ProgressBar 
              key={idx} 
              scrollYProgress={scrollYProgress} 
              threshold={range.start}
              endThreshold={range.end}
            />
          ))}
        </div>

        {/* Section number */}
        <motion.div 
          className="absolute top-24 right-8 text-[10px] font-medium tracking-wider text-black/20"
        >
          <motion.span style={{ opacity: opacities[0] }} className="absolute">01</motion.span>
          <motion.span style={{ opacity: opacities[1] }} className="absolute">02</motion.span>
          <motion.span style={{ opacity: opacities[2] }} className="absolute">03</motion.span>
          <motion.span style={{ opacity: opacities[3] }} className="absolute">04</motion.span>
          <span className="opacity-0">00</span>
          <span className="text-black/10"> / 04</span>
        </motion.div>
      </div>
    </section>
  );
}
