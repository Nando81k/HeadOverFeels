import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'
import { streamAdminResponse, AdminContext } from '@/lib/ai/agents/admin-agent'
import { getOrCreateAdminConversation, saveUserMessage } from '@/lib/ai/memory'
import { checkRateLimit, rateLimitResponse } from '@/lib/security/rateLimit'
import { AI_RATE_LIMITS } from '@/lib/ai/config'

const ONE_MINUTE_MS = 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Admin Chat API
 *
 * Streams responses from Reggie AI for admin-facing interactions.
 * Requires admin authentication.
 */

export async function POST(request: NextRequest) {
  try {
    // Verify admin session
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = await prisma.adminUser.findUnique({
      where: { email: session.user.email },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Rate limit by admin ID — before any AI call
    const minuteCheck = await checkRateLimit(
      `ai:admin-chat:min:${admin.id}`,
      AI_RATE_LIMITS.adminChat.perMinute,
      ONE_MINUTE_MS
    )
    if (!minuteCheck.allowed) {
      return rateLimitResponse(minuteCheck.retryAfter)
    }
    const dayCheck = await checkRateLimit(
      `ai:admin-chat:day:${admin.id}`,
      AI_RATE_LIMITS.adminChat.perDay,
      ONE_DAY_MS
    )
    if (!dayCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { 
      message, 
      conversationId: providedConversationId,
      currentPage = '/admin',
      pageContext = {},
    } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get or create conversation
    const conversationId = providedConversationId || await getOrCreateAdminConversation(admin.id)

    // Verify conversation belongs to this admin
    if (providedConversationId) {
      const conversation = await prisma.aiConversation.findUnique({
        where: { id: providedConversationId },
      })
      if (conversation && conversation.adminId && conversation.adminId !== admin.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }
    }

    // Save user message
    await saveUserMessage(conversationId, message)

    // Build admin context
    const context: AdminContext = {
      adminId: admin.id,
      adminName: admin.name,
      adminEmail: admin.email,
      currentPage,
      pageContext,
    }

    // Create streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = streamAdminResponse(message, conversationId, context)

          for await (const chunk of generator) {
            const data = JSON.stringify(chunk) + '\n'
            controller.enqueue(encoder.encode(`data: ${data}\n`))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Admin stream error:', error)
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
    console.error('Admin chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process admin chat message' },
      { status: 500 }
    )
  }
}

/**
 * Get admin conversation history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = await prisma.adminUser.findUnique({
      where: { email: session.user.email },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      // Return list of admin's conversations
      const conversations = await prisma.aiConversation.findMany({
        where: { adminId: admin.id },
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
    const messages = await prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })

    return NextResponse.json({
      conversationId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : null,
        toolResults: m.toolResults ? JSON.parse(m.toolResults) : null,
        createdAt: m.createdAt,
      })),
    })
  } catch (error) {
    console.error('Admin chat history error:', error)
    return NextResponse.json(
      { error: 'Failed to load admin chat history' },
      { status: 500 }
    )
  }
}
