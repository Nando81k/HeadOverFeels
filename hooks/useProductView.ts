'use client'

import { useEffect, useRef, useCallback } from 'react'

interface UseProductViewOptions {
  productId: string
  customerId?: string
  source?: string
  sessionId?: string
}

/**
 * Hook to track product views for analytics and recommendations
 * Records view data when component mounts and tracks time spent
 */
export function useProductView({
  productId,
  customerId,
  source = 'product_page',
  sessionId,
}: UseProductViewOptions) {
  const viewStartTime = useRef<number | null>(null)
  const tracked = useRef<boolean>(false)

  const trackView = useCallback(async () => {
    try {
      await fetch('/api/product-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerId,
          source,
          sessionId: sessionId || getOrCreateSessionId(),
          viewedAt: new Date().toISOString(),
        }),
      })
    } catch (error) {
      // Silently fail - analytics shouldn't break the user experience
      console.error('Failed to track product view:', error)
    }
  }, [productId, customerId, source, sessionId])

  const trackViewDuration = useCallback(async (durationSeconds: number) => {
    // Only track if user spent more than 3 seconds
    if (durationSeconds < 3) return

    try {
      await fetch('/api/product-views/duration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerId,
          sessionId: sessionId || getOrCreateSessionId(),
          durationSeconds,
        }),
      })
    } catch (error) {
      console.error('Failed to track view duration:', error)
    }
  }, [productId, customerId, sessionId])

  useEffect(() => {
    // Initialize start time
    viewStartTime.current = Date.now()
    
    // Track view on mount
    if (!tracked.current) {
      trackView()
      tracked.current = true
    }

    // Track view duration on unmount
    return () => {
      const startTime = viewStartTime.current
      if (startTime) {
        const durationSeconds = Math.floor((Date.now() - startTime) / 1000)
        trackViewDuration(durationSeconds)
      }
    }
  }, [trackView, trackViewDuration])
}

/**
 * Get or create a session ID for anonymous users
 * Stored in localStorage for tracking across page views
 */
function getOrCreateSessionId(): string {
  const key = 'hof_session_id'
  
  try {
    let sessionId = localStorage.getItem(key)
    
    if (!sessionId) {
      // Generate random session ID
      sessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem(key, sessionId)
    }
    
    return sessionId
  } catch {
    // If localStorage fails, generate temporary session ID
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
