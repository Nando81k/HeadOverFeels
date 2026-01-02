/**
 * Live Chat Session Actions API
 * 
 * POST /api/chat/live/[sessionId]/accept - Admin accepts a chat
 * POST /api/chat/live/[sessionId]/close - Either party closes chat
 * POST /api/chat/live/[sessionId]/message - Send a message
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// Admin auth check
async function getAdminFromSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin_session');
  
  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value);
    if (!sessionData.adminId) return null;

    const admin = await prisma.adminUser.findUnique({
      where: { id: sessionData.adminId },
      select: { id: true, name: true, email: true, role: true }
    });

    return admin;
  } catch {
    return null;
  }
}

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

// Accept a chat session
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { action } = body;

    // Get session
    const chatSession = await prisma.liveChatSession.findUnique({
      where: { sessionId },
      include: {
        ticket: true,
        admin: { select: { id: true, name: true } },
      }
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'accept':
        return handleAccept(chatSession, request);
      case 'close':
        return handleClose(chatSession, body);
      case 'message':
        return handleMessage(chatSession, body, request);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Session action error:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}

async function handleAccept(
  chatSession: { id: string; sessionId: string; status: string; requestedAt: Date; ticketId: string },
  request: NextRequest
) {
  // Verify admin auth
  const admin = await getAdminFromSession();
  if (!admin) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Check if already accepted
  if (chatSession.status !== 'WAITING') {
    return NextResponse.json(
      { error: 'Session is no longer available' },
      { status: 400 }
    );
  }

  // Calculate wait time
  const waitTime = Math.floor((Date.now() - chatSession.requestedAt.getTime()) / 1000);

  // Update session
  const updatedSession = await prisma.liveChatSession.update({
    where: { id: chatSession.id },
    data: {
      status: 'ACTIVE',
      adminId: admin.id,
      acceptedAt: new Date(),
      waitTime,
    },
  });

  // Update admin's active chat count
  await prisma.adminAvailability.updateMany({
    where: { adminId: admin.id },
    data: {
      activeChats: { increment: 1 },
    },
  });

  // Update ticket status
  await prisma.supportTicket.update({
    where: { id: chatSession.ticketId },
    data: {
      status: 'IN_PROGRESS',
      assignedToId: admin.id,
    },
  });

  // Add system message
  await prisma.liveChatMessage.create({
    data: {
      id: uuidv4(),
      sessionId: chatSession.id,
      message: `${admin.name} has joined the chat.`,
      senderType: 'system',
      senderName: 'System',
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      sessionId: updatedSession.sessionId,
      status: updatedSession.status,
      adminId: admin.id,
      adminName: admin.name,
      waitTime,
    },
  });
}

async function handleClose(
  chatSession: { id: string; sessionId: string; status: string; acceptedAt: Date | null; ticketId: string; adminId: string | null },
  body: { closedBy: 'admin' | 'customer'; resolution?: string }
) {
  const { closedBy, resolution } = body;

  if (chatSession.status === 'CLOSED') {
    return NextResponse.json(
      { error: 'Session is already closed' },
      { status: 400 }
    );
  }

  // Calculate duration
  const duration = chatSession.acceptedAt
    ? Math.floor((Date.now() - chatSession.acceptedAt.getTime()) / 1000)
    : 0;

  // Update session
  const updatedSession = await prisma.liveChatSession.update({
    where: { id: chatSession.id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      duration,
    },
  });

  // Update admin's active chat count if there was an admin
  if (chatSession.adminId) {
    await prisma.adminAvailability.updateMany({
      where: { adminId: chatSession.adminId },
      data: {
        activeChats: { decrement: 1 },
      },
    });
  }

  // Update ticket
  await prisma.supportTicket.update({
    where: { id: chatSession.ticketId },
    data: {
      status: resolution === 'resolved' ? 'RESOLVED' : 'CLOSED',
    },
  });

  // Add system message
  await prisma.liveChatMessage.create({
    data: {
      id: uuidv4(),
      sessionId: chatSession.id,
      message: `Chat ended by ${closedBy}. Duration: ${formatDuration(duration)}`,
      senderType: 'system',
      senderName: 'System',
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      sessionId: updatedSession.sessionId,
      status: updatedSession.status,
      duration,
      closedAt: updatedSession.closedAt,
    },
  });
}

async function handleMessage(
  chatSession: { id: string; sessionId: string; status: string },
  body: { message: string; senderType: 'customer' | 'admin'; senderId?: string; senderName?: string },
  request: NextRequest
) {
  const { message, senderType, senderId, senderName } = body;

  if (!message || !senderType) {
    return NextResponse.json(
      { error: 'Message and senderType are required' },
      { status: 400 }
    );
  }

  if (chatSession.status === 'CLOSED') {
    return NextResponse.json(
      { error: 'Cannot send messages to a closed session' },
      { status: 400 }
    );
  }

  // If admin is sending, verify authentication
  if (senderType === 'admin') {
    const admin = await getAdminFromSession();
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  // Create message
  const newMessage = await prisma.liveChatMessage.create({
    data: {
      id: uuidv4(),
      sessionId: chatSession.id,
      message,
      senderType,
      senderId: senderId || null,
      senderName: senderName || (senderType === 'admin' ? 'Support Agent' : 'Customer'),
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      messageId: newMessage.id,
      message: newMessage.message,
      senderType: newMessage.senderType,
      senderName: newMessage.senderName,
      createdAt: newMessage.createdAt,
    },
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// GET - Get session details and messages
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { sessionId } = await params;

    const chatSession = await prisma.liveChatSession.findUnique({
      where: { sessionId },
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            type: true,
            priority: true,
            subject: true,
            status: true,
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            totalOrders: true,
            totalSpent: true,
          }
        },
        admin: {
          select: { id: true, name: true, email: true }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Parse preChatContext
    let preChatContext = null;
    if (chatSession.preChatContext) {
      try {
        preChatContext = JSON.parse(chatSession.preChatContext);
      } catch {
        preChatContext = null;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: chatSession.id,
        sessionId: chatSession.sessionId,
        status: chatSession.status,
        customerName: chatSession.customerName,
        customerEmail: chatSession.customerEmail,
        customer: chatSession.customer,
        admin: chatSession.admin,
        ticket: chatSession.ticket,
        issueCategory: chatSession.issueCategory,
        issueSummary: chatSession.issueSummary,
        preChatContext,
        messages: chatSession.messages,
        requestedAt: chatSession.requestedAt,
        acceptedAt: chatSession.acceptedAt,
        closedAt: chatSession.closedAt,
        waitTime: chatSession.waitTime,
        duration: chatSession.duration,
      },
    });

  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
