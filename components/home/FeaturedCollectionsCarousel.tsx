'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  category?: {
    name: string;
  };
}

interface FeaturedCollectionsCarouselProps {
  products: Product[];
}

export function FeaturedCollectionsCarousel({ products }: FeaturedCollectionsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const slideVariants = {
    enter: {
      opacity: 0,
      scale: 1.05,
    },
    center: {
      zIndex: 1,
      opacity: 1,
      scale: 1,
    },
    exit: {
      zIndex: 0,
      opacity: 0,
      scale: 1,
    },
  };

  const contentVariants = {
    enter: {
      opacity: 0,
      y: 30,
    },
    center: {
      opacity: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      y: -30,
    },
  };

  const paginate = useCallback((newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prevIndex) => {
      if (newDirection === 1) {
        return (prevIndex + 1) % products.length;
      } else {
        return (prevIndex - 1 + products.length) % products.length;
      }
    });
  }, [products.length]);

  // Auto-play functionality
  useEffect(() => {
    if (isPaused || products.length <= 1) return;

    const interval = setInterval(() => {
      paginate(1);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [isPaused, paginate, products.length]);

  if (!products || products.length === 0) {
    return null;
  }

  const currentProduct = products[currentIndex];
  
  // Handle both string URLs and objects with url property, and filter out empty strings
  const getImageUrl = (images: string[] | Array<{ url?: string } | string>) => {
    if (!images || images.length === 0) return '/placeholder-product.jpg';
    
    const firstImage = images[0];
    if (typeof firstImage === 'string') {
      return firstImage || '/placeholder-product.jpg';
    }
    if (typeof firstImage === 'object' && firstImage?.url) {
      return firstImage.url || '/placeholder-product.jpg';
    }
    return '/placeholder-product.jpg';
  };
  
  const imageUrl = getImageUrl(currentProduct.images);

  return (
    <section 
      className="relative w-full h-screen min-h-[800px] overflow-hidden bg-[#F6F1EE]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Image with Overlay - Split Layout */}
      <div className="absolute inset-0 grid grid-cols-1 lg:grid-cols-2">
        {/* Image Side */}
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: 0.6,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="absolute inset-0 lg:relative"
          >
            <div className="relative h-full w-full lg:w-full">
              <Image
                src={imageUrl}
                alt={currentProduct.name}
                fill
                className="object-cover object-center"
                priority={currentIndex === 0}
                quality={90}
              />
            </div>
            {/* Dark overlay for better text readability on mobile */}
            <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/60 to-black/40 lg:bg-linear-to-r lg:from-transparent lg:via-black/20 lg:to-black/80" />
          </motion.div>
        </AnimatePresence>

        {/* Content Side - Always visible on right */}
        <div className="relative z-10 flex flex-col justify-center h-full px-6 lg:px-12 py-20">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`content-${currentIndex}`}
              variants={contentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: 0.5,
                ease: [0.4, 0, 0.2, 1],
              }}
              className="max-w-xl"
            >
              {/* Featured Badge */}
              <div className="mb-4">
                <span className="inline-block bg-[#CDA09B] text-white px-6 py-2 rounded-full font-bold text-xs tracking-widest uppercase">
                  Featured
                </span>
              </div>

              {/* Category */}
              {currentProduct.category && (
                <p className="text-[#1A1A1A]/70 text-sm uppercase tracking-widest mb-3">
                  {currentProduct.category.name}
                </p>
              )}

              {/* Product Name */}
              <h2 className="text-4xl lg:text-6xl font-bold text-[#1A1A1A] mb-4 leading-tight">
                {currentProduct.name}
              </h2>

              {/* Description */}
              {currentProduct.description && (
                <p className="text-[#1A1A1A]/80 text-base lg:text-lg mb-6 leading-relaxed line-clamp-2">
                  {currentProduct.description}
                </p>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-3xl lg:text-4xl font-bold text-[#1A1A1A]">
                  ${currentProduct.price.toFixed(2)}
                </span>
                {currentProduct.compareAtPrice && currentProduct.compareAtPrice > currentProduct.price && (
                  <span className="text-lg lg:text-xl text-[#1A1A1A]/50 line-through">
                    ${currentProduct.compareAtPrice.toFixed(2)}
                  </span>
                )}
              </div>

              {/* CTA Button */}
              <Link
                href={`/products/${currentProduct.slug}`}
                className="inline-block bg-[#1A1A1A] text-white px-8 py-4 rounded-lg font-bold text-base uppercase tracking-widest hover:bg-[#FF3131] transition-all duration-300 hover:scale-105"
              >
                Shop Now
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Arrows */}
      <div className="absolute bottom-8 right-8 z-20 flex gap-4">
        <button
          onClick={() => paginate(-1)}
          className="bg-[#1A1A1A]/10 backdrop-blur-sm text-[#1A1A1A] p-3 rounded-full hover:bg-[#1A1A1A] hover:text-white transition-all duration-300 hover:scale-110"
          aria-label="Previous product"
        >
          <CaretLeft size={24} weight="bold" />
        </button>
        <button
          onClick={() => paginate(1)}
          className="bg-[#1A1A1A]/10 backdrop-blur-sm text-[#1A1A1A] p-3 rounded-full hover:bg-[#1A1A1A] hover:text-white transition-all duration-300 hover:scale-110"
          aria-label="Next product"
        >
          <CaretRight size={24} weight="bold" />
        </button>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex gap-2">
        {products.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setDirection(index > currentIndex ? 1 : -1);
              setCurrentIndex(index);
            }}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'w-8 bg-[#1A1A1A]'
                : 'w-2 bg-[#1A1A1A]/40 hover:bg-[#1A1A1A]/70'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
