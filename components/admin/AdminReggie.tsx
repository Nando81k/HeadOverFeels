'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Send, 
  Loader2, 
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Check,
  XCircle,
  Clock,
  BarChart3,
  Package,
  Users,
  Ticket,
  MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePathname } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolResults?: Array<{
    name: string
    result: unknown
  }>
  pendingAction?: {
    id: string
    actionType: string
    description: string
    payload: unknown
    expiresAt: Date
  }
  timestamp: Date
}

interface StreamChunk {
  type: 'text' | 'tool_start' | 'tool_result' | 'confirmation_required' | 'error' | 'done'
  content?: string
  toolName?: string
  toolResult?: unknown
  pendingAction?: {
    id: string
    actionType: string
    description: string
    payload: unknown
    expiresAt: Date
  }
  error?: string
}

// Context-aware suggestions based on current page
const PAGE_SUGGESTIONS: Record<string, Array<{ label: string; prompt: string }>> = {
  '/admin': [
    { label: "Today's summary", prompt: 'Give me a quick summary of today - orders, revenue, any issues?' },
    { label: 'Check urgent items', prompt: 'Show me anything urgent that needs attention' },
    { label: 'Low stock alerts', prompt: 'Which products are running low on stock?' },
  ],
  '/admin/orders': [
    { label: 'Recent orders', prompt: 'Show me the most recent orders' },
    { label: 'Pending shipments', prompt: 'Which orders are still waiting to ship?' },
    { label: 'Refund requests', prompt: 'Are there any orders needing refunds?' },
  ],
  '/admin/customers': [
    { label: 'Top customers', prompt: 'Who are our top customers by order count?' },
    { label: 'New customers', prompt: 'Show me customers who signed up this week' },
    { label: 'Loyalty tiers', prompt: 'How are customers distributed across loyalty tiers?' },
  ],
  '/admin/support': [
    { label: 'Open tickets', prompt: 'Show me all open support tickets' },
    { label: 'Urgent issues', prompt: 'Are there any high priority tickets?' },
    { label: 'Unassigned tickets', prompt: 'Which tickets need to be assigned?' },
  ],
  '/admin/products': [
    { label: 'Low stock', prompt: 'Which products are low on inventory?' },
    { label: 'Top sellers', prompt: 'What are our best selling products this month?' },
    { label: 'Out of stock', prompt: 'Show me all out of stock items' },
  ],
}

export default function AdminReggie() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const [pendingActions, setPendingActions] = useState<Map<string, Message['pendingAction']>>(new Map())
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()

  // Get suggestions for current page
  const currentSuggestions = PAGE_SUGGESTIONS[pathname] || PAGE_SUGGESTIONS['/admin']

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

  // Handle confirmation/rejection of pending actions
  const handleActionResponse = async (actionId: string, action: 'confirm' | 'reject') => {
    try {
      const response = await fetch('/api/ai/admin/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingActionId: actionId,
          action,
          currentPage: pathname,
        }),
      })

      const data = await response.json()

      // Remove from pending actions
      setPendingActions(prev => {
        const next = new Map(prev)
        next.delete(actionId)
        return next
      })

      // Add result message
      const resultMessage: Message = {
        id: `result-${Date.now()}`,
        role: 'assistant',
        content: action === 'confirm' 
          ? `✅ Action completed successfully.\n\n${JSON.stringify(data.result, null, 2)}`
          : '❌ Action cancelled.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, resultMessage])
    } catch (error) {
      console.error('Action response error:', error)
    }
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

    const assistantId = `assistant-${Date.now()}`
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }])

    try {
      const response = await fetch('/api/ai/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText.trim(),
          conversationId,
          currentPage: pathname,
          pageContext: {}, // Could extract context from page
        }),
      })

      const newConversationId = response.headers.get('X-Conversation-Id')
      if (newConversationId) {
        setConversationId(newConversationId)
      }

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let fullContent = ''
      const toolResults: Array<{ name: string; result: unknown }> = []
      let messagePendingAction: Message['pendingAction'] | undefined

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

                case 'confirmation_required':
                  if (chunk.pendingAction) {
                    messagePendingAction = chunk.pendingAction
                    setPendingActions(prev => {
                      const next = new Map(prev)
                      next.set(chunk.pendingAction!.id, chunk.pendingAction!)
                      return next
                    })
                  }
                  break

                case 'error':
                  fullContent += `\n\n⚠️ ${chunk.error || 'An error occurred'}`
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

      // Update final message
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { 
              ...m, 
              toolResults: toolResults.length > 0 ? toolResults : undefined,
              pendingAction: messagePendingAction,
            }
          : m
      ))

    } catch (error) {
      console.error('Admin chat error:', error)
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
          : m
      ))
    } finally {
      setIsLoading(false)
      setCurrentTool(null)
    }
  }, [conversationId, isLoading, pathname])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  // Get page-specific icon
  const getPageIcon = () => {
    if (pathname.includes('orders')) return Package
    if (pathname.includes('customers')) return Users
    if (pathname.includes('support')) return Ticket
    if (pathname.includes('analytics')) return BarChart3
    return MessageSquare
  }
  const PageIcon = getPageIcon()

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex items-center gap-2",
          "bg-black text-white px-4 py-3 rounded-full shadow-lg",
          "hover:bg-gray-800 transition-colors"
        )}
      >
        {isOpen ? (
          <>
            <X className="w-5 h-5" />
            <span className="font-medium">Close</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">Reggie AI</span>
          </>
        )}
      </button>

      {/* Side Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-[420px] bg-[#FAF8F5] z-30 shadow-2xl flex flex-col border-l border-gray-200"
          >
            {/* Header */}
            <div className="bg-black text-white p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Reggie</h3>
                  <div className="flex items-center gap-1 text-xs text-gray-300">
                    <PageIcon className="w-3 h-3" />
                    <span>Viewing {pathname.split('/').pop() || 'Dashboard'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <h4 className="font-medium">Hey! How can I help?</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Based on your current page, you might want to:
                    </p>
                  </div>
                  
                  {/* Context-aware suggestions */}
                  <div className="space-y-2">
                    {currentSuggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(suggestion.prompt)}
                        className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-black transition-colors text-left"
                      >
                        <span className="text-sm">{suggestion.label}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 bg-black rounded-full flex-shrink-0 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2",
                        message.role === 'user'
                          ? "bg-black text-white"
                          : "bg-white border border-gray-200"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {/* Tool Results */}
                      {message.toolResults && message.toolResults.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.toolResults.map((tool, i) => (
                            <AdminToolResult key={i} name={tool.name} result={tool.result} />
                          ))}
                        </div>
                      )}
                      
                      {/* Pending Action Confirmation */}
                      {message.pendingAction && pendingActions.has(message.pendingAction.id) && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-start gap-2 mb-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-yellow-800">
                                Confirmation Required
                              </p>
                              <p className="text-xs text-yellow-700 mt-1">
                                {message.pendingAction.description}
                              </p>
                              <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Expires in 5 minutes
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleActionResponse(message.pendingAction!.id, 'confirm')}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                              Confirm
                            </button>
                            <button
                              onClick={() => handleActionResponse(message.pendingAction!.id, 'reject')}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {/* Loading indicator */}
              {isLoading && currentTool && (
                <div className="flex items-center gap-2 text-sm text-gray-500 px-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running {currentTool.replace(/([A-Z])/g, ' $1').toLowerCase()}...</span>
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
                  placeholder="Ask Reggie anything..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-full border border-gray-200 focus:outline-none focus:border-black transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Admin tool result display
function AdminToolResult({ name, result }: { name: string; result: unknown }) {
  const resultObj = result as Record<string, unknown>

  // Daily summary
  if (name === 'getDailySummary' && resultObj.summary) {
    const summary = resultObj.summary as {
      ordersToday: number
      revenueToday: number
      newCustomers: number
      openTickets: number
      lowStockItems: number
    }
    
    return (
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold">{summary.ordersToday}</p>
          <p className="text-xs text-gray-500">Orders</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold">${summary.revenueToday}</p>
          <p className="text-xs text-gray-500">Revenue</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold">{summary.openTickets}</p>
          <p className="text-xs text-gray-500">Tickets</p>
        </div>
      </div>
    )
  }

  // Orders list
  if (name === 'listOrders' && resultObj.orders) {
    const orders = resultObj.orders as Array<{
      orderNumber: string
      status: string
      total: number
      customerName: string
    }>
    
    return (
      <div className="space-y-2">
        {orders.slice(0, 5).map((order) => (
          <div key={order.orderNumber} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
            <div>
              <p className="text-sm font-medium">#{order.orderNumber}</p>
              <p className="text-xs text-gray-500">{order.customerName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">${order.total}</p>
              <p className="text-xs text-gray-500">{order.status}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Low stock alerts
  if (name === 'getLowStockAlerts' && resultObj.alerts) {
    const alerts = resultObj.alerts as {
      lowStock: Array<{
        productName: string
        sku: string
        currentStock: number
        status: string
      }>
    }
    
    return (
      <div className="space-y-2">
        {alerts.lowStock.slice(0, 5).map((item) => (
          <div key={item.sku} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
            <div>
              <p className="text-sm font-medium">{item.productName}</p>
              <p className="text-xs text-gray-500">{item.sku}</p>
            </div>
            <div className={cn(
              "px-2 py-1 rounded text-xs font-medium",
              item.status === 'critical' ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
            )}>
              {item.currentStock} left
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Default: JSON preview
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
        View raw result
      </summary>
      <pre className="mt-1 bg-gray-50 p-2 rounded overflow-auto max-h-32 text-xs">
        {JSON.stringify(result, null, 2)}
      </pre>
    </details>
  )
}
