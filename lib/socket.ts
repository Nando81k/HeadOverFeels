import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'

// ─── Auth helpers ────────────────────────────────────────────────────────────

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET environment variable is required')
  return new TextEncoder().encode(secret)
}

/**
 * Parse a raw Cookie header and return the value for `name`, or undefined.
 */
function parseCookieValue(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key.trim() === name) return rest.join('=').trim()
  }
  return undefined
}

interface SocketSession {
  userId: string
  email: string
  isAdmin: boolean
}

async function verifySocketToken(token: string): Promise<SocketSession | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret())
    const p = payload as unknown as SocketSession
    if (!p.userId) return null
    return { userId: p.userId, email: p.email ?? '', isAdmin: p.isAdmin ?? false }
  } catch {
    return null
  }
}

// ─── Augment socket.data type ─────────────────────────────────────────────────

declare module 'socket.io' {
  interface SocketData {
    userId: string
    email: string
    isAdmin: boolean
  }
}

// ─── Module-level IO instance ─────────────────────────────────────────────────

let io: SocketIOServer | null = null

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}

// ─── Initialisation ───────────────────────────────────────────────────────────

export function initializeSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/api/socket',
  })

  // ── Connection-level auth middleware ────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      // 1. Prefer explicit auth token sent by the client (io({ auth: { token } }))
      let token: string | undefined = socket.handshake.auth?.token

      // 2. Fall back to the auth_token cookie in the HTTP handshake headers
      if (!token) {
        const cookieHeader = socket.handshake.headers.cookie ?? ''
        token = parseCookieValue(cookieHeader, 'auth_token')
      }

      if (!token) {
        return next(new Error('Unauthorized'))
      }

      const session = await verifySocketToken(token)
      if (!session) {
        return next(new Error('Unauthorized'))
      }

      // Stamp verified identity onto the socket — event handlers trust these values
      socket.data.userId = session.userId
      socket.data.email = session.email
      socket.data.isAdmin = session.isAdmin

      next()
    } catch (err) {
      console.error('Socket auth middleware error:', err)
      next(new Error('Unauthorized'))
    }
  })

  // ── Event handlers ──────────────────────────────────────────────────────────

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id} (user=${socket.data.userId} admin=${socket.data.isAdmin})`)

    // ── chat:join ────────────────────────────────────────────────────────────
    socket.on('chat:join', async (data: {
      sessionId: string
      userId: string
      userType: 'customer' | 'admin'
    }) => {
      const { sessionId, userId, userType } = data

      // Reject if client-supplied userId doesn't match the verified identity,
      // unless the socket belongs to an admin (admins can act on behalf of sessions).
      if (userId !== socket.data.userId && !socket.data.isAdmin) {
        socket.emit('error', { message: 'Unauthorized: userId mismatch' })
        return
      }

      // Reject if a non-admin claims to be an admin via userType
      if (userType === 'admin' && !socket.data.isAdmin) {
        socket.emit('error', { message: 'Unauthorized: insufficient privileges' })
        return
      }

      try {
        const session = await prisma.liveChatSession.findUnique({
          where: { sessionId },
          include: { ticket: true, admin: true, customer: true }
        })

        if (!session) {
          socket.emit('error', { message: 'Session not found' })
          return
        }

        socket.join(sessionId)
        console.log(`${userType} ${socket.data.userId} joined session ${sessionId}`)

        socket.to(sessionId).emit('user:joined', {
          userType,
          userId: socket.data.userId,
          sessionId,
        })

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

    // ── chat:send-message ────────────────────────────────────────────────────
    socket.on('chat:send-message', async (data: {
      sessionId: string
      message: string
      senderType: 'customer' | 'admin'
      senderId: string
      senderName: string
    }) => {
      const { sessionId, message, senderType, senderId, senderName } = data

      // Reject if client-supplied senderId doesn't match the verified identity
      if (senderId !== socket.data.userId && !socket.data.isAdmin) {
        socket.emit('error', { message: 'Unauthorized: senderId mismatch' })
        return
      }

      // Reject if a non-admin claims to be an admin via senderType
      if (senderType === 'admin' && !socket.data.isAdmin) {
        socket.emit('error', { message: 'Unauthorized: insufficient privileges' })
        return
      }

      try {
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

        // Use verified identity for the stored record
        const chatMessage = await prisma.liveChatMessage.create({
          data: {
            sessionId: session.id,
            message,
            senderType,
            senderId: socket.data.userId,   // authoritative identity
            senderName,
          }
        })

        io?.to(sessionId).emit('chat:message', {
          messageId: chatMessage.id,
          message: chatMessage.message,
          senderType: chatMessage.senderType,
          senderName: chatMessage.senderName,
          timestamp: chatMessage.createdAt,
        })

        console.log(`Message in ${sessionId} from ${senderName}: ${message.substring(0, 50)}`)
      } catch (error) {
        console.error('Error sending message:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // ── chat:typing ──────────────────────────────────────────────────────────
    socket.on('chat:typing', (data: {
      sessionId: string
      isTyping: boolean
      senderType: 'customer' | 'admin'
    }) => {
      const { sessionId, isTyping, senderType } = data

      // Non-admins cannot claim admin senderType
      const effectiveSenderType: 'customer' | 'admin' =
        senderType === 'admin' && !socket.data.isAdmin ? 'customer' : senderType

      socket.to(sessionId).emit('chat:typing', {
        sessionId,
        senderType: effectiveSenderType,
        isTyping,
      })
    })

    // ── chat:mark-read ───────────────────────────────────────────────────────
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

          io?.to(sessionId).emit('chat:messages-read', {
            sessionId,
            lastMessageId,
          })
        }
      } catch (error) {
        console.error('Error marking messages as read:', error)
      }
    })

    // ── admin:register ───────────────────────────────────────────────────────
    socket.on('admin:register', (data: { adminId: string }) => {
      const { adminId } = data

      // Only verified admins may register in an admin room
      if (!socket.data.isAdmin) {
        socket.emit('error', { message: 'Unauthorized: admin privileges required' })
        return
      }

      // The adminId in the payload must match the verified identity
      if (adminId !== socket.data.userId) {
        socket.emit('error', { message: 'Unauthorized: adminId mismatch' })
        return
      }

      socket.join(`admin-${socket.data.userId}`)
      console.log(`Admin ${socket.data.userId} registered for notifications`)
    })

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`)
    })
  })

  console.log('Socket.IO server initialized')
  return io
}

// ─── Server-side helpers (called from API routes) ─────────────────────────────

export async function notifyNewChatRequest(sessionId: string, ticketNumber: string, customerName: string) {
  if (!io) return

  const onlineAdmins = await prisma.adminAvailability.findMany({
    where: {
      isOnline: true,
      activeChats: { lt: 3 },
    },
    include: { admin: true }
  })

  onlineAdmins.forEach((admin: { adminId: string; admin: { name: string | null } }) => {
    io?.to(`admin-${admin.adminId}`).emit('admin:new-request', {
      sessionId,
      ticketNumber,
      customerName,
      waitTime: 0,
    })
  })

  console.log(`New chat request broadcast to ${onlineAdmins.length} admins`)
}

export async function notifyAdminJoined(sessionId: string, adminName: string, adminId: string) {
  if (!io) return
  io.to(sessionId).emit('chat:admin-joined', { sessionId, adminName, adminId })
}

export async function notifySessionClosed(sessionId: string, closedBy: 'customer' | 'admin', duration: number) {
  if (!io) return
  io.to(sessionId).emit('chat:session-closed', { sessionId, closedBy, duration })
}

export async function notifyAdminLeft(sessionId: string, reason: string) {
  if (!io) return
  io.to(sessionId).emit('chat:admin-left', { sessionId, reason })
}

export async function updateAdminAvailability(adminId: string, isOnline: boolean, activeChats: number) {
  if (!io) return
  io.emit('admin:availability-changed', { adminId, isOnline, activeChats })
}
