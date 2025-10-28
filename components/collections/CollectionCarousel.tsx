'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '@/lib/api/products';

interface CollectionCarouselProps {
  products: Product[];
  itemsPerView?: 1 | 2;
}

export function CollectionCarousel({ products, itemsPerView = 2 }: CollectionCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Calculate how many slides we have based on itemsPerView
  const totalSlides = Math.ceil(products.length / itemsPerView);

  // Get current products for the slide
  const getCurrentProducts = () => {
    const startIndex = currentIndex * itemsPerView;
    return products.slice(startIndex, startIndex + itemsPerView);
  };

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

  const paginate = useCallback((newDirection: number) => {
    setCurrentIndex((prevIndex) => {
      if (newDirection === 1) {
        return (prevIndex + 1) % totalSlides;
      } else {
        return (prevIndex - 1 + totalSlides) % totalSlides;
      }
    });
  }, [totalSlides]);

  // Auto-play functionality
  useEffect(() => {
    if (isPaused || products.length <= itemsPerView || totalSlides <= 1) return;

    const interval = setInterval(() => {
      paginate(1);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, paginate, products.length, itemsPerView, totalSlides]);

  if (!products || products.length === 0) {
    return null;
  }

  const currentProducts = getCurrentProducts();

  // Handle images stored as JSON string with {url, alt} objects
  const getImageUrl = (images: string | string[] | Array<{ url?: string } | string> | undefined) => {
    // If it's undefined or null, return placeholder
    if (!images) return '/placeholder-product.jpg';
    
    // If it's a string, try to parse it as JSON
    if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const firstImage = parsed[0];
          
          // Handle object with url property (e.g., {url: "...", alt: "..."})
          if (typeof firstImage === 'object' && firstImage !== null && firstImage.url) {
            const url = firstImage.url;
            if (typeof url === 'string' && (url.startsWith('/') || url.startsWith('http'))) {
              return url;
            }
          }
          
          // Handle direct string in array
          if (typeof firstImage === 'string' && (firstImage.startsWith('/') || firstImage.startsWith('http'))) {
            return firstImage;
          }
        }
      } catch (error) {
        console.error('Error parsing images JSON:', error);
        // If parsing fails, check if it's a direct URL
        if (images.startsWith('/') || images.startsWith('http')) {
          return images;
        }
      }
      return '/placeholder-product.jpg';
    }
    
    // If it's already an array
    if (Array.isArray(images) && images.length > 0) {
      const firstImage = images[0];
      
      // Handle object with url property in array
      if (typeof firstImage === 'object' && firstImage !== null && 'url' in firstImage) {
        const url = firstImage.url;
        if (url && typeof url === 'string' && (url.startsWith('/') || url.startsWith('http'))) {
          return url;
        }
      }
      
      // Handle string type in array
      if (typeof firstImage === 'string') {
        if (firstImage && (firstImage.startsWith('/') || firstImage.startsWith('http'))) {
          return firstImage;
        }
      }
    }
    
    return '/placeholder-product.jpg';
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Carousel Container */}
      <section className="relative w-full h-[500px] lg:h-[600px] overflow-hidden bg-[#1A1A1A] rounded-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: 0.6,
              ease: [0.4, 0, 0.2, 1],
            }}
            className={`grid ${itemsPerView === 2 ? 'grid-cols-2' : 'grid-cols-1'} h-full`}
          >
            {currentProducts.map((product) => {
              const imageUrl = getImageUrl(product.images);
              
              // Debug logging
              if (process.env.NODE_ENV === 'development') {
                console.log('Product:', product.name);
                console.log('Images raw:', product.images);
                console.log('Resolved imageUrl:', imageUrl);
              }

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="relative group overflow-hidden"
                >
                  {/* Background Image */}
                  <div className="absolute inset-0">
                    <Image
                      src={imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                  </div>

                  {/* Product Info Overlay */}
                  <div className="relative h-full flex flex-col justify-end p-6 lg:p-8">
                    {/* Category Badge */}
                    {product.category && (
                      <span className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-[#FF3131] rounded-full mb-3 w-fit">
                        {typeof product.category === 'string' ? product.category : product.category.name}
                      </span>
                    )}

                    {/* Product Name */}
                    <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2 group-hover:text-[#FF3131] transition-colors duration-300">
                      {product.name}
                    </h3>

                    {/* Description */}
                    {product.description && (
                      <p className="text-white/80 text-sm lg:text-base mb-4 line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    {/* Price */}
                    <div className="flex items-baseline gap-3 mb-4">
                      <span className="text-2xl lg:text-3xl font-bold text-white">
                        ${product.price}
                      </span>
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <span className="text-lg text-white/60 line-through">
                          ${product.compareAtPrice}
                        </span>
                      )}
                    </div>

                    {/* Limited Edition Badge */}
                    {product.isLimitedEdition && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF3131] text-white rounded-lg text-sm font-medium w-fit">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        Limited Edition
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {totalSlides > 1 && (
          <>
            <button
              onClick={() => paginate(-1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-black hover:bg-[#FF3131] hover:text-white transition-all duration-300"
              aria-label="Previous products"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => paginate(1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-black hover:bg-[#FF3131] hover:text-white transition-all duration-300"
              aria-label="Next products"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </section>

      {/* Pagination Dots */}
      {totalSlides > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'w-8 bg-[#FF3131]'
                  : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Slide Counter */}
      {totalSlides > 1 && (
        <div className="text-center mt-4 text-sm text-gray-600">
          {currentIndex + 1} / {totalSlides}
        </div>
      )}
    </div>
  );
}
