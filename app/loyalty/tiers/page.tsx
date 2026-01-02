'use client'

import { useEffect, useState } from 'react'
import { TierCard } from '@/components/loyalty/TierBadge'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Crown, ArrowLeft, Sparkle, CircleNotch } from '@phosphor-icons/react'

type TierSlug = 'bronze' | 'silver' | 'gold' | 'platinum'

interface Tier {
  id: string
  name: string
  slug: string
  description: string | null
  minAnnualSpend: number
  pointMultiplier: number
  freeShipping: boolean
  earlyDropAccess: boolean
  perks: string | null
  sortOrder: number
}

export default function TierBenefits() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [userTierSlug, setUserTierSlug] = useState<TierSlug | null>(null)

  useEffect(() => {
    fetchTiers()
    fetchUserTier()
  }, [])

  async function fetchTiers() {
    try {
      const response = await fetch('/api/loyalty/tiers')
      if (response.ok) {
        const data = await response.json()
        setTiers(data)
      }
    } catch (error) {
      console.error('Failed to fetch tiers:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUserTier() {
    try {
      const response = await fetch('/api/loyalty/me')
      if (response.ok) {
        const data = await response.json()
        const tierSlug = data.currentTier?.slug?.toLowerCase() || null
        setUserTierSlug(tierSlug as TierSlug | null)
      }
    } catch (error) {
      console.error('Failed to fetch user tier:', error)
    }
  }

  function parsePerks(perksString: string | null): string[] {
    if (!perksString) return []
    try {
      const perksObj = JSON.parse(perksString)
      return Object.entries(perksObj)
        .filter(([, value]) => value === true)
        .map(([key]) => formatPerkName(key))
    } catch {
      return []
    }
  }

  function formatPerkName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors mb-6 group"
        >
          <ArrowLeft size={20} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Profile</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-black flex items-center justify-center">
              <Crown size={24} weight="fill" className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-black">Loyalty Tiers</h1>
              <p className="text-black/60">Unlock exclusive benefits as you shop</p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white border border-black/10 p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkle size={24} weight="fill" className="text-black" />
            <h2 className="text-xl font-bold text-black">How It Works</h2>
          </div>
          <div className="text-black/60 space-y-3">
            <p>
              Your tier is determined by your annual spending (rolling 12 months). As you shop, 
              you&apos;ll automatically move up to higher tiers and unlock more benefits. Tiers reset 
              annually, so keep shopping to maintain your status!
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li><span className="font-medium text-black">Earn Points:</span> Every purchase earns you Care Points based on your tier multiplier</li>
              <li><span className="font-medium text-black">Unlock Benefits:</span> Higher tiers get free shipping, early drop access, and exclusive perks</li>
              <li><span className="font-medium text-black">Redeem Rewards:</span> Use your points for discounts, exclusive items, and experiences</li>
              <li><span className="font-medium text-black">Stay Active:</span> Your tier is based on the last 365 days of purchases</li>
            </ul>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tiers.map((tier) => {
            const perks = parsePerks(tier.perks)
            const benefits = [
              `${tier.pointMultiplier}x points on all purchases`,
              ...(tier.freeShipping ? ['Free shipping on all orders'] : []),
              ...(tier.earlyDropAccess ? ['Early access to limited drops'] : []),
              ...perks,
            ]

            const tierSlug = tier.slug?.toLowerCase() as TierSlug

            return (
              <TierCard
                key={tier.id}
                tier={tierSlug}
                name={tier.name}
                description={tier.description || ''}
                benefits={benefits}
                minSpend={tier.minAnnualSpend}
                isCurrent={tierSlug === userTierSlug}
              />
            )
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-black/60 mb-4">Ready to start earning?</p>
          <Link
            href="/products"
            className="inline-block px-8 py-3 bg-black text-white font-bold hover:bg-black/90 transition-colors"
          >
            Shop Now
          </Link>
        </div>
      </div>
    </div>
  )
}
