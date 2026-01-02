/**
 * Live Chat Notifications Hook
 * 
 * Provides real-time updates on waiting chat sessions for admin users.
 * Polls the queue endpoint and triggers browser notifications for new chats.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface WaitingChat {
  id: string;
  sessionId: string;
  customerName: string;
  customerEmail: string;
  issueCategory: string | null;
  issueSummary: string | null;
  startedAt: string;
  waitTimeMinutes: number;
}

interface UseLiveChatNotificationsReturn {
  waitingChats: WaitingChat[];
  waitingCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  notificationsEnabled: boolean;
  enableNotifications: () => Promise<boolean>;
}

export function useLiveChatNotifications(
  enabled: boolean = true,
  pollInterval: number = 10000 // 10 seconds
): UseLiveChatNotificationsReturn {
  const [waitingChats, setWaitingChats] = useState<WaitingChat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const previousCountRef = useRef(0);
  const hasInitialized = useRef(false);

  // Check browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Request notification permission
  const enableNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setNotificationsEnabled(granted);
    return granted;
  }, []);

  // Show browser notification
  const showNotification = useCallback((chat: WaitingChat) => {
    if (!notificationsEnabled || typeof window === 'undefined') return;

    try {
      const notification = new Notification('New Support Chat Request', {
        body: `${chat.customerName} needs help with: ${chat.issueSummary || chat.issueCategory || 'General inquiry'}`,
        icon: '/favicon.ico',
        tag: `chat-${chat.sessionId}`,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        // Navigate to support page
        window.location.href = '/admin/support';
        notification.close();
      };
    } catch (e) {
      console.error('Failed to show notification:', e);
    }
  }, [notificationsEnabled]);

  // Fetch waiting chats
  const fetchWaitingChats = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat/live/queue');
      
      if (!response.ok) {
        throw new Error('Failed to fetch waiting chats');
      }

      const data = await response.json();
      const newChats = data.sessions || [];
      
      // Check for new chats (only after initial load)
      if (hasInitialized.current && newChats.length > previousCountRef.current) {
        // Find the new chats
        const existingIds = new Set(waitingChats.map(c => c.sessionId));
        const brandNewChats = newChats.filter(
          (c: WaitingChat) => !existingIds.has(c.sessionId)
        );
        
        // Show notifications for new chats
        brandNewChats.forEach(showNotification);
        
        // Play sound if available
        if (brandNewChats.length > 0) {
          try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {/* Ignore autoplay restrictions */});
          } catch {
            // Audio not available
          }
        }
      }

      setWaitingChats(newChats);
      previousCountRef.current = newChats.length;
      hasInitialized.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, waitingChats, showNotification]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchWaitingChats();

    // Set up polling
    const intervalId = setInterval(fetchWaitingChats, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollInterval, fetchWaitingChats]);

  return {
    waitingChats,
    waitingCount: waitingChats.length,
    isLoading,
    error,
    refetch: fetchWaitingChats,
    notificationsEnabled,
    enableNotifications,
  };
}
