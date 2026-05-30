import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'
import { streamCustomerResponse } from '@/lib/ai/agents/customer-agent'
import {
  getOrCreateCustomerConversation,
  saveUserMessage,
  loadConversationHistory
} from '@/lib/ai/memory'
import { checkRateLimit, rateLimitResponse, getClientIdentifier } from '@/lib/security/rateLimit'
import { AI_RATE_LIMITS } from '@/lib/ai/config'

const ONE_MINUTE_MS = 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Customer Chat API
 *
 * Streams responses from Reggie AI for customer-facing interactions.
 * Supports authenticated customers and guest users.
 */

export async function POST(request: NextRequest) {
  // Rate limit before any AI call — keyed by session user ID or IP fallback
  const session = await auth()
  const ip = getClientIdentifier(request.headers)
  const identifier = session?.user?.email ?? ip

  const minuteCheck = await checkRateLimit(
    `ai:customer-chat:min:${identifier}`,
    AI_RATE_LIMITS.customerChat.perMinute,
    ONE_MINUTE_MS
  )
  if (!minuteCheck.allowed) {
    return rateLimitResponse(minuteCheck.retryAfter)
  }
  const dayCheck = await checkRateLimit(
    `ai:customer-chat:day:${identifier}`,
    AI_RATE_LIMITS.customerChat.perDay,
    ONE_DAY_MS
  )
  if (!dayCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const { message, conversationId: providedConversationId } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get customer from session if logged in
    // (session already resolved above for rate-limit key)
    let customerId: string | undefined
    let customerEmail: string | undefined

    if (session?.user?.email) {
      const customer = await prisma.customer.findUnique({
        where: { email: session.user.email },
      })
      if (customer) {
        customerId = customer.id
        customerEmail = customer.email
      }
    }

    // Get or create conversation
    const conversationId = providedConversationId || await getOrCreateCustomerConversation(customerId)

    // Verify conversation belongs to this customer (if logged in)
    if (providedConversationId && customerId) {
      const conversation = await prisma.aiConversation.findUnique({
        where: { id: providedConversationId },
      })
      if (conversation && conversation.customerId && conversation.customerId !== customerId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }
    }

    // Save user message
    await saveUserMessage(conversationId, message)

    // Load conversation history and convert to Gemini format
    const history = await loadConversationHistory(conversationId)
    const conversationHistory = history
      .filter(m => m.role === 'USER' || m.role === 'ASSISTANT')
      .map(m => ({
        role: m.role === 'USER' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }))
    // Remove the last message (we'll add it fresh)
    if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'user') {
      conversationHistory.pop()
    }

    // Create streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = streamCustomerResponse({
            customerId,
            customerEmail,
            conversationHistory,
            message,
          })

          for await (const chunk of generator) {
            const data = JSON.stringify(chunk) + '\n'
            controller.enqueue(encoder.encode(`data: ${data}\n`))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          const errorData = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Stream failed',
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': conversationId,
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

/**
 * Get conversation history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      // Return list of conversations for logged-in user
      const session = await auth()
      if (!session?.user?.email) {
        return NextResponse.json({ conversations: [] })
      }

      const customer = await prisma.customer.findUnique({
        where: { email: session.user.email },
      })

      if (!customer) {
        return NextResponse.json({ conversations: [] })
      }

      const conversations = await prisma.aiConversation.findMany({
        where: { customerId: customer.id },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { messages: true } },
        },
      })

      return NextResponse.json({
        conversations: conversations.map(c => ({
          id: c.id,
          title: c.title,
          messageCount: c._count.messages,
          lastMessage: c.messages[0]?.content.slice(0, 100) || '',
          updatedAt: c.updatedAt,
        })),
      })
    }

    // Return messages for specific conversation
    const messages = await loadConversationHistory(conversationId)
    
    return NextResponse.json({
      conversationId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    })
  } catch (error) {
    console.error('Chat history error:', error)
    return NextResponse.json(
      { error: 'Failed to load chat history' },
      { status: 500 }
    )
  }
}
