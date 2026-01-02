/**
 * Gift Points Modal Component
 * 
 * Admin modal for gifting care points to customers with:
 * - Points amount input
 * - Reason/description field
 * - Preset quick amounts
 * - Confirmation before sending
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Gift, 
  Star, 
  SpinnerGap,
  CheckCircle,
  Warning
} from '@phosphor-icons/react';

interface GiftPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerId: string;
  currentPoints: number;
  onSuccess?: (newBalance: number) => void;
}

const PRESET_AMOUNTS = [
  { value: 50, label: '50 pts', description: 'Small thank you' },
  { value: 100, label: '100 pts', description: 'Apology/compensation' },
  { value: 250, label: '250 pts', description: 'Loyalty reward' },
  { value: 500, label: '500 pts', description: 'VIP bonus' },
];

export default function GiftPointsModal({
  isOpen,
  onClose,
  customerName,
  customerId,
  currentPoints,
  onSuccess
}: GiftPointsModalProps) {
  const [points, setPoints] = useState<number>(100);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (points <= 0) {
      setError('Points must be greater than 0');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the gift');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/loyalty/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          action: 'adjustPoints',
          points,
          reason: `🎁 Admin Gift: ${reason}`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to gift points');
      }

      setSuccess(true);
      
      if (onSuccess) {
        onSuccess(data.newBalance);
      }

      // Close after showing success
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setPoints(100);
        setReason('');
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setError(null);
      setSuccess(false);
      setPoints(100);
      setReason('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div 
              className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Success State */}
              {success ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center"
                  >
                    <CheckCircle size={40} weight="fill" className="text-emerald-400" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white mb-2">Points Gifted!</h3>
                  <p className="text-white/60">
                    {points} Care Points sent to {customerName}
                  </p>
                </motion.div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/20">
                        <Gift size={24} weight="bold" className="text-amber-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">Gift Care Points</h2>
                        <p className="text-sm text-white/40">To {customerName}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white disabled:opacity-50"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Current balance info */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                      <Star size={20} weight="fill" className="text-amber-400" />
                      <span className="text-sm text-white/60">Current Balance:</span>
                      <span className="text-sm font-semibold text-amber-400">
                        {currentPoints.toLocaleString()} pts
                      </span>
                    </div>

                    {/* Preset amounts */}
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-3">
                        Quick Select
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {PRESET_AMOUNTS.map((preset) => (
                          <motion.button
                            key={preset.value}
                            type="button"
                            onClick={() => setPoints(preset.value)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`p-3 rounded-xl border transition-all ${
                              points === preset.value
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            <span className="block text-sm font-semibold">{preset.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Custom amount */}
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-2">
                        Amount
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={points}
                          onChange={(e) => setPoints(Math.max(0, parseInt(e.target.value) || 0))}
                          min="1"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 text-lg font-semibold"
                          placeholder="Enter points amount"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                          pts
                        </span>
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-2">
                        Reason <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 resize-none"
                        placeholder="e.g., Thank you for your loyalty, Compensation for delayed shipment..."
                      />
                    </div>

                    {/* Error message */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"
                      >
                        <Warning size={18} weight="bold" />
                        <span className="text-sm">{error}</span>
                      </motion.div>
                    )}

                    {/* Preview */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                      <p className="text-sm text-white/60 mb-1">After this gift:</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-amber-400">
                          {(currentPoints + points).toLocaleString()}
                        </span>
                        <span className="text-sm text-white/40">
                          (+{points.toLocaleString()})
                        </span>
                      </div>
                    </div>

                    {/* Submit button */}
                    <motion.button
                      type="submit"
                      disabled={isSubmitting || points <= 0}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <SpinnerGap size={20} className="animate-spin" />
                      ) : (
                        <Gift size={20} weight="bold" />
                      )}
                      {isSubmitting ? 'Sending...' : `Gift ${points} Care Points`}
                    </motion.button>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
