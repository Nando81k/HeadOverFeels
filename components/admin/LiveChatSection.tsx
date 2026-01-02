'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChatCircle,
  Clock,
  User,
  ArrowRight,
  PaperPlaneRight,
  X,
  Warning,
  Bell,
  BellSlash,
  Spinner,
  Package,
  CreditCard,
  Truck,
  ArrowsClockwise,
  Question,
  UserCircle,
  Wrench,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useLiveChatNotifications } from '@/lib/hooks/useLiveChatNotifications';

// Category icons mapping
const CATEGORY_ICONS: Record<string, PhosphorIcon> = {
  order: Package,
  payment: CreditCard,
  shipping: Truck,
  returns: ArrowsClockwise,
  product: Question,
  technical: Wrench,
  account: UserCircle,
  other: ChatCircle,
};

// Helper to render icon safely
function CategoryIcon({ category, size, className }: { category: string | null; size: number; className: string }) {
  const IconComponent = CATEGORY_ICONS[category || 'other'] || ChatCircle;
  return <IconComponent size={size} className={className} />;
}

interface Message {
  id: string;
  content: string;
  senderType: 'CUSTOMER' | 'ADMIN';
  createdAt: string;
}

interface ActiveSession {
  sessionId: string;
  customerName: string;
  customerEmail: string;
  issueCategory: string | null;
  issueSummary: string | null;
  preChatContext: string | null;
  ticketNumber: string | null;
  messages: Message[];
}

interface PreChatContext {
  flow: string;
  answers: Record<string, string>;
  summary: string;
}

interface LiveChatSectionProps {
  compact?: boolean;
}

export function LiveChatSection({ compact = false }: LiveChatSectionProps) {
  const {
    waitingChats,
    waitingCount,
    isLoading: isLoadingQueue,
    notificationsEnabled,
    enableNotifications,
    refetch,
  } = useLiveChatNotifications(true, 5000);

  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages]);

  const fetchSessionMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/live/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          setActiveSession(prev =>
            prev ? { ...prev, messages: data.session.messages || [] } : null
          );
        }
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  };

  // Poll for new messages when session is active
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      fetchSessionMessages(activeSession.sessionId);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const handleAcceptChat = async (sessionId: string) => {
    setIsAccepting(sessionId);
    setError(null);

    try {
      const response = await fetch(`/api/chat/live/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept chat');
      }

      const data = await response.json();
      setActiveSession({
        sessionId,
        customerName: data.session.customer?.name || 'Unknown',
        customerEmail: data.session.customer?.email || '',
        issueCategory: data.session.issueCategory,
        issueSummary: data.session.issueSummary,
        preChatContext: data.session.preChatContext,
        ticketNumber: data.session.ticket?.ticketNumber || null,
        messages: data.session.messages || [],
      });
      setIsExpanded(true);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept chat');
    } finally {
      setIsAccepting(null);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeSession || isSending) return;

    setIsSending(true);

    try {
      const response = await fetch(`/api/chat/live/${activeSession.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          content: messageInput.trim(),
          senderType: 'admin',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const newMessage: Message = {
        id: `temp-${Date.now()}`,
        content: messageInput.trim(),
        senderType: 'ADMIN',
        createdAt: new Date().toISOString(),
      };

      setActiveSession(prev =>
        prev ? { ...prev, messages: [...prev.messages, newMessage] } : null
      );
      setMessageInput('');

      setTimeout(() => fetchSessionMessages(activeSession.sessionId), 500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;

    try {
      await fetch(`/api/chat/live/${activeSession.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });

      setActiveSession(null);
      setIsExpanded(false);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close session');
    }
  };

  const getParsedContext = (contextString: string | null): PreChatContext | null => {
    if (!contextString) return null;
    try {
      return JSON.parse(contextString);
    } catch {
      return null;
    }
  };

  // Compact view for sidebar/dashboard
  if (compact && !isExpanded) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ChatCircle size={20} className="text-pink-400" />
            Live Chat
            {waitingCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-pink-500 text-white rounded-full">
                {waitingCount}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={enableNotifications}
              className={`p-2 rounded-lg transition-colors ${
                notificationsEnabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
              title={notificationsEnabled ? 'Notifications on' : 'Enable notifications'}
            >
              {notificationsEnabled ? <Bell size={18} weight="fill" /> : <BellSlash size={18} />}
            </button>
            {isLoadingQueue && <Spinner size={16} className="animate-spin text-white/50" />}
          </div>
        </div>

        <div className="divide-y divide-white/10 max-h-[300px] overflow-y-auto">
          {waitingChats.length === 0 ? (
            <div className="p-6 text-center text-white/40">
              <ChatCircle size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No customers waiting</p>
            </div>
          ) : (
            waitingChats.slice(0, 5).map((chat) => {
              return (
                <div key={chat.sessionId} className="p-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-pink-500/20">
                      <CategoryIcon category={chat.issueCategory} size={18} className="text-pink-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{chat.customerName}</p>
                      <p className="text-xs text-white/50">
                        {chat.issueCategory || 'General'} • {chat.waitTimeMinutes}m
                      </p>
                    </div>
                    <button
                      onClick={() => handleAcceptChat(chat.sessionId)}
                      disabled={isAccepting === chat.sessionId}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      {isAccepting === chat.sessionId ? (
                        <Spinner size={14} className="animate-spin" />
                      ) : (
                        'Accept'
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {waitingChats.length > 5 && (
          <div className="p-3 border-t border-white/10 text-center">
            <button
              onClick={() => setIsExpanded(true)}
              className="text-sm text-pink-400 hover:text-pink-300"
            >
              View all ({waitingChats.length}) →
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full expanded view
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <ChatCircle size={20} className="text-pink-400" />
          Live Chat Support
          {waitingCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-pink-500 text-white rounded-full animate-pulse">
              {waitingCount} waiting
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={enableNotifications}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              notificationsEnabled
                ? 'bg-green-500/20 text-green-400'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {notificationsEnabled ? (
              <>
                <Bell size={16} weight="fill" />
                On
              </>
            ) : (
              <>
                <BellSlash size={16} />
                Off
              </>
            )}
          </button>
          {compact && (
            <button
              onClick={() => {
                setIsExpanded(false);
                setActiveSession(null);
              }}
              className="p-2 hover:bg-white/10 rounded-lg text-white/60"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <Warning size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {/* Queue Panel */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Clock size={16} className="text-yellow-400" />
              Waiting Queue
              {isLoadingQueue && <Spinner size={14} className="animate-spin text-white/50" />}
            </h3>
          </div>

          <div className="divide-y divide-white/10 max-h-[400px] overflow-y-auto">
            {waitingChats.length === 0 ? (
              <div className="p-6 text-center text-white/40">
                <ChatCircle size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No customers waiting</p>
                <p className="text-xs mt-1">New requests will appear here</p>
              </div>
            ) : (
              waitingChats.map((chat) => {
              return (
                <div key={chat.sessionId} className="p-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-pink-500/20">
                      <CategoryIcon category={chat.issueCategory} size={20} className="text-pink-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white text-sm truncate">
                            {chat.customerName}
                          </p>
                          <span className="text-xs text-white/40">{chat.waitTimeMinutes}m</span>
                        </div>
                        <p className="text-xs text-white/50 truncate">{chat.customerEmail}</p>
                        {chat.issueSummary && (
                          <p className="text-xs text-white/70 mt-1 line-clamp-2">
                            {chat.issueSummary}
                          </p>
                        )}
                        {chat.issueCategory && (
                          <span className="inline-block mt-1.5 px-2 py-0.5 text-xs bg-white/10 text-white/50 rounded">
                            {chat.issueCategory}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleAcceptChat(chat.sessionId)}
                        disabled={isAccepting === chat.sessionId}
                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                      >
                        {isAccepting === chat.sessionId ? (
                          <Spinner size={14} className="animate-spin" />
                        ) : (
                          <>
                            Accept
                            <ArrowRight size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Active Chat Panel */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden flex flex-col h-[450px]">
          {activeSession ? (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b border-white/10 bg-green-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <User size={16} className="text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{activeSession.customerName}</p>
                      <p className="text-xs text-white/50">{activeSession.customerEmail}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseSession}
                    className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <X size={14} />
                    End
                  </button>
                </div>

                {activeSession.issueSummary && (
                  <div className="mt-2 p-2 bg-white/5 rounded-lg">
                    <p className="text-xs text-white/70">{activeSession.issueSummary}</p>
                    {activeSession.ticketNumber && (
                      <p className="text-xs text-white/40 mt-1">
                        Ticket: {activeSession.ticketNumber}
                      </p>
                    )}
                  </div>
                )}

                {activeSession.preChatContext && (
                  <details className="mt-2">
                    <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                      View answers
                    </summary>
                    <div className="mt-1 p-2 bg-white/5 rounded text-xs text-white/50 max-h-24 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-[10px]">
                        {JSON.stringify(getParsedContext(activeSession.preChatContext)?.answers, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {activeSession.messages.length === 0 ? (
                  <div className="text-center text-white/40 py-4">
                    <p className="text-xs">Start the conversation</p>
                  </div>
                ) : (
                  activeSession.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.senderType === 'ADMIN' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 ${
                          msg.senderType === 'ADMIN'
                            ? 'bg-green-500 text-white'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[9px] opacity-50 mt-0.5">
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-3 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || isSending}
                    className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white rounded-lg transition-colors"
                  >
                    {isSending ? (
                      <Spinner size={16} className="animate-spin" />
                    ) : (
                      <PaperPlaneRight size={16} />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-6">
              <div>
                <ChatCircle size={48} className="mx-auto mb-3 text-white/20" />
                <h3 className="text-sm font-medium text-white mb-1">No Active Chat</h3>
                <p className="text-white/50 text-xs">
                  Accept a customer from the queue to start
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
