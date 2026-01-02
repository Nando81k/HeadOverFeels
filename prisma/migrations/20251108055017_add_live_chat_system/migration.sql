-- CreateTable
CREATE TABLE "live_chat_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "customerId" TEXT,
    "adminId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "closedAt" DATETIME,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "waitTime" INTEGER,
    "duration" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "live_chat_sessions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "live_chat_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "live_chat_sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "live_chat_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "live_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_chat_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "maxChats" INTEGER NOT NULL DEFAULT 3,
    "activeChats" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "admin_availability_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "live_chat_sessions_sessionId_key" ON "live_chat_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "live_chat_sessions_ticketId_key" ON "live_chat_sessions"("ticketId");

-- CreateIndex
CREATE INDEX "live_chat_sessions_status_idx" ON "live_chat_sessions"("status");

-- CreateIndex
CREATE INDEX "live_chat_sessions_adminId_idx" ON "live_chat_sessions"("adminId");

-- CreateIndex
CREATE INDEX "live_chat_sessions_requestedAt_idx" ON "live_chat_sessions"("requestedAt");

-- CreateIndex
CREATE INDEX "live_chat_messages_sessionId_idx" ON "live_chat_messages"("sessionId");

-- CreateIndex
CREATE INDEX "live_chat_messages_createdAt_idx" ON "live_chat_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_availability_adminId_key" ON "admin_availability"("adminId");
