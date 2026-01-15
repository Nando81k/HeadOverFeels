'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import {
  EmailCaptureModal,
  ModalTemplate,
  BannerTemplate,
  SlideInTemplate,
  ExitIntentModal,
  FullScreenTemplate,
  PopupContent
} from '@/components/marketing/templates'

interface ActivePopup {
  id: string
  template: 'MODAL' | 'BANNER' | 'SLIDE_IN' | 'FULL_SCREEN' | 'EMAIL_CAPTURE'
  position: string
  triggerType: 'DELAY' | 'SCROLL' | 'EXIT_INTENT' | 'IMMEDIATE'
  triggerValue: number
  frequency: string
  content: PopupContent
  variantId: string
}

interface ApiPopup {
  id: string
  template: 'MODAL' | 'BANNER' | 'SLIDE_IN' | 'FULL_SCREEN' | 'EMAIL_CAPTURE'
  position: string
  triggerType: 'DELAY' | 'SCROLL' | 'EXIT_INTENT' | 'IMMEDIATE'
  triggerValue: number
  frequency: string
  content: PopupContent
  variants: Array<{
    id: string
    name: string
    content: PopupContent | null
    weight: number
  }> | null
}

interface PopupManagerProps {
  page?: string
}

export function PopupManager({ page }: PopupManagerProps) {
  const pathname = usePathname()
  const currentPage = page || pathname || '/'
  
  const [activePopups, setActivePopups] = useState<ActivePopup[]>([])
  const [visiblePopup, setVisiblePopup] = useState<ActivePopup | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  
  // Track if user has interacted (for exit intent detection)
  const [hasInteracted, setHasInteracted] = useState(false)
  
  // Don't render popups on admin pages
  const isAdminPage = pathname?.startsWith('/admin')
  
  // Only show popups on the home page
  const isHomePage = pathname === '/'
  
  // Fetch active popups on mount
  useEffect(() => {
    // Skip fetching for admin pages or non-home pages
    if (isAdminPage || !isHomePage) return
    
    const fetchPopups = async () => {
      try {
        const params = new URLSearchParams({
          page: currentPage,
          visitor: getVisitorType()
        })
        const res = await fetch(`/api/popups/active?${params}`)
        const data = await res.json()
        
        // Process popups - select variant based on A/B weights and merge content
        const processedPopups: ActivePopup[] = (data.popups || []).map((popup: ApiPopup) => {
          // Select a variant based on weights (A/B testing)
          let selectedVariant = null
          if (popup.variants && popup.variants.length > 0) {
            const random = Math.random() * 100
            let cumulative = 0
            for (const variant of popup.variants) {
              cumulative += variant.weight
              if (random <= cumulative) {
                selectedVariant = variant
                break
              }
            }
            // Fallback to first variant if none selected
            if (!selectedVariant) {
              selectedVariant = popup.variants[0]
            }
          }
          
          // Merge variant content with popup content (variant overrides)
          const finalContent = selectedVariant?.content 
            ? { ...popup.content, ...selectedVariant.content }
            : popup.content
          
          return {
            id: popup.id,
            template: popup.template,
            position: popup.position,
            triggerType: popup.triggerType,
            triggerValue: popup.triggerValue,
            frequency: popup.frequency,
            content: finalContent,
            variantId: selectedVariant?.id || popup.id
          }
        })
        
        setActivePopups(processedPopups)
      } catch (error) {
        console.error('Failed to fetch popups:', error)
      }
    }
    
    fetchPopups()
  }, [currentPage, isAdminPage, isHomePage])
  
  // Get visitor type from session
  const getVisitorType = () => {
    if (typeof window === 'undefined') return 'new'
    const visited = sessionStorage.getItem('hof_visited')
    if (!visited) {
      sessionStorage.setItem('hof_visited', 'true')
      return 'new'
    }
    return 'returning'
  }
  
  // Check if popup should be shown based on frequency
  const shouldShowPopup = useCallback((popup: ActivePopup): boolean => {
    if (typeof window === 'undefined') return false
    
    const key = `hof_popup_${popup.id}`
    const data = sessionStorage.getItem(key) || localStorage.getItem(key)
    
    if (!data) return true
    
    try {
      const { timestamp, frequency } = JSON.parse(data)
      const now = Date.now()
      const diff = now - timestamp
      
      switch (frequency) {
        case 'ONCE_EVER':
          return false
        case 'ONCE_PER_WEEK':
          return diff > 7 * 24 * 60 * 60 * 1000
        case 'ONCE_PER_DAY':
          return diff > 24 * 60 * 60 * 1000
        case 'ONCE_PER_SESSION':
          return !sessionStorage.getItem(key)
        case 'ALWAYS':
        default:
          return true
      }
    } catch {
      return true
    }
  }, [])
  
  // Mark popup as shown
  const markPopupShown = useCallback((popup: ActivePopup) => {
    if (typeof window === 'undefined') return
    
    const key = `hof_popup_${popup.id}`
    const data = JSON.stringify({
      timestamp: Date.now(),
      frequency: popup.frequency
    })
    
    if (popup.frequency === 'ONCE_EVER' || popup.frequency === 'ONCE_PER_WEEK' || popup.frequency === 'ONCE_PER_DAY') {
      localStorage.setItem(key, data)
    }
    sessionStorage.setItem(key, data)
  }, [])
  
  // Track analytics
  const trackEvent = useCallback(async (popup: ActivePopup, event: 'impression' | 'click' | 'dismiss' | 'conversion') => {
    try {
      await fetch('/api/popups/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          popupId: popup.id,
          variantId: popup.variantId,
          event
        })
      })
    } catch (error) {
      console.error('Failed to track popup event:', error)
    }
  }, [])
  
  // Show popup with tracking
  const showPopup = useCallback((popup: ActivePopup) => {
    if (dismissed.has(popup.id)) return
    if (!shouldShowPopup(popup)) return
    
    setVisiblePopup(popup)
    markPopupShown(popup)
    trackEvent(popup, 'impression')
  }, [dismissed, shouldShowPopup, markPopupShown, trackEvent])
  
  // Handle popup close
  const handleClose = useCallback(() => {
    if (visiblePopup) {
      trackEvent(visiblePopup, 'dismiss')
      setDismissed(prev => new Set([...prev, visiblePopup.id]))
    }
    setVisiblePopup(null)
  }, [visiblePopup, trackEvent])
  
  // Handle popup action (CTA click)
  const handleAction = useCallback(() => {
    if (visiblePopup) {
      trackEvent(visiblePopup, 'click')
    }
  }, [visiblePopup, trackEvent])
  
  // Handle email submission
  const handleEmailSubmit = useCallback(async (email: string): Promise<{ promoCode?: string; discountDescription?: string; message?: string } | void> => {
    if (visiblePopup) {
      trackEvent(visiblePopup, 'conversion')
      
      // Try to claim promo code for this popup (will also save email)
      try {
        const response = await fetch('/api/popups/claim-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            popupId: visiblePopup.id,
            email 
          })
        })
        
        const data = await response.json()
        
        if (data.hasPromo && data.promoCode) {
          // Return promo info for display
          return {
            promoCode: data.promoCode,
            discountDescription: data.discountDescription,
            message: data.message,
          }
        }
        
        // No promo linked, but email was saved
        return { message: data.message || 'Thank you for signing up!' }
      } catch (error) {
        console.error('Failed to claim promo code:', error)
        
        // Fallback: just save the email directly
        try {
          await fetch('/api/drop-notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          })
        } catch {
          console.error('Failed to save email')
        }
      }
    }
  }, [visiblePopup, trackEvent])
  
  // Setup triggers
  useEffect(() => {
    if (activePopups.length === 0) return
    
    const timers: NodeJS.Timeout[] = []
    
    // Popups are already sorted by priority from the API
    const sortedPopups = [...activePopups]
    
    sortedPopups.forEach(popup => {
      // Skip if already dismissed or shouldn't show
      if (dismissed.has(popup.id) || !shouldShowPopup(popup)) return
      
      switch (popup.triggerType) {
        case 'IMMEDIATE':
          // Small delay to allow page to render
          const immediateTimer = setTimeout(() => showPopup(popup), 100)
          timers.push(immediateTimer)
          break
          
        case 'DELAY':
          const delayTimer = setTimeout(() => showPopup(popup), popup.triggerValue * 1000)
          timers.push(delayTimer)
          break
          
        case 'SCROLL':
          const handleScroll = () => {
            const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
            if (scrollPercent >= popup.triggerValue) {
              showPopup(popup)
              window.removeEventListener('scroll', handleScroll)
            }
          }
          window.addEventListener('scroll', handleScroll, { passive: true })
          // Cleanup in return
          break
          
        case 'EXIT_INTENT':
          // Desktop: mouse leaves viewport
          const handleMouseLeave = (e: MouseEvent) => {
            if (e.clientY <= 0 && hasInteracted) {
              showPopup(popup)
              document.removeEventListener('mouseleave', handleMouseLeave)
            }
          }
          
          // Mobile: detect scroll up (suggesting user might leave)
          let lastScrollY = window.scrollY
          const handleMobileExit = () => {
            const currentScrollY = window.scrollY
            // User scrolled up significantly near top
            if (currentScrollY < lastScrollY && currentScrollY < 100 && hasInteracted) {
              showPopup(popup)
              window.removeEventListener('scroll', handleMobileExit)
            }
            lastScrollY = currentScrollY
          }
          
          // Track interaction
          const handleInteraction = () => {
            setHasInteracted(true)
            document.removeEventListener('click', handleInteraction)
            document.removeEventListener('scroll', handleInteraction)
          }
          
          document.addEventListener('click', handleInteraction, { once: true })
          document.addEventListener('scroll', handleInteraction, { once: true })
          document.addEventListener('mouseleave', handleMouseLeave)
          
          // Mobile detection
          if ('ontouchstart' in window) {
            window.addEventListener('scroll', handleMobileExit, { passive: true })
          }
          break
      }
    })
    
    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [activePopups, dismissed, hasInteracted, shouldShowPopup, showPopup])
  
  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visiblePopup) {
        handleClose()
      }
    }
    
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [visiblePopup, handleClose])
  
  // Handle email action wrapper
  const handleEmailAction = useCallback((data?: { email?: string }) => {
    if (data?.email) {
      handleEmailSubmit(data.email)
    }
    handleAction()
  }, [handleEmailSubmit, handleAction])
  
  // Render the appropriate popup template
  const renderPopup = () => {
    if (!visiblePopup) return null
    
    const props = {
      content: visiblePopup.content,
      onClose: handleClose,
      onAction: handleAction
    }
    
    switch (visiblePopup.template) {
      case 'EMAIL_CAPTURE':
        return <EmailCaptureModal {...props} onAction={handleEmailAction} />
        
      case 'MODAL':
        return <ModalTemplate {...props} />
        
      case 'BANNER':
        return (
          <BannerTemplate 
            {...props} 
            position={visiblePopup.position === 'BOTTOM' ? 'bottom' : 'top'} 
          />
        )
        
      case 'SLIDE_IN':
        const slidePos = visiblePopup.position.toLowerCase().replace('_', '-') as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
        return <SlideInTemplate {...props} position={slidePos} />
        
      case 'FULL_SCREEN':
        // Use ExitIntentModal for exit-intent trigger, FullScreenTemplate otherwise
        if (visiblePopup.triggerType === 'EXIT_INTENT') {
          return <ExitIntentModal {...props} />
        }
        return <FullScreenTemplate {...props} />
        
      default:
        return <ModalTemplate {...props} />
    }
  }
  
  // Don't render anything on admin pages or non-home pages
  if (isAdminPage || !isHomePage) return null
  
  return (
    <AnimatePresence>
      {renderPopup()}
    </AnimatePresence>
  )
}

export default PopupManager
