import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { prisma } from '@/lib/prisma'

let io: SocketIOServer | null = null

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized')
  }
  return io
}

export function initializeSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/api/socket',
  })

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`)

    // Join a chat session room
    socket.on('chat:join', async (data: {
      sessionId: string
      userId: string
      userType: 'customer' | 'admin'
    }) => {
      const { sessionId, userId, userType } = data
      
      try {
        // Verify session exists
        const session = await prisma.liveChatSession.findUnique({
          where: { sessionId },
          include: { ticket: true, admin: true, customer: true }
        })

        if (!session) {
          socket.emit('error', { message: 'Session not found' })
          return
        }

        // Join the room
        socket.join(sessionId)
        console.log(`✅ ${userType} ${userId} joined session ${sessionId}`)

        // Notify others in the room
        socket.to(sessionId).emit('user:joined', {
          userType,
          userId,
          sessionId,
        })

        // Send session details to the joining user
        socket.emit('chat:session-details', {
          session: {
            id: session.id,
            sessionId: session.sessionId,
            status: session.status,
            customerName: session.customerName,
            adminName: session.admin?.name,
            requestedAt: session.requestedAt,
            acceptedAt: session.acceptedAt,
          }
        })
      } catch (error) {
        console.error('Error joining chat:', error)
        socket.emit('error', { message: 'Failed to join chat' })
      }
    })

    // Send a message
    socket.on('chat:send-message', async (data: {
      sessionId: string
      message: string
      senderType: 'customer' | 'admin'
      senderId: string
      senderName: string
    }) => {
      const { sessionId, message, senderType, senderId, senderName } = data

      try {
        // Verify session is active
        const session = await prisma.liveChatSession.findUnique({
          where: { sessionId },
        })

        if (!session) {
          socket.emit('error', { message: 'Session not found' })
          return
        }

        if (session.status === 'CLOSED') {
          socket.emit('error', { message: 'Session is closed' })
          return
        }

        // Save message to database
        const chatMessage = await prisma.liveChatMessage.create({
          data: {
            sessionId: session.id,
            message,
            senderType,
            senderId,
            senderName,
          }
        })

        // Broadcast message to all in the room
        io?.to(sessionId).emit('chat:message', {
          messageId: chatMessage.id,
          message: chatMessage.message,
          senderType: chatMessage.senderType,
          senderName: chatMessage.senderName,
          timestamp: chatMessage.createdAt,
        })

        console.log(`💬 Message in ${sessionId} from ${senderName}: ${message.substring(0, 50)}`)
      } catch (error) {
        console.error('Error sending message:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Typing indicator
    socket.on('chat:typing', async (data: {
      sessionId: string
      isTyping: boolean
      senderType: 'customer' | 'admin'
    }) => {
      const { sessionId, isTyping, senderType } = data
      
      // Broadcast typing status to others in the room
      socket.to(sessionId).emit('chat:typing', {
        sessionId,
        senderType,
        isTyping,
      })
    })

    // Mark messages as read
    socket.on('chat:mark-read', async (data: {
      sessionId: string
      lastMessageId: string
    }) => {
      const { sessionId, lastMessageId } = data

      try {
        const session = await prisma.liveChatSession.findUnique({
          where: { sessionId },
        })

        if (session) {
          // Update all messages up to lastMessageId as read
          await prisma.liveChatMessage.updateMany({
            where: {
              sessionId: session.id,
              id: { lte: lastMessageId },
              isRead: false,
            },
            data: {
              isRead: true,
              readAt: new Date(),
            }
          })

          // Notify the room
          io?.to(sessionId).emit('chat:messages-read', {
            sessionId,
            lastMessageId,
          })
        }
      } catch (error) {
        console.error('Error marking messages as read:', error)
      }
    })

    // Admin-specific: Join admin room for notifications
    socket.on('admin:register', (data: { adminId: string }) => {
      const { adminId } = data
      socket.join(`admin-${adminId}`)
      console.log(`👤 Admin ${adminId} registered for notifications`)
    })

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`)
    })
  })

  console.log('✅ Socket.IO server initialized')
  return io
}

// Helper functions for emitting events from API routes

export async function notifyNewChatRequest(sessionId: string, ticketNumber: string, customerName: string) {
  if (!io) return

  // Get all online admins with capacity
  const onlineAdmins = await prisma.adminAvailability.findMany({
    where: { 
      isOnline: true, 
      activeChats: { lt: 3 } // Less than max chats (default is 3)
    },
    include: { admin: true }
  })

  // Broadcast to all available admins
  onlineAdmins.forEach((admin: any) => {
    io?.to(`admin-${admin.adminId}`).emit('admin:new-request', {
      sessionId,
      ticketNumber,
      customerName,
      waitTime: 0,
    })
  })

  console.log(`📢 New chat request broadcast to ${onlineAdmins.length} admins`)
}

export async function notifyAdminJoined(sessionId: string, adminName: string, adminId: string) {
  if (!io) return

  io.to(sessionId).emit('chat:admin-joined', {
    sessionId,
    adminName,
    adminId,
  })
}

export async function notifySessionClosed(sessionId: string, closedBy: 'customer' | 'admin', duration: number) {
  if (!io) return

  io.to(sessionId).emit('chat:session-closed', {
    sessionId,
    closedBy,
    duration,
  })
}

export async function notifyAdminLeft(sessionId: string, reason: string) {
  if (!io) return

  io.to(sessionId).emit('chat:admin-left', {
    sessionId,
    reason,
  })
}

export async function updateAdminAvailability(adminId: string, isOnline: boolean, activeChats: number) {
  if (!io) return

  io.emit('admin:availability-changed', {
    adminId,
    isOnline,
    activeChats,
  })
}
