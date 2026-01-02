'use client';

/**
 * Customer Detail Client Component
 * 
 * Main client component that orchestrates all customer detail sections
 * Handles state management, data fetching, and gift points modal
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Envelope,
  Phone,
  Calendar,
  ShoppingBag,
  Star,
  PencilSimple,
  Trash,
  CaretRight,
  Clock,
  CurrencyDollar,
  Warning,
  Info,
  Spinner,
  ArrowsClockwise,
  Gift,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { AdminLayout } from '@/components/admin/AdminLayout';
import CustomerSpendingChart from './CustomerSpendingChart';
import CarePointsActivityChart from './CarePointsActivityChart';
import CarePointsSummaryCard from './CarePointsSummaryCard';
import GiftPointsModal from './GiftPointsModal';
import PointsHistoryTable from './PointsHistoryTable';
import PurchaseHistoryTable from './PurchaseHistoryTable';

// Type definitions
interface LoyaltyTier {
  id: string;
  name: string;
  minAnnualPoints: number;
  pointMultiplier: number;
  perks: string[];
}

interface Customer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  birthday: string | null;
  newsletter: boolean;
  smsOptIn: boolean;
  isAdmin: boolean;
  createdAt: string;
  totalSpent: number;
  totalOrders: number;
  avgOrderValue: number;
  lastOrderDate: string | null;
  currentPoints: number;
  lifetimePoints: number;
  annualPointsEarned: number;
  currentTier: LoyaltyTier | null;
  nextTier: LoyaltyTier | null;
  expiringPoints: number;
  expiringDate: string | null;
}

interface OrderItem {
  quantity: number;
  productName: string;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  pointsEarned: number;
  createdAt: string;
  items: OrderItem[];
}

interface PointsTransaction {
  id: string;
  points: number;
  type: string;
  description: string | null;
  createdAt: string;
  expiresAt: string | null;
  isExpired: boolean;
}

interface Note {
  id: string;
  content: string;
  authorName: string | null;
  isImportant: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SpendingData {
  month: string;
  spending: number;
  orders: number;
}

interface PointsActivityData {
  month: string;
  earned: number;
  redeemed: number;
}

interface CustomerData {
  customer: Customer;
  orders: Order[];
  pointsTransactions: PointsTransaction[];
  notes: Note[];
  spendingTrends: SpendingData[];
  pointsActivity: PointsActivityData[];
}

interface CustomerDetailClientProps {
  customerId: string;
}

export function CustomerDetailClient({ customerId }: CustomerDetailClientProps) {
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'points' | 'notes'>('overview');

  // Fetch customer data
  const fetchCustomerData = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch customer data');
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  // Handle successful gift points
  const handleGiftPointsSuccess = () => {
    fetchCustomerData(); // Refresh data
  };

  if (loading) {
    return (
      <AdminLayout title="Loading..." subtitle="Please wait">
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Spinner size={48} className="text-pink-400" />
          </motion.div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout title="Error" subtitle="Something went wrong">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Warning size={48} className="text-red-400" />
          <p className="text-white/60">{error || 'Customer not found'}</p>
          <Link
            href="/admin/customers"
            className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
          >
            Back to Customers
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const { customer, orders, pointsTransactions, notes, spendingTrends, pointsActivity } = data;

  // Calculate stats
  const memberSince = new Date(customer.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Tab configuration
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Purchase History', count: orders.length },
    { id: 'points', label: 'Care Points', count: pointsTransactions.length },
    { id: 'notes', label: 'Notes', count: notes.length },
  ] as const;

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <AdminLayout
      title={customer.name || 'Customer Details'}
      subtitle={customer.email}
      headerActions={
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchCustomerData()}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white transition-all"
          >
            <ArrowsClockwise size={18} weight="bold" />
          </motion.button>
          
          {/* Gift Points Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowGiftModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-lg transition-all"
          >
            <Gift size={18} weight="bold" />
            Gift Points
          </motion.button>
          
          {/* Edit Button */}
          <Link
            href={`/admin/customers/${customerId}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-white/80 hover:text-white"
          >
            <PencilSimple size={18} />
            Edit
          </Link>
        </div>
      }
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Customer Info Card */}
        <motion.div
          variants={itemVariants}
          className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
        >
        <div className="flex flex-wrap gap-8">
          {/* Profile Section */}
          <div className="flex-1 min-w-[280px]">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {(customer.name || customer.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl font-semibold text-white">
                    {customer.name || 'Unnamed Customer'}
                  </span>
                  {customer.isAdmin && (
                    <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <span className="flex items-center gap-2 text-white/60">
                    <Envelope size={14} />
                    {customer.email}
                  </span>
                  {customer.phone && (
                    <span className="flex items-center gap-2 text-white/60">
                      <Phone size={14} />
                      {customer.phone}
                    </span>
                  )}
                  {customer.birthday && (
                    <span className="flex items-center gap-2 text-white/60">
                      <Calendar size={14} />
                      {new Date(customer.birthday).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="flex gap-6 flex-wrap">
            <StatCard
              label="Member Since"
              value={memberSince}
              icon={Calendar}
            />
            <StatCard
              label="Total Orders"
              value={customer.totalOrders.toString()}
              icon={ShoppingBag}
            />
            <StatCard
              label="Total Spent"
              value={`$${customer.totalSpent.toFixed(2)}`}
              icon={CurrencyDollar}
            />
            <StatCard
              label="Avg Order"
              value={`$${customer.avgOrderValue.toFixed(2)}`}
              icon={Star}
            />
          </div>
        </div>

        {/* Subscription Status */}
        <div className="mt-6 pt-6 border-t border-white/10 flex gap-4">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              customer.newsletter
                ? 'bg-green-500/20 text-green-300'
                : 'bg-white/10 text-white/40'
            }`}
          >
            {customer.newsletter ? '✓ Newsletter' : 'No Newsletter'}
          </span>
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              customer.smsOptIn
                ? 'bg-green-500/20 text-green-300'
                : 'bg-white/10 text-white/40'
            }`}
          >
            {customer.smsOptIn ? '✓ SMS Opted In' : 'No SMS'}
          </span>
          {customer.lastOrderDate && (
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/60">
              <Clock size={12} className="inline mr-1" />
              Last order: {new Date(customer.lastOrderDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </motion.div>

        {/* Tabs Navigation */}
        <motion.div variants={itemVariants} className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-2">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                {tab.label}
                {'count' in tab && tab.count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id ? 'bg-pink-500/30 text-pink-200' : 'bg-white/10 text-white/50'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Care Points Summary */}
            <CarePointsSummaryCard
              currentPoints={customer.currentPoints}
              lifetimePoints={customer.lifetimePoints}
              annualPointsEarned={customer.annualPointsEarned}
              currentTier={customer.currentTier}
              nextTier={customer.nextTier}
              expiringPoints={customer.expiringPoints}
              expiringDate={customer.expiringDate}
              onGiftPoints={() => setShowGiftModal(true)}
            />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CustomerSpendingChart data={spendingTrends} />
              <CarePointsActivityChart
                data={pointsActivity}
                currentBalance={customer.currentPoints}
                lifetimePoints={customer.lifetimePoints}
              />
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Orders */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Recent Orders</h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-sm text-pink-400 hover:text-pink-300 flex items-center gap-1"
                  >
                    View All <CaretRight size={14} />
                  </button>
                </div>
                <div className="space-y-3">
                  {orders.slice(0, 3).map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                    >
                      <div>
                        <span className="text-white font-medium">{order.orderNumber}</span>
                        <p className="text-sm text-white/50">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-white">${order.total.toFixed(2)}</span>
                        <p className="text-sm text-pink-400">
                          +{order.pointsEarned} pts
                        </p>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <p className="text-center text-white/40 py-4">No orders yet</p>
                  )}
                </div>
              </motion.div>

              {/* Recent Points Activity */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Recent Points Activity</h3>
                  <button
                    onClick={() => setActiveTab('points')}
                    className="text-sm text-pink-400 hover:text-pink-300 flex items-center gap-1"
                  >
                    View All <CaretRight size={14} />
                  </button>
                </div>
                <div className="space-y-3">
                  {pointsTransactions.slice(0, 5).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                    >
                      <div>
                        <span className="text-white text-sm">
                          {tx.description || tx.type.replace(/_/g, ' ')}
                        </span>
                        <p className="text-xs text-white/50">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`font-semibold ${
                          tx.points > 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  ))}
                  {pointsTransactions.length === 0 && (
                    <p className="text-center text-white/40 py-4">No points activity</p>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div
            key="orders"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <PurchaseHistoryTable orders={orders} />
          </motion.div>
        )}

        {activeTab === 'points' && (
          <motion.div
            key="points"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Points Summary at top */}
            <CarePointsSummaryCard
              currentPoints={customer.currentPoints}
              lifetimePoints={customer.lifetimePoints}
              annualPointsEarned={customer.annualPointsEarned}
              currentTier={customer.currentTier}
              nextTier={customer.nextTier}
              expiringPoints={customer.expiringPoints}
              expiringDate={customer.expiringDate}
              onGiftPoints={() => setShowGiftModal(true)}
            />
            
            {/* Points Activity Chart */}
            <CarePointsActivityChart
              data={pointsActivity}
              currentBalance={customer.currentPoints}
              lifetimePoints={customer.lifetimePoints}
            />
            
            {/* Full Points History */}
            <PointsHistoryTable transactions={pointsTransactions} />
          </motion.div>
        )}

        {activeTab === 'notes' && (
          <motion.div
            key="notes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <CustomerNotesSection
              notes={notes}
              customerId={customerId}
              onNotesUpdated={fetchCustomerData}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gift Points Modal */}
      <GiftPointsModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        customerId={customerId}
        customerName={customer.name || customer.email}
        currentPoints={customer.currentPoints}
        onSuccess={handleGiftPointsSuccess}
      />
      </motion.div>
    </AdminLayout>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-white/5 flex items-center justify-center">
        <Icon size={20} className="text-pink-400" />
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-xs text-white/50">{label}</p>
    </div>
  );
}

// Customer Notes Section
interface CustomerNotesSectionProps {
  notes: Note[];
  customerId: string;
  onNotesUpdated: () => void;
}

function CustomerNotesSection({ notes, customerId, onNotesUpdated }: CustomerNotesSectionProps) {
  const [newNote, setNewNote] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNote.trim(),
          isImportant,
        }),
      });

      if (response.ok) {
        setNewNote('');
        setIsImportant(false);
        onNotesUpdated();
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;

    try {
      const response = await fetch(`/api/admin/customers/${customerId}/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onNotesUpdated();
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  return (
    <div className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Customer Notes</h3>
      
      {/* Add Note Form */}
      <form onSubmit={handleSubmitNote} className="mb-6">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note about this customer..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none"
          rows={3}
        />
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
            <input
              type="checkbox"
              checked={isImportant}
              onChange={(e) => setIsImportant(e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-pink-500 focus:ring-pink-500/50"
            />
            Mark as important
          </label>
          <button
            type="submit"
            disabled={submitting || !newNote.trim()}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-500/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {submitting ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </form>

      {/* Notes List */}
      <div className="space-y-3">
        {notes.map((note) => (
          <motion.div
            key={note.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-4 rounded-xl ${
              note.isImportant
                ? 'bg-yellow-500/10 border border-yellow-500/20'
                : 'bg-white/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                {note.isImportant && (
                  <span className="inline-flex items-center gap-1 text-xs text-yellow-400 mb-2">
                    <Warning size={12} />
                    Important
                  </span>
                )}
                <p className="text-white whitespace-pre-wrap">{note.content}</p>
                <p className="text-xs text-white/40 mt-2">
                  {note.authorName && `${note.authorName} • `}
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDeleteNote(note.id)}
                className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              >
                <Trash size={16} />
              </button>
            </div>
          </motion.div>
        ))}
        {notes.length === 0 && (
          <div className="text-center py-8">
            <Info size={32} className="text-white/20 mx-auto mb-2" />
            <p className="text-white/40">No notes yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
