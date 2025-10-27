'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface PromotionalBannerProps {
  message?: string
  backgroundColor?: string
  textColor?: string
}

export function PromotionalBanner({ 
  message = "Up to 70% OFF Sitewide - Limited Time Only! 🔥",
  backgroundColor = "#2B2B2B",
  textColor = "#FFFFFF"
}: PromotionalBannerProps) {
  // Check sessionStorage on mount to determine initial state
  const getDismissedState = () => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('promoBannerDismissed') === 'true'
  }
  
  const [isVisible, setIsVisible] = useState(!getDismissedState())

  const handleDismiss = () => {
    setIsVisible(false)
    sessionStorage.setItem('promoBannerDismissed', 'true')
  }

  if (!isVisible) {
    return null
  }

  return (
    <div 
      className="overflow-hidden py-2.5 fixed top-0 left-0 right-0 z-[70]"
      style={{ backgroundColor }}
    >
      <div className="animate-scroll-left whitespace-nowrap">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="inline-block px-4">
            <span 
              className="text-sm font-semibold tracking-wide uppercase"
              style={{ color: textColor }}
            >
              {message}
            </span>
          </div>
        ))}
      </div>
      
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
        aria-label="Close promotional banner"
        style={{ color: textColor }}
      >
        <X className="w-4 h-4" />
      </button>

      <style jsx>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll-left {
          animation: scroll-left 20s linear infinite;
        }
      `}</style>
    </div>
  )
}
