/**
 * Live Chat Request API
 * 
 * POST /api/chat/live/request
 * 
 * Customer initiates a live chat session after completing the pre-chat questionnaire.
 * Creates a SupportTicket and LiveChatSession, returns session info for Socket.IO connection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/auth';
import { v4 as uuidv4 } from 'uuid';
import { 
  QUESTIONNAIRE_FLOWS, 
  mapAnswersToTicketFields 
} from '@/lib/support/questionnaire-flows';

interface RequestBody {
  category: string;
  answers: Record<string, string>;
  customerName?: string;
  customerEmail?: string;
}

// Generate ticket number: TKT-YYYY-XXXXXX
function generateTicketNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TKT-${year}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { category, answers, customerName, customerEmail } = body;

    // Validate required fields
    if (!category || !answers) {
      return NextResponse.json(
        { error: 'Category and answers are required' },
        { status: 400 }
      );
    }

    // Get the flow for this category
    const flow = QUESTIONNAIRE_FLOWS[category];
    if (!flow) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    // Check for authenticated customer
    const session = await auth();
    let customerId: string | null = null;
    let finalCustomerName = customerName || 'Guest';
    let finalCustomerEmail = customerEmail || '';

    if (session?.user?.email) {
      // Look up customer by email
      const customer = await prisma.customer.findUnique({
        where: { email: session.user.email },
        select: { id: true, name: true, email: true }
      });

      if (customer) {
        customerId = customer.id;
        finalCustomerName = customer.name || finalCustomerName;
        finalCustomerEmail = customer.email;
      }
    }

    // Require email for guest users
    if (!customerId && !finalCustomerEmail) {
      return NextResponse.json(
        { error: 'Email is required for guest users' },
        { status: 400 }
      );
    }

    // Map questionnaire answers to ticket fields
    const ticketFields = mapAnswersToTicketFields(flow, answers);
    const summary = flow.generateSummary(answers);
    const priority = flow.getPriority(answers);

    // Map category to ticket type
    const ticketTypeMap: Record<string, string> = {
      order: 'ORDER_ISSUE',
      shipping: 'SHIPPING_ISSUE',
      return: 'RETURN',
      payment: 'PAYMENT_ISSUE',
      product: 'PRODUCT_QUESTION',
      loyalty: 'GENERAL',
      account: 'GENERAL',
      other: 'GENERAL',
    };
    const ticketType = ticketTypeMap[category] || 'GENERAL';

    // Create the support ticket
    const ticket = await prisma.supportTicket.create({
      data: {
        id: uuidv4(),
        ticketNumber: generateTicketNumber(),
        type: ticketType as 'REFUND' | 'RETURN' | 'EXCHANGE' | 'ORDER_ISSUE' | 'PRODUCT_QUESTION' | 'SHIPPING_ISSUE' | 'PAYMENT_ISSUE' | 'GENERAL',
        status: 'OPEN',
        priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
        subject: summary,
        customerId: customerId,
        customerEmail: finalCustomerEmail,
        customerName: finalCustomerName,
        refundReason: ticketFields.refundReason as string || null,
        aiAssisted: true,
        aiSummary: `Pre-chat questionnaire: ${category}\n\nAnswers:\n${JSON.stringify(answers, null, 2)}`,
      },
    });

    // Create the live chat session
    const sessionId = uuidv4();
    const preChatContext = JSON.stringify({
      category,
      flow: flow.id,
      answers,
      summary,
      priority,
      ticketFields,
    });

    const chatSession = await prisma.liveChatSession.create({
      data: {
        id: uuidv4(),
        sessionId: sessionId,
        ticketId: ticket.id,
        customerId: customerId,
        customerName: finalCustomerName,
        customerEmail: finalCustomerEmail,
        status: 'WAITING',
        preChatContext,
        issueCategory: category,
        issueSummary: summary,
      },
    });

    // Add initial system message
    await prisma.liveChatMessage.create({
      data: {
        id: uuidv4(),
        sessionId: chatSession.id,
        message: `Customer is waiting for support. Issue: ${summary}`,
        senderType: 'system',
        senderName: 'System',
      },
    });

    // Get current queue position
    const queuePosition = await prisma.liveChatSession.count({
      where: {
        status: 'WAITING',
        requestedAt: { lt: chatSession.requestedAt },
      },
    });

    // Get available agents count
    const availableAgents = await prisma.adminAvailability.count({
      where: {
        isOnline: true,
        status: 'available',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: chatSession.sessionId,
        chatSessionId: chatSession.id,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        status: chatSession.status,
        queuePosition: queuePosition + 1,
        availableAgents,
        estimatedWaitMinutes: availableAgents > 0 
          ? Math.ceil((queuePosition + 1) * 3) // ~3 min per customer
          : null,
      },
    });

  } catch (error) {
    console.error('Live chat request error:', error);
    return NextResponse.json(
      { error: 'Failed to create chat session' },
      { status: 500 }
    );
  }
}

// GET - Check session status
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const chatSession = await prisma.liveChatSession.findUnique({
      where: { sessionId },
      include: {
        admin: {
          select: { id: true, name: true }
        },
        ticket: {
          select: { ticketNumber: true, status: true }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Calculate queue position if still waiting
    let queuePosition = 0;
    if (chatSession.status === 'WAITING') {
      queuePosition = await prisma.liveChatSession.count({
        where: {
          status: 'WAITING',
          requestedAt: { lt: chatSession.requestedAt },
        },
      }) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: chatSession.sessionId,
        status: chatSession.status,
        queuePosition,
        admin: chatSession.admin,
        ticketNumber: chatSession.ticket.ticketNumber,
        messages: chatSession.messages,
        acceptedAt: chatSession.acceptedAt,
        waitTime: chatSession.waitTime,
      },
    });

  } catch (error) {
    console.error('Get session status error:', error);
    return NextResponse.json(
      { error: 'Failed to get session status' },
      { status: 500 }
    );
  }
}
