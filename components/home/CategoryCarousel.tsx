'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from '@phosphor-icons/react';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
}

interface CategoryCarouselProps {
  categories?: Category[];
}

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: '1',
    name: 'Hoodies',
    slug: 'hoodies',
    description: 'Premium streetwear hoodies',
    image: '/assets/Sweatshirt_hoodie_collection.png'
  },
  {
    id: '2',
    name: 'T-Shirts',
    slug: 'tshirts',
    description: 'Classic and limited edition tees',
    image: '/assets/Tee_tops_collection.png'
  },
  {
    id: '3',
    name: 'Accessories',
    slug: 'accessories',
    description: 'Complete your look',
    image: '/assets/Accessories.png'
  }
];

export function CategoryCarousel({ categories = DEFAULT_CATEGORIES }: CategoryCarouselProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <section className="relative py-16 md:py-32 bg-black overflow-hidden max-w-full overscroll-contain touch-pan-y">
      {/* Grain overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 overflow-hidden overscroll-contain">
        {/* Section Header - Asymmetric */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 md:gap-8 mb-8 md:mb-20">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-[9px] md:text-[10px] font-medium tracking-[0.3em] text-white/30 uppercase block mb-2 md:mb-4"
            >
              Categories
            </motion.span>
            
            <motion.h2
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(1.75rem,8vw,5rem)] font-black leading-[0.9] tracking-tight text-white"
            >
              SHOP BY
              <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-white via-white/80 to-white/60">
                CATEGORY
              </span>
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xs md:text-sm text-white/40 max-w-xs font-light leading-relaxed lg:pb-2 hidden md:block"
          >
            Find your perfect piece across our curated collections. Each category designed with intention.
          </motion.p>
        </div>

        {/* Category Grid - Modern Asymmetric */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 md:gap-4 mb-8 md:mb-16 touch-pan-y">
          {categories.map((category, idx) => {
            // First card spans 7 cols, second 5 cols, third full width but shorter
            const colSpan = idx === 0 ? 'lg:col-span-7' : idx === 1 ? 'lg:col-span-5' : 'lg:col-span-12';
            const height = idx === 2 ? 'h-[180px] md:h-[300px]' : 'h-[220px] md:h-[500px]';
            
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={colSpan}
              >
                <Link href={`/products?category=${category.slug}`}>
                  <div className={`group relative ${height} overflow-hidden bg-neutral-900`}>
                    {/* Image */}
                    <div className="relative h-full">
                      <Image
                        src={category.image || '/placeholder-product.jpg'}
                        alt={category.name}
                        fill
                        className="object-cover transition-all duration-700 group-hover:scale-105 grayscale group-hover:grayscale-0"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent opacity-80" />
                    </div>

                    {/* Corner accent */}
                    <div className="absolute top-2 right-2 md:top-4 md:right-4 w-8 h-8 md:w-12 md:h-12 border-r border-t border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Content */}
                    <div className="absolute inset-0 p-4 md:p-8 flex flex-col justify-end">
                      {/* Index */}
                      <span className="absolute top-3 left-4 md:top-6 md:left-6 text-[9px] md:text-[10px] font-medium tracking-wider text-white/30">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {/* Category Name */}
                      <motion.h3 
                        className="text-xl md:text-3xl lg:text-4xl font-black text-white mb-1 md:mb-2 tracking-tight"
                      >
                        {category.name.toUpperCase()}
                      </motion.h3>
                      
                      {/* Description - hidden on mobile */}
                      {category.description && (
                        <p className="hidden md:block text-white/50 text-sm font-light mb-6 max-w-md">
                          {category.description}
                        </p>
                      )}

                      {/* CTA */}
                      <div className="flex items-center gap-1.5 md:gap-2 text-white">
                        <span className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.15em] md:tracking-[0.2em]">Explore</span>
                        <ArrowUpRight 
                          className="w-3 h-3 md:w-4 md:h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" 
                          weight="bold" 
                        />
                      </div>
                    </div>

                    {/* Bottom line accent */}
                    <div className="absolute bottom-0 left-0 w-0 h-px bg-white group-hover:w-full transition-all duration-500" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
