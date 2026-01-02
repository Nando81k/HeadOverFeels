'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Send, 
  Loader2, 
  ShoppingBag,
  Package,
  HelpCircle,
  Gift,
  ChevronDown,
  Sparkles,
  User,
  ShoppingCart,
  Star,
  ExternalLink,
  Ticket,
  Award,
  Share2,
  Copy,
  Check,
  MessageCircle,
  ArrowLeft,
  Phone,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import PreChatQuestionnaire from '@/components/support/PreChatQuestionnaire'

// Types
type ChatMode = 'ai' | 'questionnaire' | 'waiting' | 'live-chat'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'agent' | 'system'
  content: string
  toolResults?: Array<{
    name: string
    result: unknown
  }>
  timestamp: Date
  agentName?: string
}

interface LiveChatSession {
  sessionId: string
  ticketNumber: string
  agentName?: string
  status: 'waiting' | 'active' | 'closed'
  queuePosition?: number
  estimatedWaitMinutes?: number
}

interface StreamChunk {
  type: 'text' | 'tool_start' | 'tool_result' | 'error' | 'done'
  content?: string
  toolName?: string
  toolResult?: unknown
  error?: string
}

const QUICK_ACTIONS = [
  { icon: ShoppingBag, label: 'Browse New Arrivals', prompt: 'Show me the latest drops and new arrivals' },
  { icon: Package, label: 'Track My Order', prompt: 'Help me track my recent order' },
  { icon: HelpCircle, label: 'Need Help', prompt: 'I need help with something' },
  { icon: Gift, label: 'Check Rewards', prompt: 'What rewards do I have available?' },
]

export default function ReggieWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  
  // Live chat state
  const [chatMode, setChatMode] = useState<ChatMode>('ai')
  const [liveChatSession, setLiveChatSession] = useState<LiveChatSession | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [customerInfo, setCustomerInfo] = useState<{ name: string; email: string } | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Poll for live chat session updates when waiting
  useEffect(() => {
    if (chatMode === 'waiting' && liveChatSession?.sessionId) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/chat/live/${liveChatSession.sessionId}`)
          if (response.ok) {
            const data = await response.json()
            
            if (data.session.status === 'ACTIVE') {
              // Agent accepted - switch to live chat mode
              setLiveChatSession(prev => prev ? {
                ...prev,
                status: 'active',
                agentName: data.session.agent?.name || 'Support Agent'
              } : null)
              setChatMode('live-chat')
              
              // Add system message
              setMessages(prev => [...prev, {
                id: `system-${Date.now()}`,
                role: 'system',
                content: `Connected with ${data.session.agent?.name || 'Support Agent'}`,
                timestamp: new Date()
              }])
              
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
              }
            } else if (data.session.status === 'CLOSED') {
              // Session was closed
              setMessages(prev => [...prev, {
                id: `system-${Date.now()}`,
                role: 'system',
                content: 'Chat session ended. Thank you for contacting support.',
                timestamp: new Date()
              }])
              setChatMode('ai')
              setLiveChatSession(null)
              
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
              }
            } else {
              // Update queue position
              setLiveChatSession(prev => prev ? {
                ...prev,
                queuePosition: data.queuePosition,
                estimatedWaitMinutes: data.estimatedWaitMinutes
              } : null)
            }
          }
        } catch (error) {
          console.error('Error polling chat status:', error)
        }
      }, 5000) // Poll every 5 seconds
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
      }
    }
  }, [chatMode, liveChatSession?.sessionId])

  // Poll for new messages in live chat mode
  useEffect(() => {
    if (chatMode === 'live-chat' && liveChatSession?.sessionId) {
      const messageInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/chat/live/${liveChatSession.sessionId}`)
          if (response.ok) {
            const data = await response.json()
            
            if (data.session.status === 'CLOSED') {
              setMessages(prev => [...prev, {
                id: `system-${Date.now()}`,
                role: 'system',
                content: 'Chat session ended. Thank you for contacting support.',
                timestamp: new Date()
              }])
              setChatMode('ai')
              setLiveChatSession(null)
              clearInterval(messageInterval)
              return
            }
            
            // Check for new agent messages
            const existingIds = new Set(messages.map(m => m.id))
            const agentMessages = data.messages
              ?.filter((m: { senderType: string; id: string }) => m.senderType === 'ADMIN' && !existingIds.has(`agent-${m.id}`))
              .map((m: { id: string; content: string; createdAt: string }) => ({
                id: `agent-${m.id}`,
                role: 'agent' as const,
                content: m.content,
                timestamp: new Date(m.createdAt),
                agentName: liveChatSession.agentName
              })) || []
            
            if (agentMessages.length > 0) {
              setMessages(prev => [...prev, ...agentMessages])
            }
          }
        } catch (error) {
          console.error('Error fetching messages:', error)
        }
      }, 3000) // Poll every 3 seconds
      
      return () => clearInterval(messageInterval)
    }
  }, [chatMode, liveChatSession?.sessionId, liveChatSession?.agentName, messages])

  // Handle initiating live chat from questionnaire
  const handleLiveChatRequest = async (data: {
    category: string
    answers: Record<string, string>
    customerName: string
    customerEmail: string
  }) => {
    setIsConnecting(true)
    setCustomerInfo({ name: data.customerName, email: data.customerEmail })
    
    try {
      const response = await fetch('/api/chat/live/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          category: data.category,
          answers: data.answers
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to request live chat')
      }
      
      const result = await response.json()
      
      setLiveChatSession({
        sessionId: result.sessionId,
        ticketNumber: result.ticketNumber,
        status: 'waiting',
        queuePosition: result.queuePosition,
        estimatedWaitMinutes: result.estimatedWaitMinutes
      })
      
      // Switch to waiting mode
      setChatMode('waiting')
      
      // Add welcome message
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        role: 'system',
        content: `Thanks ${data.customerName}! Ticket #${result.ticketNumber} created. You're #${result.queuePosition} in queue. Estimated wait: ~${result.estimatedWaitMinutes} min.`,
        timestamp: new Date()
      }])
      
    } catch (error) {
      console.error('Failed to request live chat:', error)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I couldn't connect you to a live agent right now. Please try again later or continue chatting with me!",
        timestamp: new Date()
      }])
      setChatMode('ai')
    } finally {
      setIsConnecting(false)
    }
  }

  // Handle sending message in live chat mode
  const sendLiveChatMessage = async (messageText: string) => {
    if (!messageText.trim() || !liveChatSession?.sessionId) return
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    
    try {
      await fetch(`/api/chat/live/${liveChatSession.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          content: messageText.trim(),
          senderType: 'customer'
        })
      })
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  // Handle cancelling live chat request
  const handleCancelLiveChat = () => {
    setChatMode('ai')
    setLiveChatSession(null)
    setMessages([])
  }

  // Handle ending live chat
  const handleEndLiveChat = async () => {
    if (!liveChatSession?.sessionId) return
    
    try {
      await fetch(`/api/chat/live/${liveChatSession.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' })
      })
    } catch (error) {
      console.error('Failed to close chat:', error)
    }
    
    setChatMode('ai')
    setLiveChatSession(null)
  }

  // Send message and handle streaming response
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Create placeholder for assistant message
    const assistantId = `assistant-${Date.now()}`
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }])

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText.trim(),
          conversationId,
        }),
      })

      // Get conversation ID from header
      const newConversationId = response.headers.get('X-Conversation-Id')
      if (newConversationId) {
        setConversationId(newConversationId)
      }

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let fullContent = ''
      const toolResults: Array<{ name: string; result: unknown }> = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const chunk: StreamChunk = JSON.parse(data)

              switch (chunk.type) {
                case 'text':
                  fullContent += chunk.content || ''
                  setMessages(prev => prev.map(m => 
                    m.id === assistantId 
                      ? { ...m, content: fullContent }
                      : m
                  ))
                  break

                case 'tool_start':
                  setCurrentTool(chunk.toolName || null)
                  break

                case 'tool_result':
                  setCurrentTool(null)
                  if (chunk.toolName && chunk.toolResult) {
                    toolResults.push({
                      name: chunk.toolName,
                      result: chunk.toolResult,
                    })
                  }
                  break

                case 'error':
                  // Show friendly error message without the warning icon for rate limits
                  const errorMsg = chunk.content || chunk.error || 'An error occurred'
                  if (fullContent) {
                    fullContent += `\n\n${errorMsg}`
                  } else {
                    fullContent = errorMsg
                  }
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId
                      ? { ...m, content: fullContent }
                      : m
                  ))
                  break
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // Update final message with tool results
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, toolResults: toolResults.length > 0 ? toolResults : undefined }
          : m
      ))

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: "Yo, my bad - something went wrong on my end. Try again?" }
          : m
      ))
    } finally {
      setIsLoading(false)
      setCurrentTool(null)
    }
  }, [conversationId, isLoading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (chatMode === 'live-chat') {
      sendLiveChatMessage(input)
    } else {
      sendMessage(input)
    }
  }

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt)
  }

  // Start live chat flow
  const handleStartLiveChat = () => {
    setChatMode('questionnaire')
  }

  // Go back to AI mode from questionnaire
  const handleCancelQuestionnaire = () => {
    setChatMode('ai')
  }

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2",
          "bg-black text-white px-4 py-3 rounded-full shadow-lg",
          "hover:bg-gray-800 transition-colors",
          isOpen && "hidden"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-medium">Ask Reggie</span>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] bg-[#FAF8F5] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200"
          >
            {/* Header */}
            <div className={cn(
              "text-white p-4 flex items-center justify-between",
              chatMode === 'live-chat' || chatMode === 'waiting' ? 'bg-green-600' : 'bg-black'
            )}>
              <div className="flex items-center gap-3">
                {(chatMode === 'questionnaire' || chatMode === 'waiting') && (
                  <button
                    onClick={handleCancelQuestionnaire}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  chatMode === 'live-chat' ? 'bg-white/20' : 'bg-white/10'
                )}>
                  {chatMode === 'live-chat' || chatMode === 'waiting' ? (
                    <Phone className="w-5 h-5" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">
                    {chatMode === 'questionnaire' && 'Contact Support'}
                    {chatMode === 'waiting' && 'Waiting for Agent'}
                    {chatMode === 'live-chat' && (liveChatSession?.agentName || 'Live Support')}
                    {chatMode === 'ai' && 'Reggie'}
                  </h3>
                  <p className="text-xs text-gray-300">
                    {chatMode === 'questionnaire' && 'Tell us about your issue'}
                    {chatMode === 'waiting' && `Position #${liveChatSession?.queuePosition || 1} in queue`}
                    {chatMode === 'live-chat' && 'Connected to support agent'}
                    {chatMode === 'ai' && 'Your shopping assistant'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {chatMode === 'live-chat' && (
                  <button
                    onClick={handleEndLiveChat}
                    className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors"
                  >
                    End Chat
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Questionnaire Mode */}
            {chatMode === 'questionnaire' && (
              <PreChatQuestionnaire
                customerName={customerInfo?.name}
                customerEmail={customerInfo?.email}
                onComplete={handleLiveChatRequest}
                onCancel={handleCancelQuestionnaire}
                isSubmitting={isConnecting}
              />
            )}

            {/* Waiting Mode */}
            {chatMode === 'waiting' && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-green-600 animate-pulse" />
                </div>
                <h4 className="font-semibold text-lg mb-2">Connecting you with an agent...</h4>
                <p className="text-gray-600 text-sm mb-4">
                  You&apos;re #{liveChatSession?.queuePosition || 1} in the queue.
                  <br />
                  Estimated wait: ~{liveChatSession?.estimatedWaitMinutes || 5} minutes
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  Ticket #{liveChatSession?.ticketNumber}
                </p>
                <button
                  onClick={handleCancelLiveChat}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel and return to Reggie
                </button>
              </div>
            )}

            {/* AI Chat or Live Chat Messages */}
            {(chatMode === 'ai' || chatMode === 'live-chat') && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col justify-center">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h4 className="font-semibold text-lg">Hey! I&apos;m Reggie 👋</h4>
                    <p className="text-gray-600 text-sm mt-1">
                      Your personal streetwear guide. How can I help?
                    </p>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="space-y-2">
                    {QUICK_ACTIONS.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickAction(action.prompt)}
                        className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-black transition-colors text-left"
                      >
                        <action.icon className="w-5 h-5 text-gray-600" />
                        <span className="text-sm">{action.label}</span>
                      </button>
                    ))}
                    
                    {/* Talk to Live Agent Option */}
                    <button
                      onClick={handleStartLiveChat}
                      className="w-full flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200 hover:border-green-400 transition-colors text-left"
                    >
                      <MessageCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <span className="text-sm font-medium text-green-700">Talk to Live Agent</span>
                        <p className="text-xs text-green-600">Connect with support team</p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        message.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      {(message.role === 'assistant' || message.role === 'agent') && (
                        <div className={cn(
                          "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center",
                          message.role === 'agent' ? "bg-green-600" : "bg-black"
                        )}>
                          {message.role === 'agent' ? (
                            <User className="w-4 h-4 text-white" />
                          ) : (
                            <Sparkles className="w-4 h-4 text-white" />
                          )}
                        </div>
                      )}
                      
                      {message.role === 'system' ? (
                        <div className="w-full text-center">
                          <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {message.content}
                          </span>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2",
                            message.role === 'user'
                              ? "bg-black text-white"
                              : message.role === 'agent'
                              ? "bg-green-50 border border-green-200"
                              : "bg-white border border-gray-200"
                          )}
                        >
                          {message.role === 'agent' && message.agentName && (
                            <p className="text-xs text-green-600 font-medium mb-1">{message.agentName}</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          
                          {/* Tool Results */}
                          {message.toolResults && message.toolResults.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {message.toolResults.map((tool, i) => (
                                <ToolResultDisplay key={i} name={tool.name} result={tool.result} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {message.role === 'user' && (
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Talk to agent option in AI chat when there are messages */}
                  {chatMode === 'ai' && messages.length > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={handleStartLiveChat}
                        className="w-full flex items-center justify-center gap-2 p-2 text-xs text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Need more help? Talk to a live agent
                      </button>
                    </div>
                  )}
                </>
              )}
              
              {/* Loading indicator */}
              {isLoading && currentTool && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Looking up {currentTool.replace(/([A-Z])/g, ' $1').toLowerCase()}...</span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={chatMode === 'live-chat' ? "Type a message..." : "Ask me anything..."}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-full border border-gray-200 focus:outline-none focus:border-black transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "p-2 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    chatMode === 'live-chat' ? "bg-green-600 hover:bg-green-700" : "bg-black hover:bg-gray-800"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Tool result display component with interactive cards
function ToolResultDisplay({ name, result }: { name: string; result: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const resultObj = result as Record<string, unknown>
  
  // Product Cards - for searchProducts, getProductDetails, getRecommendations
  if ((name === 'searchProducts' || name === 'getRecommendations') && resultObj.products) {
    const products = resultObj.products as Array<{
      id: string
      name: string
      price: number
      images?: string[]
      inStock: boolean
      category?: string
    }>
    
    if (products.length === 0) return null
    
    return (
      <div className="mt-3 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
          {products.slice(0, 6).map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
        {products.length > 6 && (
          <Link 
            href="/products" 
            className="text-xs text-gray-500 hover:text-black flex items-center gap-1"
          >
            View all {products.length} products <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
    )
  }

  // Single Product Detail Card
  if (name === 'getProductDetails' && resultObj.product) {
    const product = resultObj.product as {
      id: string
      name: string
      price: number
      description?: string
      images?: string[]
      inStock: boolean
      variants?: Array<{ id: string; size: string; color: string; inventory: number }>
    }
    
    return (
      <div className="mt-3">
        <ProductCard product={product} detailed />
      </div>
    )
  }

  // Limited Drops Cards
  if (name === 'getLimitedDrops' && resultObj.drops) {
    const drops = resultObj.drops as Array<{
      id: string
      name: string
      price: number
      images?: string[]
      releaseDate?: string
      dropEndDate?: string
      stockRemaining?: number
      maxQuantity?: number
    }>
    
    if (drops.length === 0) return null
    
    return (
      <div className="mt-3 space-y-2">
        {drops.slice(0, 3).map((drop) => (
          <DropCard key={drop.id} drop={drop} />
        ))}
      </div>
    )
  }

  // Order Status Card
  if (name === 'getOrderStatus' && resultObj.order) {
    const order = resultObj.order as {
      id: string
      orderNumber: string
      status: string
      total: number
      trackingNumber?: string
      createdAt?: string
      items?: Array<{ name: string; quantity: number; price: number }>
    }
    
    return (
      <div className="mt-3">
        <OrderCard order={order} />
      </div>
    )
  }

  // Order History Cards
  if (name === 'getOrderHistory' && resultObj.orders) {
    const orders = resultObj.orders as Array<{
      id: string
      orderNumber: string
      status: string
      total: number
      createdAt?: string
    }>
    
    if (orders.length === 0) return null
    
    return (
      <div className="mt-3 space-y-2">
        {orders.slice(0, 5).map((order) => (
          <OrderCard key={order.id} order={order} compact />
        ))}
      </div>
    )
  }

  // Rewards Cards
  if (name === 'getAvailableRewards' && resultObj.rewards) {
    const rewards = resultObj.rewards as Array<{
      id: string
      name: string
      description: string
      pointsCost: number
      rewardType: string
      value?: number
    }>
    
    if (rewards.length === 0) return null
    
    return (
      <div className="mt-3 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
          {rewards.map((reward) => (
            <RewardCard key={reward.id} reward={reward} />
          ))}
        </div>
      </div>
    )
  }

  // Loyalty Status Card
  if (name === 'getLoyaltyStatus' && resultObj.loyalty) {
    const loyalty = resultObj.loyalty as {
      points: number
      tier: string
      tierProgress?: number
      nextTier?: string
      pointsToNextTier?: number
    }
    
    return (
      <div className="mt-3">
        <LoyaltyCard loyalty={loyalty} />
      </div>
    )
  }

  // Referral Code Card
  if (name === 'getReferralCode' && resultObj.referralCode) {
    const referral = resultObj.referralCode as {
      code: string
      discount: number
      referrerBonus: number
    }
    
    return (
      <div className="mt-3">
        <ReferralCard referral={referral} />
      </div>
    )
  }

  // Support Ticket Card
  if ((name === 'createSupportTicket' || name === 'getTicketStatus') && resultObj.ticket) {
    const ticket = resultObj.ticket as {
      id: string
      ticketNumber?: string
      subject: string
      status: string
      priority?: string
      createdAt?: string
    }
    
    return (
      <div className="mt-3">
        <TicketCard ticket={ticket} />
      </div>
    )
  }

  // Cart Card
  if (name === 'getCart' && resultObj.cart) {
    const cart = resultObj.cart as {
      items: Array<{
        productId: string
        productName: string
        quantity: number
        price: number
        image?: string
      }>
      total: number
      itemCount: number
    }
    
    return (
      <div className="mt-3">
        <CartCard cart={cart} />
      </div>
    )
  }

  // Default: collapsible JSON view for unknown tools
  if (!resultObj.success) return null
  
  return (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mt-2"
    >
      <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-180")} />
      {isExpanded ? 'Hide details' : 'Show details'}
      {isExpanded && (
        <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32 text-left">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </button>
  )
}

// Product Card Component
function ProductCard({ 
  product, 
  compact = false,
  detailed = false 
}: { 
  product: {
    id: string
    name: string
    price: number
    description?: string
    images?: string[]
    inStock: boolean
    category?: string
    variants?: Array<{ id: string; size: string; color: string; inventory: number }>
  }
  compact?: boolean
  detailed?: boolean
}) {
  const imageUrl = product.images?.[0] || '/placeholder-product.jpg'

  if (compact) {
    return (
      <div className="flex-shrink-0 w-32 bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-black transition-colors">
        <Link href={`/products/${product.id}`}>
          <div className="aspect-square bg-gray-100 relative">
            <Image 
              src={imageUrl} 
              alt={product.name} 
              fill
              className="object-cover"
            />
            {!product.inStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-xs font-medium">Sold Out</span>
              </div>
            )}
          </div>
          <div className="p-2">
            <p className="text-xs font-medium truncate">{product.name}</p>
            <p className="text-xs text-gray-600">${product.price}</p>
          </div>
        </Link>
        {product.inStock && (
          <div className="px-2 pb-2">
            <Link
              href={`/products/${product.id}`}
              className="block w-full py-1 text-xs bg-black text-white rounded hover:bg-gray-800 transition-colors text-center"
            >
              <span className="flex items-center justify-center gap-1">
                <ShoppingCart className="w-3 h-3" />
                View
              </span>
            </Link>
          </div>
        )}
      </div>
    )
  }

  if (detailed) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex gap-3 p-3">
          <Link href={`/products/${product.id}`} className="flex-shrink-0">
            <div className="w-20 h-20 bg-gray-100 rounded relative">
              <Image 
                src={imageUrl} 
                alt={product.name} 
                fill
                className="object-cover rounded"
              />
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/products/${product.id}`}>
              <h4 className="font-medium text-sm hover:underline">{product.name}</h4>
            </Link>
            <p className="text-sm text-gray-600 mt-0.5">${product.price}</p>
            {product.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
            )}
            {product.variants && product.variants.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {product.variants.length} variants available
              </p>
            )}
          </div>
        </div>
        <div className="px-3 pb-3 flex gap-2">
          <Link 
            href={`/products/${product.id}`}
            className="flex-1 py-1.5 text-xs text-center border border-gray-200 rounded hover:border-black transition-colors"
          >
            View Details
          </Link>
          {product.inStock && (
            <Link
              href={`/products/${product.id}`}
              className="flex-1 py-1.5 text-xs bg-black text-white rounded hover:bg-gray-800 transition-colors flex items-center justify-center gap-1"
            >
              <ShoppingCart className="w-3 h-3" />
              Shop Now
            </Link>
          )}
        </div>
      </div>
    )
  }

  return null
}

// Limited Drop Card
function DropCard({ drop }: { 
  drop: {
    id: string
    name: string
    price: number
    images?: string[]
    releaseDate?: string
    dropEndDate?: string
    stockRemaining?: number
    maxQuantity?: number
  }
}) {
  const imageUrl = drop.images?.[0] || '/placeholder-product.jpg'
  const stockPercent = drop.maxQuantity ? ((drop.stockRemaining || 0) / drop.maxQuantity) * 100 : 100
  const isLive = drop.releaseDate && new Date(drop.releaseDate) <= new Date()
  
  return (
    <Link href={`/products/${drop.id}`}>
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-0.5">
        <div className="bg-white rounded-lg p-3 flex gap-3">
          <div className="w-16 h-16 bg-gray-100 rounded relative flex-shrink-0">
            <Image src={imageUrl} alt={drop.name} fill className="object-cover rounded" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm truncate">{drop.name}</h4>
              {isLive && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded animate-pulse">
                  LIVE
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">${drop.price}</p>
            {drop.maxQuantity && (
              <div className="mt-1.5">
                <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                  <span>{drop.stockRemaining || 0} left</span>
                  <span>{Math.round(stockPercent)}% remaining</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                    style={{ width: `${stockPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// Order Card
function OrderCard({ order, compact = false }: { 
  order: {
    id: string
    orderNumber: string
    status: string
    total: number
    trackingNumber?: string
    createdAt?: string
    items?: Array<{ name: string; quantity: number; price: number }>
  }
  compact?: boolean
}) {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  }

  if (compact) {
    return (
      <Link href={`/account/orders/${order.id}`}>
        <div className="bg-white rounded-lg border border-gray-200 p-3 hover:border-black transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500">Order #{order.orderNumber}</p>
              <span className={cn(
                "inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium",
                statusColors[order.status] || 'bg-gray-100 text-gray-800'
              )}>
                {order.status}
              </span>
            </div>
            <p className="text-sm font-medium">${order.total.toFixed(2)}</p>
          </div>
          {order.createdAt && (
            <p className="text-[10px] text-gray-400 mt-2">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </Link>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-3 border-b border-gray-100">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-500">Order #{order.orderNumber}</p>
            <span className={cn(
              "inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium",
              statusColors[order.status] || 'bg-gray-100 text-gray-800'
            )}>
              {order.status}
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">${order.total.toFixed(2)}</p>
            {order.createdAt && (
              <p className="text-[10px] text-gray-400">
                {new Date(order.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {order.trackingNumber && (
        <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">Tracking: {order.trackingNumber}</span>
          </div>
          <ExternalLink className="w-3 h-3 text-gray-400" />
        </div>
      )}
      
      {order.items && order.items.length > 0 && (
        <div className="p-3">
          <p className="text-xs text-gray-500 mb-2">{order.items.length} item(s)</p>
          {order.items.slice(0, 3).map((item, i) => (
            <div key={i} className="flex justify-between text-xs py-1">
              <span className="text-gray-600">{item.name} × {item.quantity}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="px-3 pb-3">
        <Link 
          href={`/account/orders/${order.id}`}
          className="block w-full py-1.5 text-xs text-center border border-gray-200 rounded hover:border-black transition-colors"
        >
          View Order Details
        </Link>
      </div>
    </div>
  )
}

// Reward Card
function RewardCard({ reward }: { 
  reward: {
    id: string
    name: string
    description: string
    pointsCost: number
    rewardType: string
    value?: number
  }
}) {
  const typeIcons: Record<string, typeof Gift> = {
    DISCOUNT: Gift,
    FREE_SHIPPING: Package,
    EARLY_ACCESS: Star,
    EXCLUSIVE_PRODUCT: Award,
    CHARITY_DONATION: Gift,
    DIGITAL_CONTENT: Gift,
    PHYSICAL_PERK: Gift,
  }
  const Icon = typeIcons[reward.rewardType] || Gift
  
  const typeColors: Record<string, string> = {
    DISCOUNT: 'from-green-400 to-emerald-500',
    FREE_SHIPPING: 'from-blue-400 to-cyan-500',
    EARLY_ACCESS: 'from-purple-400 to-pink-500',
    EXCLUSIVE_PRODUCT: 'from-yellow-400 to-orange-500',
    CHARITY_DONATION: 'from-pink-400 to-rose-500',
    DIGITAL_CONTENT: 'from-indigo-400 to-purple-500',
    PHYSICAL_PERK: 'from-amber-400 to-yellow-500',
  }
  const gradient = typeColors[reward.rewardType] || 'from-gray-400 to-gray-500'

  return (
    <div className="flex-shrink-0 w-44 bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className={cn("h-2 bg-gradient-to-r", gradient)} />
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className={cn("p-1.5 rounded bg-gradient-to-br", gradient)}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-medium leading-tight">{reward.name}</h4>
            <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{reward.description}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-900">{reward.pointsCost} pts</span>
          <Link
            href="/loyalty/rewards"
            className="px-2 py-1 text-[10px] bg-black text-white rounded hover:bg-gray-800 transition-colors"
          >
            Redeem
          </Link>
        </div>
      </div>
    </div>
  )
}

// Loyalty Status Card
function LoyaltyCard({ loyalty }: { 
  loyalty: {
    points: number
    tier: string
    tierProgress?: number
    nextTier?: string
    pointsToNextTier?: number
  }
}) {
  const tierColors: Record<string, string> = {
    BRONZE: 'from-amber-600 to-yellow-700',
    SILVER: 'from-gray-400 to-gray-500',
    GOLD: 'from-yellow-400 to-amber-500',
    PLATINUM: 'from-purple-400 to-indigo-500',
  }
  const gradient = tierColors[loyalty.tier] || 'from-gray-400 to-gray-500'

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className={cn("p-3 bg-gradient-to-r text-white", gradient)}>
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5" />
          <span className="font-bold text-sm">{loyalty.tier} Member</span>
        </div>
        <p className="text-2xl font-bold mt-1">{loyalty.points.toLocaleString()} pts</p>
      </div>
      
      {loyalty.nextTier && loyalty.pointsToNextTier && (
        <div className="p-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Progress to {loyalty.nextTier}</span>
            <span>{loyalty.pointsToNextTier} pts to go</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={cn("h-full bg-gradient-to-r transition-all", gradient)}
              style={{ width: `${loyalty.tierProgress || 0}%` }}
            />
          </div>
        </div>
      )}
      
      <div className="px-3 pb-3">
        <Link 
          href="/loyalty"
          className="block w-full py-1.5 text-xs text-center border border-gray-200 rounded hover:border-black transition-colors"
        >
          View Rewards
        </Link>
      </div>
    </div>
  )
}

// Referral Card
function ReferralCard({ referral }: { 
  referral: {
    code: string
    discount: number
    referrerBonus: number
  }
}) {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(referral.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-0.5">
      <div className="bg-white rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Share2 className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">Your Referral Code</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded px-3 py-2">
            <code className="text-sm font-mono font-bold">{referral.code}</code>
          </div>
          <button
            onClick={copyCode}
            className="p-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        
        <div className="mt-3 flex gap-4 text-xs text-gray-600">
          <div>
            <span className="font-medium text-black">{referral.discount}% off</span>
            <span> for friends</span>
          </div>
          <div>
            <span className="font-medium text-black">{referral.referrerBonus} pts</span>
            <span> for you</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Support Ticket Card
function TicketCard({ ticket }: { 
  ticket: {
    id: string
    ticketNumber?: string
    subject: string
    status: string
    priority?: string
    createdAt?: string
  }
}) {
  const statusColors: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    WAITING_CUSTOMER: 'bg-orange-100 text-orange-800',
    RESOLVED: 'bg-green-100 text-green-800',
    CLOSED: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-start gap-2">
        <div className="p-1.5 bg-blue-100 rounded">
          <Ticket className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-medium">{ticket.subject}</h4>
              {ticket.ticketNumber && (
                <p className="text-[10px] text-gray-500">#{ticket.ticketNumber}</p>
              )}
            </div>
            <span className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0",
              statusColors[ticket.status] || 'bg-gray-100 text-gray-800'
            )}>
              {ticket.status.replace('_', ' ')}
            </span>
          </div>
          {ticket.createdAt && (
            <p className="text-[10px] text-gray-400 mt-1">
              Created {new Date(ticket.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Cart Card
function CartCard({ cart }: { 
  cart: {
    items: Array<{
      productId: string
      productName: string
      quantity: number
      price: number
      image?: string
    }>
    total: number
    itemCount: number
  }
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          <span className="text-sm font-medium">Your Cart</span>
        </div>
        <span className="text-xs text-gray-500">{cart.itemCount} item(s)</span>
      </div>
      
      <div className="p-3 space-y-2">
        {cart.items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            {item.image && (
              <div className="w-10 h-10 bg-gray-100 rounded relative flex-shrink-0">
                <Image src={item.image} alt={item.productName} fill className="object-cover rounded" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{item.productName}</p>
              <p className="text-[10px] text-gray-500">Qty: {item.quantity}</p>
            </div>
            <p className="text-xs font-medium">${(item.price * item.quantity).toFixed(2)}</p>
          </div>
        ))}
        
        {cart.items.length > 3 && (
          <p className="text-[10px] text-gray-500">+{cart.items.length - 3} more item(s)</p>
        )}
      </div>
      
      <div className="p-3 border-t border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Total</span>
          <span className="text-sm font-bold">${cart.total.toFixed(2)}</span>
        </div>
        <Link 
          href="/checkout"
          className="block w-full py-2 text-xs text-center bg-black text-white rounded hover:bg-gray-800 transition-colors"
        >
          Checkout
        </Link>
      </div>
    </div>
  )
}
