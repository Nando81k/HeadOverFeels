'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react';

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

interface BestSellersCarouselProps {
  products: Product[];
}

export function BestSellersCarousel({ products }: BestSellersCarouselProps) {
  const getImageUrl = (images: string[] | Array<{ url?: string } | string>) => {
    if (!images || images.length === 0) return '/placeholder-product.jpg';
    const validImages = images.filter(img => {
      if (typeof img === 'string') return img.trim().length > 0;
      if (typeof img === 'object' && img?.url) return img.url.trim().length > 0;
      return false;
    });
    if (validImages.length === 0) return '/placeholder-product.jpg';
    const firstImage = validImages[0];
    if (typeof firstImage === 'string') return firstImage;
    if (typeof firstImage === 'object' && firstImage?.url) return firstImage.url;
    return '/placeholder-product.jpg';
  };

  if (!products || products.length === 0) return null;

  const displayProducts = products.slice(0, 8);

  return (
    <section className="relative py-32 bg-neutral-50 overflow-hidden">
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(black 1px, transparent 1px), linear-gradient(90deg, black 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section Header - Editorial Style */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-20">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-[10px] font-medium tracking-[0.3em] text-black/40 uppercase block mb-4"
            >
              Curated Selection
            </motion.span>
            
            <motion.h2
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(2.5rem,8vw,5rem)] font-black leading-[0.9] tracking-tight text-black"
            >
              BEST
              <br />
              SELLERS
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-sm text-black/50 max-w-xs font-light leading-relaxed lg:pb-2"
          >
            The pieces our community keeps coming back to. Loved for their quality, comfort, and timeless design.
          </motion.p>
        </div>

        {/* Product Grid - Modern Magazine Layout */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 mb-10 sm:mb-20">
          {displayProducts.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white"
            >
              <Link href={`/products/${product.slug}`}>
                <div className="group relative h-full flex flex-col">
                  {/* Image Container */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-neutral-100">
                    <Image
                      src={getImageUrl(product.images)}
                      alt={product.name}
                      fill
                      className="object-cover transition-all duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 25vw"
                    />
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
                    
                    {/* Quick view button - hidden on mobile */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileHover={{ opacity: 1, y: 0 }}
                      className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden sm:block"
                    >
                      <div className="bg-white px-3 sm:px-4 py-2 sm:py-3 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-center">
                        Quick View
                      </div>
                    </motion.div>

                    {/* Index number */}
                    <div className="absolute top-2 sm:top-4 left-2 sm:left-4">
                      <span className="text-[9px] sm:text-[10px] font-medium tracking-wider text-black/30">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    </div>

                    {/* Best seller badge */}
                    {idx === 0 && (
                      <div className="absolute top-2 sm:top-4 right-2 sm:right-4">
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-black text-white text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">
                          Top Pick
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3 sm:p-6 flex-1 flex flex-col">
                    {/* Category - hidden on mobile for cleaner look */}
                    {product.category && (
                      <span className="hidden sm:block text-[10px] font-medium tracking-[0.2em] text-black/40 uppercase mb-2">
                        {product.category.name}
                      </span>
                    )}
                    
                    <h3 className="text-xs sm:text-base font-bold text-black mb-1 sm:mb-2 line-clamp-1 group-hover:underline underline-offset-4">
                      {product.name}
                    </h3>
                    
                    {/* Description hidden on mobile */}
                    {product.description && (
                      <p className="hidden sm:block text-xs text-black/50 mb-4 line-clamp-2 flex-1 font-light leading-relaxed">
                        {product.description}
                      </p>
                    )}

                    {/* Price & CTA Row */}
                    <div className="flex items-center justify-between pt-2 sm:pt-4 border-t border-black/5">
                      <div className="flex items-baseline gap-1 sm:gap-2">
                        <span className="text-sm sm:text-lg font-bold text-black">
                          ${product.price.toFixed(0)}
                        </span>
                        {product.compareAtPrice && product.compareAtPrice > product.price && (
                          <span className="text-[10px] sm:text-xs text-black/30 line-through">
                            ${product.compareAtPrice.toFixed(0)}
                          </span>
                        )}
                      </div>

                      <ArrowUpRight 
                        className="w-3 h-3 sm:w-4 sm:h-4 text-black/30 group-hover:text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" 
                        weight="bold" 
                      />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* View All CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center"
        >
          <Link href="/products">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center gap-6 px-8 py-4 bg-black text-white font-semibold text-sm uppercase tracking-wider transition-all duration-300"
            >
              <span>View All Products</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" weight="bold" />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
