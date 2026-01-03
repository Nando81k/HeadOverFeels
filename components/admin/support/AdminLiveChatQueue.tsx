'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Clock, User, AlertCircle } from 'lucide-react'

type QueuedSession = {
  id: string
  sessionId: string
  customerName: string
  customerEmail: string
  requestedAt: string
  waitTime: number
  ticket: {
    ticketNumber: string
    type: string
    priority: string
    subject: string
  }
}

interface AdminLiveChatQueueProps {
  onAcceptChat: (sessionId: string) => void
  refreshTrigger?: number
}

export function AdminLiveChatQueue({ onAcceptChat, refreshTrigger = 0 }: AdminLiveChatQueueProps) {
  const [queue, setQueue] = useState<QueuedSession[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)

  useEffect(() => {
    loadQueue()
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadQueue, 5000)
    return () => clearInterval(interval)
  }, [refreshTrigger])

  async function loadQueue() {
    try {
      const response = await fetch('/api/chat/live/queue')
      if (!response.ok) throw new Error('Failed to load queue')
      const data = await response.json()
      setQueue(data.sessions || [])
    } catch (error) {
      console.error('Failed to load chat queue:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept(sessionId: string) {
    try {
      setAccepting(sessionId)
      
      const response = await fetch(`/api/chat/live/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to accept chat')
      }

      // Remove from queue and notify parent
      setQueue(prev => prev.filter(s => s.sessionId !== sessionId))
      onAcceptChat(sessionId)
    } catch (error) {
      console.error('Failed to accept chat:', error)
      alert(error instanceof Error ? error.message : 'Failed to accept chat')
    } finally {
      setAccepting(null)
    }
  }

  function formatWaitTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'URGENT': return 'text-red-600 bg-red-50'
      case 'HIGH': return 'text-orange-600 bg-orange-50'
      case 'MEDIUM': return 'text-blue-600 bg-blue-50'
      case 'LOW': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-gray-900 mb-1">No customers waiting</h3>
        <p className="text-sm text-gray-500">New chat requests will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {queue.length}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700">
            {queue.length} {queue.length === 1 ? 'customer' : 'customers'} waiting
          </span>
        </div>
        <button
          onClick={loadQueue}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          Refresh
        </button>
      </div>

      {queue.map((session, index) => (
        <div
          key={session.sessionId}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-900">{session.customerName}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(session.ticket.priority)}`}>
                  {session.ticket.priority}
                </span>
              </div>
              <div className="text-sm text-gray-600">{session.customerEmail}</div>
            </div>
            
            {/* Queue Position */}
            <div className="text-right">
              <div className="text-xs text-gray-500">Position</div>
              <div className="text-lg font-bold text-gray-900">#{index + 1}</div>
            </div>
          </div>

          {/* Ticket Info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-700">
                {session.ticket.ticketNumber}
              </span>
              <span className="text-xs text-gray-500">
                {session.ticket.type.replace('_', ' ')}
              </span>
            </div>
            <div className="text-sm text-gray-600 line-clamp-2">
              {session.ticket.subject}
            </div>
          </div>

          {/* Wait Time & Action */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-gray-600">
                Waiting <span className="font-medium text-orange-600">{formatWaitTime(session.waitTime)}</span>
              </span>
            </div>

            <button
              onClick={() => handleAccept(session.sessionId)}
              disabled={accepting === session.sessionId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {accepting === session.sessionId ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  Accept Chat
                </>
              )}
            </button>
          </div>

          {/* Warning for long wait times */}
          {session.waitTime > 180 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded">
              <AlertCircle className="w-4 h-4" />
              Customer has been waiting over 3 minutes
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
