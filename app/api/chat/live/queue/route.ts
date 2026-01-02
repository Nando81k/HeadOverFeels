/**
 * Live Chat Queue API
 * 
 * GET /api/chat/live/queue
 * 
 * Admin endpoint to get waiting customers in the live chat queue.
 * Returns sessions with pre-chat context for agent preparation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

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

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromSession();
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const status = request.nextUrl.searchParams.get('status') || 'WAITING';
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    // Get sessions based on status filter
    const sessions = await prisma.liveChatSession.findMany({
      where: {
        status: status as 'WAITING' | 'ACTIVE' | 'CLOSED',
        ...(status === 'ACTIVE' ? { adminId: admin.id } : {}), // Only show own active chats
      },
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            type: true,
            priority: true,
            subject: true,
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
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Just the last message for preview
        },
        admin: {
          select: { id: true, name: true }
        }
      },
      orderBy: [
        // Priority order: URGENT > HIGH > MEDIUM > LOW
        { ticket: { priority: 'desc' } },
        { requestedAt: 'asc' }, // Oldest first
      ],
      take: limit,
    });

    // Parse preChatContext for each session
    const enrichedSessions = sessions.map(session => {
      let preChatData = null;
      if (session.preChatContext) {
        try {
          preChatData = JSON.parse(session.preChatContext);
        } catch {
          preChatData = null;
        }
      }

      // Calculate wait time
      const waitTimeSeconds = session.status === 'WAITING'
        ? Math.floor((Date.now() - session.requestedAt.getTime()) / 1000)
        : session.waitTime;

      return {
        id: session.id,
        sessionId: session.sessionId,
        status: session.status,
        customerName: session.customerName,
        customerEmail: session.customerEmail,
        customer: session.customer,
        ticket: session.ticket,
        issueCategory: session.issueCategory,
        issueSummary: session.issueSummary,
        preChatContext: preChatData,
        lastMessage: session.messages[0] || null,
        admin: session.admin,
        requestedAt: session.requestedAt,
        acceptedAt: session.acceptedAt,
        waitTimeSeconds,
        waitTimeFormatted: formatWaitTime(waitTimeSeconds || 0),
      };
    });

    // Get queue stats
    const [waitingCount, activeCount, availableAgents] = await Promise.all([
      prisma.liveChatSession.count({ where: { status: 'WAITING' } }),
      prisma.liveChatSession.count({ where: { status: 'ACTIVE', adminId: admin.id } }),
      prisma.adminAvailability.count({ where: { isOnline: true, status: 'available' } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        sessions: enrichedSessions,
        stats: {
          waiting: waitingCount,
          activeForAdmin: activeCount,
          availableAgents,
        },
      },
    });

  } catch (error) {
    console.error('Get queue error:', error);
    return NextResponse.json(
      { error: 'Failed to get queue' },
      { status: 500 }
    );
  }
}

function formatWaitTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
