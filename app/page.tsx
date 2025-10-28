import Link from 'next/link'
import Image from 'next/image'
import { Navigation } from '@/components/layout/Navigation'
import { ProductCard } from '@/components/products/ProductCard'
import { Button } from '@/components/ui/button'
import { ScrollFadeIn } from '@/components/ui/ScrollFadeIn'
import { ScrollArrow } from '@/components/ui/ScrollArrow'
import DropHeroSection from '@/components/drops/DropHeroSection'
import { NewArrivalsCarousel } from '@/components/home/NewArrivalsCarousel'
import { prisma } from '@/lib/prisma'
import { getActiveDrop, getDropStatus } from '@/lib/drops'
import { Package, Truck, Shield, Heart } from 'lucide-react'

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

// Helper function to get featured products (excluding drops and best sellers)
async function getFeaturedProducts(limit: number = 6) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      isFeatured: true,
      isLimitedEdition: false // Exclude drops from regular featured
    },
    include: {
      variants: true,
      category: true
    },
    take: limit,
    orderBy: {
      updatedAt: 'desc'
    }
  })
}

// Helper function to get featured new arrivals for carousel
async function getNewArrivals(limit: number = 10) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      isFeaturedNewArrival: true
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

export default async function Home() {
  // Fetch data in parallel
  const [activeDrop, bestSellers, featuredProducts, newArrivals] = await Promise.all([
    getActiveDrop(),
    getBestSellers(6),
    getFeaturedProducts(6),
    getNewArrivals(10)
  ])

  // Check if drop has stock available
  const dropHasStock = activeDrop 
    ? activeDrop.variants.some(v => v.inventory > 0)
    : false

  const dropStatus = activeDrop ? getDropStatus(activeDrop) : null
  
  // Only show drop if it's live with stock OR upcoming with countdown
  const shouldShowDrop = activeDrop && (
    (dropStatus === 'live' && dropHasStock) || 
    dropStatus === 'upcoming'
  )

  // Type conversion helper to handle null -> undefined and parse JSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertProduct = (product: any) => ({
    ...product,
    description: product.description ?? '',
    images: typeof product.images === 'string' ? JSON.parse(product.images) : product.images,
  })

  // Convert products for components
  const convertedDrop = activeDrop ? convertProduct(activeDrop) : null
  const convertedBestSellers = bestSellers.map(convertProduct)
  const convertedFeatured = featuredProducts.map(convertProduct)
  const convertedNewArrivals = newArrivals.map(convertProduct)

  return (
    <div className="min-h-screen bg-[#F6F1EE]">
      <Navigation />

      {/* Hero Section - Large Image with Overlay */}
      <ScrollFadeIn>
        <section className="relative h-screen min-h-[800px] overflow-hidden">
          <div className="absolute inset-0 bg-[#000000]">
            {/* Gradient overlay */}
            <div className="w-full h-full bg-linear-to-br from-[#FF3131]/20 to-[#CDA09B]/30" />
          </div>
          <div className="relative h-full flex flex-col items-center justify-center text-center px-6 z-10">
            <h1 className="text-6xl lg:text-8xl font-bold mb-6 tracking-tight text-white animate-slide-up">
              Feel the
              <span className="block text-[#FF3131] animate-slide-up animate-delay-200">Streets</span>
            </h1>
            <p className="text-xl lg:text-2xl text-white/90 mb-10 max-w-2xl leading-relaxed animate-fade-in animate-delay-300">
              Premium streetwear designed for authentic expression
            </p>
            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up animate-delay-400 justify-center items-center">
              <Button asChild size="lg" className="bg-[#FF3131] hover:bg-[#FF3131]/90 text-white border-0 hover-scale">
                <Link href="/collections">Shop Collection</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-white/10 border-white text-white hover:bg-white hover:text-[#000000] transition-smooth">
                <Link href="/products">View Lookbook</Link>
              </Button>
            </div>
          </div>
          
          {/* Animated Scroll Arrow */}
          <ScrollArrow targetId="new-arrivals-section" />
        </section>
      </ScrollFadeIn>

      {/* New Arrivals Carousel */}
      {convertedNewArrivals.length > 0 && (
        <ScrollFadeIn delay={50}>
          <div id="new-arrivals-section">
            <NewArrivalsCarousel products={convertedNewArrivals} />
          </div>
        </ScrollFadeIn>
      )}

      {/* Brand Values / USPs Section */}
      <ScrollFadeIn delay={100}>
        <section className="py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center group hover-lift animate-scale-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#CDA09B]/20 flex items-center justify-center transition-smooth group-hover:bg-[#FF3131] group-hover:scale-110">
                <Package className="w-8 h-8 text-[#000000] transition-smooth group-hover:text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-[#000000] uppercase tracking-wide">Premium Quality</h3>
              <p className="text-sm text-[#000000]/70">Carefully crafted pieces built to last</p>
            </div>
            <div className="text-center group hover-lift animate-scale-in animate-delay-100">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#CDA09B]/20 flex items-center justify-center transition-smooth group-hover:bg-[#FF3131] group-hover:scale-110">
                <Truck className="w-8 h-8 text-[#000000] transition-smooth group-hover:text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-[#000000] uppercase tracking-wide">Free Shipping</h3>
              <p className="text-sm text-[#000000]/70">On orders over $100</p>
            </div>
            <div className="text-center group hover-lift animate-scale-in animate-delay-200">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#CDA09B]/20 flex items-center justify-center transition-smooth group-hover:bg-[#FF3131] group-hover:scale-110">
                <Shield className="w-8 h-8 text-[#000000] transition-smooth group-hover:text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-[#000000] uppercase tracking-wide">Secure Payment</h3>
              <p className="text-sm text-[#000000]/70">Safe & encrypted transactions</p>
            </div>
            <div className="text-center group hover-lift animate-scale-in animate-delay-300">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#CDA09B]/20 flex items-center justify-center transition-smooth group-hover:bg-[#FF3131] group-hover:scale-110">
                <Heart className="w-8 h-8 text-[#000000] transition-smooth group-hover:text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-[#000000] uppercase tracking-wide">Made with Care</h3>
              <p className="text-sm text-[#000000]/70">Thoughtfully designed in every detail</p>
            </div>
          </div>
        </div>
      </section>
      </ScrollFadeIn>

      {/* Shop by Category Section */}
      <ScrollFadeIn delay={200}>
        <section className="py-20 lg:py-28 bg-[#F6F1EE]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 animate-slide-up">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-[#000000] tracking-tight uppercase">
              Shop by Category
            </h2>
            <p className="text-lg text-[#000000]/70">
              Find your style across our collections
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Hoodies & Sweatshirts */}
            <Link href="/products?category=hoodies" className="group relative aspect-4/5 rounded-2xl overflow-hidden hover-scale animate-slide-up">
              <Image
                src="/assets/Sweatshirt_hoodie_collection.png"
                alt="Hoodies & Sweatshirts Collection"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-transparent" />
              <div className="relative h-full flex flex-col justify-end p-8 text-white">
                <h3 className="text-3xl font-bold mb-2 tracking-tight group-hover:text-[#CDA09B] transition-colors-smooth">
                  Hoodies & Sweatshirts
                </h3>
                <p className="text-white/80 mb-4">Stay warm in style</p>
                <span className="text-sm font-semibold uppercase tracking-wider group-hover:translate-x-2 transition-smooth inline-block">
                  Shop Now →
                </span>
              </div>
            </Link>

            {/* Tees & Tops */}
            <Link href="/products?category=tees" className="group relative aspect-4/5 rounded-2xl overflow-hidden hover-scale animate-slide-up animate-delay-100">
              <Image
                src="/assets/Tee_tops_collection.png"
                alt="Tees & Tops Collection"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-transparent" />
              <div className="relative h-full flex flex-col justify-end p-8 text-white">
                <h3 className="text-3xl font-bold mb-2 tracking-tight group-hover:text-[#F6F1EE] transition-colors-smooth">
                  Tees & Tops
                </h3>
                <p className="text-white/80 mb-4">Essential everyday pieces</p>
                <span className="text-sm font-semibold uppercase tracking-wider group-hover:translate-x-2 transition-smooth inline-block">
                  Shop Now →
                </span>
              </div>
            </Link>

            {/* Accessories */}
            <Link href="/products?category=accessories" className="group relative aspect-4/5 rounded-2xl overflow-hidden hover-scale animate-slide-up animate-delay-200">
              <Image
                src="/assets/Accessories.png"
                alt="Accessories Collection"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-transparent" />
              <div className="relative h-full flex flex-col justify-end p-8 text-white">
                <h3 className="text-3xl font-bold mb-2 tracking-tight group-hover:text-[#CDA09B] transition-colors-smooth">
                  Accessories
                </h3>
                <p className="text-white/80 mb-4">Complete your look</p>
                <span className="text-sm font-semibold uppercase tracking-wider group-hover:translate-x-2 transition-smooth inline-block">
                  Shop Now →
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>
      </ScrollFadeIn>

      {/* Limited Edition Drop Section - Only show if drop exists and meets conditions */}
      {shouldShowDrop && convertedDrop && (
        <ScrollFadeIn delay={100}>
          <section className="py-16 lg:py-20 animate-fade-in">
          <div className="max-w-7xl mx-auto px-6">
            <DropHeroSection product={convertedDrop} />
          </div>
        </section>
        </ScrollFadeIn>
      )}

      {/* Best Sellers Section */}
      {convertedBestSellers.length > 0 && (
        <ScrollFadeIn delay={200}>
          <section className="py-20 lg:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16 animate-slide-up">
              <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-[#000000] tracking-tight uppercase">
                Best Sellers
              </h2>
              <p className="text-lg text-[#000000]/70">
                Customer favorites, restocked by demand
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {convertedBestSellers.map((product, index) => (
                <div key={product.id} className="animate-scale-in" style={{ animationDelay: `${index * 100}ms` }}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
        </section>
        </ScrollFadeIn>
      )}

      {/* Featured Products Grid */}
      {convertedFeatured.length > 0 && (
        <ScrollFadeIn delay={200}>
          <section className="py-20 lg:py-28 bg-[#F6F1EE]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16 animate-slide-up">
              <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-[#000000] tracking-tight uppercase">
                Featured Collection
              </h2>
              <p className="text-lg text-[#000000]/70">
                Curated pieces for your style
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {convertedFeatured.map((product, index) => (
                <div key={product.id} className="animate-scale-in" style={{ animationDelay: `${index * 100}ms` }}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
            <div className="text-center mt-12 animate-fade-in animate-delay-500">
              <Button asChild size="lg" variant="outline" className="border-[#FF3131] text-[#FF3131] hover:bg-[#FF3131] hover:text-white transition-smooth">
                <Link href="/products">View All Products</Link>
              </Button>
            </div>
          </div>
        </section>
        </ScrollFadeIn>
      )}

      {/* Brand Story / Lifestyle Section */}
      <ScrollFadeIn delay={100}>
        <section className="py-20 lg:py-28 bg-[#000000] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left side - Image */}
            <div className="relative aspect-square rounded-2xl overflow-hidden animate-slide-in-left">
              <Image
                src="/assets/stitching_img.png"
                alt="More Than Just Clothes - Craftsmanship Detail"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Right side - Content */}
            <div className="animate-slide-in-right">
              <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight uppercase">
                More Than Just Clothes
              </h2>
              <div className="space-y-4 text-lg text-white/80 leading-relaxed">
                <p>
                  We create pieces that go beyond fashion. Each design tells a story, 
                  celebrates culture, and empowers you to express your authentic self.
                </p>
                <p>
                  From the streets to the studio, our collection is designed for those 
                  who live boldly and wear their confidence proudly.
                </p>
              </div>
              <div className="mt-8">
                <Button asChild size="lg" className="bg-[#FF3131] hover:bg-[#FF3131]/90 text-white border-0 hover-scale">
                  <Link href="/about">Our Story</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
      </ScrollFadeIn>

      {/* Community Section */}
      <ScrollFadeIn delay={100}>
        <section className="py-20 lg:py-28 bg-[#CDA09B]/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 animate-slide-up">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-[#000000] tracking-tight uppercase">#HeadOverFeels</h2>
            <p className="text-lg text-[#000000]/70">Join our community. Tag us to be featured</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-[#CDA09B]/20 rounded-2xl overflow-hidden hover-scale transition-smooth cursor-pointer animate-scale-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Placeholder for community image */}
                <div className="w-full h-full bg-linear-to-br from-[#FF3131]/10 to-[#CDA09B]/30" />
              </div>
            ))}
          </div>
        </div>
      </section>
      </ScrollFadeIn>

      {/* Newsletter Section */}
      <ScrollFadeIn delay={100}>
        <section className="py-20 lg:py-28 bg-[#000000] text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight animate-slide-up">Stay in the Loop</h2>
          <p className="text-lg text-white/80 mb-10 leading-relaxed animate-fade-in animate-delay-200">
            Get exclusive access to new drops, special offers, and style inspiration
          </p>
          <form className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto animate-slide-up animate-delay-300">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-6 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:border-[#FF3131] transition-colors-smooth"
            />
            <Button
              type="submit"
              size="lg"
              className="bg-[#FF3131] text-white hover:bg-[#FF3131]/90 whitespace-nowrap hover-scale border-0"
            >
              Subscribe
            </Button>
          </form>
        </div>
      </section>
      </ScrollFadeIn>

      {/* Footer */}
      <ScrollFadeIn>
        <footer className="border-t border-[#CDA09B]/20 py-16 bg-[#F6F1EE]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="text-3xl font-bold mb-4 text-[#000000] tracking-tight">Head Over Feels</div>
              <p className="text-[#000000]/70 text-lg">Premium streetwear for authentic expression</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4 text-[#000000] uppercase tracking-wide">Shop</h4>
              <ul className="space-y-2">
                <li><Link href="/products" className="text-[#000000]/70 hover:text-[#FF3131] transition-colors-smooth">All Products</Link></li>
                <li><Link href="/collections" className="text-[#000000]/70 hover:text-[#FF3131] transition-colors-smooth">Collections</Link></li>
                <li><Link href="/products?featured=true" className="text-[#000000]/70 hover:text-[#FF3131] transition-colors-smooth">Featured</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4 text-[#000000] uppercase tracking-wide">About</h4>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-[#000000]/70 hover:text-[#FF3131] transition-colors-smooth">Our Story</Link></li>
                <li><Link href="/contact" className="text-[#000000]/70 hover:text-[#FF3131] transition-colors-smooth">Contact</Link></li>
                <li><Link href="/admin" className="text-[#000000]/70 hover:text-[#FF3131] transition-colors-smooth">Admin</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#CDA09B]/20 pt-8 text-center text-[#000000]/70">
            <p>&copy; 2024 Head Over Feels. All rights reserved.</p>
          </div>
        </div>
      </footer>
      </ScrollFadeIn>
    </div>
  );
}
