/**
 * Admin Availability Status API
 * 
 * GET/POST /api/chat/live/status
 * 
 * Manages admin online status for live chat.
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

// GET - Get current admin's status
export async function GET() {
  try {
    const admin = await getAdminFromSession();
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get or create availability record
    let availability = await prisma.adminAvailability.findUnique({
      where: { adminId: admin.id },
    });

    if (!availability) {
      availability = await prisma.adminAvailability.create({
        data: {
          adminId: admin.id,
          isOnline: false,
          status: 'offline',
          maxChats: 3,
          activeChats: 0,
        },
      });
    }

    // Get queue stats
    const [waitingCount, activeCount, totalAvailableAgents] = await Promise.all([
      prisma.liveChatSession.count({ where: { status: 'WAITING' } }),
      prisma.liveChatSession.count({ where: { status: 'ACTIVE', adminId: admin.id } }),
      prisma.adminAvailability.count({ where: { isOnline: true, status: 'available' } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        adminId: admin.id,
        adminName: admin.name,
        isOnline: availability.isOnline,
        status: availability.status,
        maxChats: availability.maxChats,
        activeChats: activeCount, // Use actual count
        lastSeenAt: availability.lastSeenAt,
        queueStats: {
          waiting: waitingCount,
          activeForAdmin: activeCount,
          totalAvailableAgents,
        },
      },
    });

  } catch (error) {
    console.error('Get status error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

// POST - Update admin status
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromSession();
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isOnline, status, maxChats } = body;

    // Validate status
    const validStatuses = ['offline', 'available', 'busy', 'away'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: offline, available, busy, or away' },
        { status: 400 }
      );
    }

    // Update or create availability
    const availability = await prisma.adminAvailability.upsert({
      where: { adminId: admin.id },
      update: {
        ...(typeof isOnline === 'boolean' && { isOnline }),
        ...(status && { status }),
        ...(typeof maxChats === 'number' && { maxChats }),
        lastSeenAt: new Date(),
      },
      create: {
        adminId: admin.id,
        isOnline: isOnline ?? false,
        status: status || 'offline',
        maxChats: maxChats ?? 3,
        activeChats: 0,
      },
    });

    // If going offline, we might want to handle active chats
    // For now, just update status - active chats remain

    return NextResponse.json({
      success: true,
      data: {
        adminId: admin.id,
        isOnline: availability.isOnline,
        status: availability.status,
        maxChats: availability.maxChats,
        activeChats: availability.activeChats,
        lastSeenAt: availability.lastSeenAt,
      },
    });

  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    );
  }
}
