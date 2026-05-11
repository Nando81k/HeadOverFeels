'use client'

import { useEffect, useState, useMemo } from 'react'
import { X, Crown, Star, Sparkle, Gift } from '@phosphor-icons/react'
import { TierBadge } from './TierBadge'

type TierSlug = 'bronze' | 'silver' | 'gold' | 'platinum'

interface TierUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  newTier: {
    slug: TierSlug
    name: string
    minAnnualSpend: number
    pointMultiplier: number
    freeShipping: boolean
    earlyDropAccess: boolean
    birthdayReward: boolean
    exclusiveEvents: boolean
    perks: string[]
  }
  previousTier?: {
    slug: TierSlug
    name: string
  }
}

export function TierUpgradeModal({ isOpen, onClose, newTier, previousTier }: TierUpgradeModalProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  
  // Generate stable confetti props once
  const confettiParticles = useMemo(() => {
    return Array.from({ length: 30 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      size: 12 + Math.random() * 12,
      rotation: Math.random() * 360,
    }));
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true)
      // Disable body scroll when modal is open
      document.body.style.overflow = 'hidden'
      
      // Auto-hide confetti after animation
      const timer = setTimeout(() => setShowConfetti(false), 3000)
      
      return () => {
        clearTimeout(timer)
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {confettiParticles.map((props, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${props.left}%`,
                top: '-10%',
                animationDelay: `${props.delay}s`,
                animationDuration: `${props.duration}s`,
              }}
            >
              <Sparkle 
                className="text-yellow-400" 
                size={props.size}
                style={{
                  transform: `rotate(${props.rotation}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
          aria-label="Close modal"
        >
          <X size={24} className="text-gray-600" />
        </button>

        {/* Header with Gradient */}
        <div className="relative bg-linear-to-br from-purple-600 via-blue-600 to-purple-700 text-white p-8 rounded-t-2xl">
          <div className="absolute top-0 left-0 right-0 h-full opacity-10">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />
          </div>

          <div className="relative text-center">
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <Crown size={64} className="text-yellow-300 drop-shadow-lg animate-bounce" />
                <div className="absolute inset-0 animate-ping">
                  <Crown size={64} className="text-yellow-300 opacity-40" />
                </div>
              </div>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold mb-2">
              Congratulations! 🎉
            </h2>
            <p className="text-lg md:text-xl text-purple-100">
              You&apos;ve reached a new tier!
            </p>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-8">
          {/* Tier Transition */}
          <div className="flex items-center justify-center gap-6 mb-8">
            {previousTier && (
              <>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">Previous Tier</p>
                  <TierBadge tier={previousTier.slug} size="lg" />
                </div>
                
                <div className="flex flex-col items-center">
                  <div className="w-12 h-0.5 bg-linear-to-r from-gray-300 to-purple-600 mb-2" />
                  <Sparkle className="text-purple-600" size={24} />
                </div>
              </>
            )}
            
            <div className="text-center">
              <p className="text-sm font-medium text-purple-600 mb-2">
                {previousTier ? 'New Tier' : 'Welcome to'}
              </p>
              <TierBadge tier={newTier.slug} size="lg" />
            </div>
          </div>

          {/* New Benefits */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Gift className="text-purple-600" size={24} />
              Your New Benefits
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {newTier.freeShipping && (
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                  <Star className="text-purple-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-gray-900">Free Shipping</p>
                    <p className="text-sm text-gray-600">On all orders</p>
                  </div>
                </div>
              )}
              
              {newTier.earlyDropAccess && (
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                  <Star className="text-purple-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-gray-900">Early Access</p>
                    <p className="text-sm text-gray-600">To limited drops</p>
                  </div>
                </div>
              )}
              
              {newTier.pointMultiplier > 1 && (
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                  <Star className="text-purple-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-gray-900">{newTier.pointMultiplier}x Points</p>
                    <p className="text-sm text-gray-600">On every purchase</p>
                  </div>
                </div>
              )}
              
              {newTier.birthdayReward && (
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                  <Star className="text-purple-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-gray-900">Birthday Reward</p>
                    <p className="text-sm text-gray-600">Special gift on your day</p>
                  </div>
                </div>
              )}
              
              {newTier.exclusiveEvents && (
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                  <Star className="text-purple-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-gray-900">Exclusive Events</p>
                    <p className="text-sm text-gray-600">VIP access</p>
                  </div>
                </div>
              )}

              {newTier.perks.map((perk, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                  <Star className="text-purple-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-gray-900">{perk}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {newTier.pointMultiplier}x
              </p>
              <p className="text-sm text-gray-600">Points Multiplier</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                ${newTier.minAnnualSpend.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Annual Spend</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
            >
              Continue Shopping
            </button>
            <a
              href="/loyalty/tiers"
              className="flex-1 px-6 py-3 border-2 border-purple-600 text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors text-center"
            >
              View Dashboard
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 4s linear forwards;
        }
      `}</style>
    </div>
  )
}

// Hook to detect tier upgrades and show modal
export function useTierUpgradeDetection() {
  const [showModal, setShowModal] = useState(false)
  const [newTierData, setNewTierData] = useState<any>(null)
  const [previousTierData, setPreviousTierData] = useState<any>(null)

  useEffect(() => {
    const checkTierUpgrade = async () => {
      try {
        // Get stored previous tier
        const storedTierSlug = localStorage.getItem('userTierSlug')
        
        // Fetch current tier
        const response = await fetch('/api/loyalty/me')
        if (response.ok) {
          const data = await response.json()
          const currentTierSlug = data.currentTier?.slug

          // Check if tier changed
          if (storedTierSlug && currentTierSlug && storedTierSlug !== currentTierSlug) {
            // Tier upgrade detected!
            const tierOrder = ['bronze', 'silver', 'gold', 'platinum']
            const isUpgrade = tierOrder.indexOf(currentTierSlug) > tierOrder.indexOf(storedTierSlug)
            
            if (isUpgrade) {
              setNewTierData(data.currentTier)
              setPreviousTierData({ slug: storedTierSlug, name: storedTierSlug })
              setShowModal(true)
            }
          }

          // Update stored tier
          if (currentTierSlug) {
            localStorage.setItem('userTierSlug', currentTierSlug)
          }
        }
      } catch (error) {
        console.error('Failed to check tier upgrade:', error)
      }
    }

    checkTierUpgrade()
  }, [])

  return {
    showModal,
    setShowModal,
    newTierData,
    previousTierData,
  }
}
