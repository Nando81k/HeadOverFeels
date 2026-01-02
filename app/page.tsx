import Link from 'next/link'
import { Navigation } from '@/components/layout/Navigation'
import NeonHero from '@/components/home/NeonHero'
import { BestSellersCarousel } from '@/components/home/BestSellersCarousel'
import { CategoryCarousel } from '@/components/home/CategoryCarousel'
import { PinnedProductShowcase } from '@/components/home/PinnedProductShowcase'
import DropHeroSection from '@/components/drops/DropHeroSection'
import { getActiveDrop } from '@/lib/drops'
import { prisma } from '@/lib/prisma'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

// Force dynamic rendering (no prerendering during build)
export const dynamic = 'force-dynamic';

// Helper function to get best sellers
async function getBestSellers(limit: number = 6) {
  // Get products with most order items (completed orders only)
  const productSales = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        status: {
          in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
        }
      }
    },
    _sum: {
      quantity: true
    },
    orderBy: {
      _sum: {
        quantity: 'desc'
      }
    },
    take: limit
  })

  if (productSales.length === 0) {
    // If no sales yet, return featured products
    return prisma.product.findMany({
      where: {
        isActive: true,
        isFeatured: true
      },
      include: {
        variants: true,
        category: true
      },
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  // Get full product data for best sellers
  const productIds = productSales.map(sale => sale.productId)
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true
    },
    include: {
      variants: true,
      category: true
    }
  })

  // Sort products by sales order
  return productIds
    .map(id => products.find(p => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== null)
}

export default async function Home() {
  const bestSellers = await getBestSellers(8)
  const activeDrop = await getActiveDrop()

  // Type conversion helper to handle null -> undefined and parse JSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertProduct = (product: any) => {
    if (!product) return null;
    return {
      ...product,
      description: product.description ?? '',
      images: typeof product.images === 'string' ? JSON.parse(product.images) : product.images,
    };
  }

  // Convert products for components and filter out nulls
  const convertedBestSellers = bestSellers
    .map(convertProduct)
    .filter((p): p is NonNullable<typeof p> => p !== null)

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <NeonHero />

      {/* Limited Drop Section - Dynamically shows the active drop */}
      {activeDrop && (
        <div className="relative z-10">
          <DropHeroSection product={activeDrop} />
        </div>
      )}

      {/* Best Sellers */}
      {convertedBestSellers.length > 0 && (
        <BestSellersCarousel products={convertedBestSellers} />
      )}

      {/* Categories */}
      <CategoryCarousel />

      {/* Pinned Product Showcase */}
      <PinnedProductShowcase />

      {/* Newsletter Section - Modern Minimal */}
      <section className="relative py-32 bg-black overflow-hidden">
        {/* Grain texture */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Corner accents */}
        <div className="absolute top-8 left-8 w-24 h-24 border-l border-t border-white/10" />
        <div className="absolute bottom-8 right-8 w-24 h-24 border-r border-b border-white/10" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <span className="text-[10px] font-medium tracking-[0.3em] text-white/30 uppercase block mb-6">
            Stay Connected
          </span>
          
          <h2 className="text-[clamp(2rem,6vw,4rem)] font-black text-white leading-[0.95] tracking-tight mb-6">
            JOIN THE
            <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-white via-white/80 to-white/60">
              MOVEMENT
            </span>
          </h2>
          
          <p className="text-sm text-white/40 max-w-md mx-auto mb-10 font-light leading-relaxed">
            Get early access to limited drops, exclusive content, and be part of a community that values authenticity.
          </p>
          
          <form className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-6 py-4 bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors text-sm"
            />
            <button
              type="submit"
              className="group flex items-center justify-center gap-3 px-8 py-4 bg-white text-black font-semibold text-sm uppercase tracking-wider hover:bg-white/90 transition-colors"
            >
              <span>Subscribe</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" weight="bold" />
            </button>
          </form>
          
          <p className="text-[10px] text-white/20 mt-6 uppercase tracking-wider">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="bg-neutral-50 border-t border-black/5">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-12 gap-12 mb-16">
            {/* Brand */}
            <div className="md:col-span-5">
              <div className="text-2xl font-black text-black mb-4 tracking-tight">
                HEAD OVER FEELS
              </div>
              <p className="text-sm text-black/50 font-light leading-relaxed max-w-sm">
                Streetwear designed with intention. For those who wear their heart on their sleeve and honor their mind.
              </p>
            </div>
            
            {/* Links */}
            <div className="md:col-span-2">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 mb-4">Shop</h4>
              <ul className="space-y-3">
                <li><Link href="/products" className="text-sm text-black/60 hover:text-black transition-colors">All Products</Link></li>
                <li><Link href="/collections" className="text-sm text-black/60 hover:text-black transition-colors">Collections</Link></li>
                <li><Link href="/products?featured=true" className="text-sm text-black/60 hover:text-black transition-colors">Featured</Link></li>
              </ul>
            </div>
            
            <div className="md:col-span-2">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 mb-4">Company</h4>
              <ul className="space-y-3">
                <li><Link href="/about" className="text-sm text-black/60 hover:text-black transition-colors">Our Story</Link></li>
                <li><Link href="/contact" className="text-sm text-black/60 hover:text-black transition-colors">Contact</Link></li>
              </ul>
            </div>
            
            <div className="md:col-span-3">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 mb-4">Connect</h4>
              <div className="flex gap-4">
                <a href="#" className="text-sm text-black/60 hover:text-black transition-colors">Instagram</a>
                <a href="#" className="text-sm text-black/60 hover:text-black transition-colors">Twitter</a>
                <a href="#" className="text-sm text-black/60 hover:text-black transition-colors">TikTok</a>
              </div>
            </div>
          </div>
          
          {/* Bottom bar */}
          <div className="pt-8 border-t border-black/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-[10px] text-black/30 uppercase tracking-wider">
              &copy; 2024 Head Over Feels. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-[10px] text-black/30 hover:text-black/60 uppercase tracking-wider transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-[10px] text-black/30 hover:text-black/60 uppercase tracking-wider transition-colors">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
