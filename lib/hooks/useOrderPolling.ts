'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  customer: {
    email: string;
    phone?: string;
  };
  shippingAddress?: {
    firstName: string;
    lastName: string;
  };
  _count?: {
    items: number;
  };
}

interface OrdersResponse {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface UseOrderPollingOptions {
  pollingInterval?: number; // in milliseconds, default 30000 (30 seconds)
  enabled?: boolean;
  onNewOrders?: (count: number, orders: Order[]) => void;
}

interface UseOrderPollingReturn {
  newOrderCount: number;
  lastChecked: Date | null;
  isMuted: boolean;
  toggleMute: () => void;
  clearNewOrderCount: () => void;
  isPolling: boolean;
}

// Generate notification sound using Web Audio API
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    // Create a pleasant two-tone notification sound
    const playTone = (frequency: number, startTime: number, duration: number, volume: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const now = audioContext.currentTime;
    
    // Pleasant ascending two-tone chime (like a cash register)
    playTone(523.25, now, 0.15, 0.3);        // C5
    playTone(659.25, now + 0.1, 0.2, 0.3);   // E5
    playTone(783.99, now + 0.2, 0.25, 0.25); // G5
    
  } catch (error) {
    console.warn('Could not play notification sound:', error);
  }
}

const MUTE_STORAGE_KEY = 'headoverfeels_order_notifications_muted';
const LAST_ORDER_ID_KEY = 'headoverfeels_last_seen_order_id';

export function useOrderPolling(options: UseOrderPollingOptions = {}): UseOrderPollingReturn {
  const {
    pollingInterval = 30000,
    enabled = true,
    onNewOrders,
  } = options;

  const [newOrderCount, setNewOrderCount] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  
  const lastKnownOrderIdRef = useRef<string | null>(null);
  const isFirstFetchRef = useRef(true);

  // Load mute preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(MUTE_STORAGE_KEY);
      if (stored !== null) {
        setIsMuted(stored === 'true');
      }
      
      // Load last known order ID
      const lastOrderId = localStorage.getItem(LAST_ORDER_ID_KEY);
      if (lastOrderId) {
        lastKnownOrderIdRef.current = lastOrderId;
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newValue = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(MUTE_STORAGE_KEY, String(newValue));
      }
      return newValue;
    });
  }, []);

  const clearNewOrderCount = useCallback(() => {
    setNewOrderCount(0);
  }, []);

  const checkForNewOrders = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsPolling(true);
      
      // Fetch recent orders (just the first page, sorted by newest)
      const response = await fetch('/api/orders?page=1&limit=10');
      
      if (!response.ok) {
        console.warn('Failed to fetch orders for polling');
        return;
      }

      const data: OrdersResponse = await response.json();
      
      if (!data.data || data.data.length === 0) {
        setLastChecked(new Date());
        return;
      }

      const latestOrder = data.data[0];
      const latestOrderId = latestOrder.id;

      // Skip sound on first fetch (page load)
      if (isFirstFetchRef.current) {
        isFirstFetchRef.current = false;
        lastKnownOrderIdRef.current = latestOrderId;
        if (typeof window !== 'undefined') {
          localStorage.setItem(LAST_ORDER_ID_KEY, latestOrderId);
        }
        setLastChecked(new Date());
        return;
      }

      // Check if we have new orders since last check
      if (lastKnownOrderIdRef.current && latestOrderId !== lastKnownOrderIdRef.current) {
        // Count how many orders are new
        const newOrders: Order[] = [];
        for (const order of data.data) {
          if (order.id === lastKnownOrderIdRef.current) break;
          newOrders.push(order);
        }

        if (newOrders.length > 0) {
          setNewOrderCount(prev => prev + newOrders.length);
          
          // Play notification sound if not muted
          if (!isMuted) {
            playNotificationSound();
          }
          
          // Callback for custom handling
          onNewOrders?.(newOrders.length, newOrders);
        }
      }

      // Update last known order ID
      lastKnownOrderIdRef.current = latestOrderId;
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_ORDER_ID_KEY, latestOrderId);
      }
      
      setLastChecked(new Date());

    } catch (error) {
      console.warn('Error polling for orders:', error);
    } finally {
      setIsPolling(false);
    }
  }, [enabled, isMuted, onNewOrders]);

  // Initial check and polling interval
  useEffect(() => {
    if (!enabled) return;

    // Initial check
    checkForNewOrders();

    // Set up polling interval
    const intervalId = setInterval(checkForNewOrders, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollingInterval, checkForNewOrders]);

  return {
    newOrderCount,
    lastChecked,
    isMuted,
    toggleMute,
    clearNewOrderCount,
    isPolling,
  };
}

// Utility to manually trigger the notification sound (for testing)
export function testNotificationSound() {
  playNotificationSound();
}
