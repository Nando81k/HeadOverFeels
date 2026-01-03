'use client'

import { useState, useEffect, useCallback } from 'react'

interface UsePendingOrdersResult {
  pendingOrders: number
  isLoading: boolean
  refetch: () => Promise<void>
}

export function usePendingOrders(pollingInterval = 30000): UsePendingOrdersResult {
  const [pendingOrders, setPendingOrders] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchPendingOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/orders/pending-count', {
        headers: {
          'x-user-admin': 'true',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setPendingOrders(data.count ?? 0)
      }
    } catch (error) {
      console.error('Failed to fetch pending orders:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingOrders()
    
    // Set up polling
    const interval = setInterval(fetchPendingOrders, pollingInterval)
    
    return () => clearInterval(interval)
  }, [fetchPendingOrders, pollingInterval])

  return {
    pendingOrders,
    isLoading,
    refetch: fetchPendingOrders,
  }
}
