'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { 
  X, 
  Send, 
  User, 
  Clock, 
  CheckCircle2,
  Loader2 
} from 'lucide-react'

type SocketResponse = {
  error?: string
}

type ChatMessage = {
  id: string
  message: string
  senderType: 'customer' | 'admin' | 'system'
  senderName: string
  createdAt: string
  isRead: boolean
}

type ChatSession = {
  id: string
  sessionId: string
  customerName: string
  customerEmail: string
  status: 'WAITING' | 'ACTIVE' | 'CLOSED'
  acceptedAt: string
  ticket: {
    ticketNumber: string
    subject: string
    type: string
  }
  messages: ChatMessage[]
}

interface AdminLiveChatPanelProps {
  sessionId: string
  onClose: () => void
}

export function AdminLiveChatPanel({ sessionId, onClose }: AdminLiveChatPanelProps) {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [customerTyping, setCustomerTyping] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [resolveTicket, setResolveTicket] = useState(false)
  const [resolution, setResolution] = useState('')
  const [closing, setClosing] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io({
      path: '/api/socket',
    })

    newSocket.on('connect', () => {
      console.log('Connected to Socket.IO')
      // Join the chat session room
      newSocket.emit('chat:join', { sessionId })
    })

    newSocket.on('chat:session-details', (data) => {
      setSession(data.session)
      setMessages(data.session.messages || [])
      setLoading(false)
    })

    newSocket.on('chat:new-message', (message) => {
      setMessages(prev => [...prev, message])
      
      // Mark as read if from customer
      if (message.senderType === 'customer') {
        newSocket.emit('chat:mark-read', { 
          sessionId, 
          messageIds: [message.id] 
        })
      }
    })

    newSocket.on('chat:typing', ({ isTyping, userId }) => {
      // Only show typing if it's from customer
      if (userId !== 'admin') {
        setCustomerTyping(isTyping)
        if (isTyping) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
          }
          typingTimeoutRef.current = setTimeout(() => {
            setCustomerTyping(false)
          }, 3000)
        }
      }
    })

    newSocket.on('chat:session-closed', () => {
      alert('Chat session has been closed')
      onClose()
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [sessionId, onClose])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !socket || sending) return

    try {
      setSending(true)
      
      socket.emit('chat:send-message', {
        sessionId,
        message: newMessage.trim(),
        senderType: 'admin',
        senderName: 'Admin' // TODO: Get from auth context
      }, (response: SocketResponse) => {
        if (response.error) {
          alert(response.error)
        }
      })

      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  function handleTyping() {
    if (socket) {
      socket.emit('chat:typing', { 
        sessionId, 
        isTyping: true,
        userId: 'admin'
      })
    }
  }

  async function handleCloseChat() {
    if (!confirm('Are you sure you want to close this chat?')) return

    try {
      setClosing(true)
      
      const response = await fetch('/api/chat/live/admin/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          resolveTicket,
          resolution: resolveTicket ? resolution : undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to close chat')
      }

      onClose()
    } catch (error) {
      console.error('Failed to close chat:', error)
      alert(error instanceof Error ? error.message : 'Failed to close chat')
    } finally {
      setClosing(false)
    }
  }

  function formatTime(timestamp: string): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  }

  function formatDuration(startTime: string): string {
    const start = new Date(startTime)
    const now = new Date()
    const diffMs = now.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m`
    
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}h ${mins}m`
  }

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Session not found</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Live Chat</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer Info */}
        <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium">{session.customerName}</div>
            <div className="text-xs text-blue-100">{session.customerEmail}</div>
          </div>
        </div>

        {/* Ticket Info */}
        <div className="mt-2 text-xs bg-white/10 rounded px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-blue-100">Ticket:</span>
            <span className="font-medium">{session.ticket.ticketNumber}</span>
          </div>
          <div className="mt-1 text-white/90 truncate">{session.ticket.subject}</div>
        </div>

        {/* Duration */}
        <div className="mt-2 flex items-center gap-2 text-xs text-blue-100">
          <Clock className="w-3 h-3" />
          <span>Duration: {formatDuration(session.acceptedAt)}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.senderType === 'admin' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.senderType === 'system'
                  ? 'bg-gray-200 text-gray-600 text-center text-sm italic w-full max-w-full'
                  : message.senderType === 'admin'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}
            >
              {message.senderType !== 'system' && (
                <div className={`text-xs mb-1 ${message.senderType === 'admin' ? 'text-blue-100' : 'text-gray-500'}`}>
                  {message.senderName}
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.message}
              </div>
              <div className={`text-xs mt-1 flex items-center gap-1 ${message.senderType === 'admin' ? 'text-blue-100 justify-end' : 'text-gray-400'}`}>
                <span>{formatTime(message.createdAt)}</span>
                {message.senderType === 'admin' && message.isRead && (
                  <CheckCircle2 className="w-3 h-3" />
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {customerTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Close Chat Options */}
      {session.status === 'ACTIVE' && (
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={resolveTicket}
                onChange={(e) => setResolveTicket(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Resolve ticket when closing chat</span>
            </label>
            
            {resolveTicket && (
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Resolution notes (optional)..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
              />
            )}
          </div>

          <button
            onClick={handleCloseChat}
            disabled={closing}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {closing ? 'Closing...' : 'Close Chat'}
          </button>
        </div>
      )}

      {/* Message Input */}
      {session.status === 'ACTIVE' && (
        <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                handleTyping()
              }}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
