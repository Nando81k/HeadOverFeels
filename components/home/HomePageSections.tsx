import DropHeroSection from '@/components/drops/DropHeroSection'
import { HomeCategoryDiscovery } from '@/components/home/HomeCategoryDiscovery'
import { HomeFooter } from '@/components/home/HomeFooter'
import { HomeHero } from '@/components/home/HomeHero'
import { HomeNewsletter } from '@/components/home/HomeNewsletter'
import { HomeProductRail } from '@/components/home/HomeProductRail'
import { HomeSocialProof } from '@/components/home/HomeSocialProof'
import { HomeTrustBar } from '@/components/home/HomeTrustBar'
import type { HomePageData } from '@/components/home/types'
import type { ActiveDrop } from '@/lib/drops'

interface HomePageSectionsProps {
  data: HomePageData
  activeDrop: ActiveDrop | null
}

export function HomePageSections({ data, activeDrop }: HomePageSectionsProps) {
  return (
    <main id="main-content" className="min-h-screen bg-white" aria-label="Homepage">
      <HomeHero />
      <HomeTrustBar />

      <HomeProductRail
        sectionId="home-best-sellers"
        testId="home-best-sellers"
        eyebrow="Best sellers"
        title="Most loved right now"
        description="Top-performing staples picked from recent orders and refreshed with active-product fallbacks."
        products={data.bestSellers}
      />

      <HomeCategoryDiscovery categories={data.categories} />

      <HomeProductRail
        sectionId="home-new-arrivals"
        testId="home-new-arrivals"
        eyebrow="New arrivals"
        title="Fresh drops, same signature comfort"
        description="Built from featured new arrivals first, then filled with the newest active products."
        products={data.newArrivals}
        viewAllHref="/products?sortBy=newest"
        viewAllLabel="View newest"
      />

      <HomeProductRail
        sectionId="home-trending"
        testId="home-trending"
        eyebrow="Trending now"
        title="Popular picks across everyone"
        description="Trending rail is shared for all users in this pass, with deterministic fallback coverage."
        products={data.trending}
      />

      {activeDrop && (
        <section data-testid="home-drop" aria-label="Limited drop spotlight" className="border-b border-black/10 bg-white">
          <DropHeroSection product={activeDrop} />
        </section>
      )}

      <HomeSocialProof summary={data.reviewSummary} highlights={data.reviewHighlights} />
      <HomeNewsletter />
      <HomeFooter />
    </main>
  )
}
