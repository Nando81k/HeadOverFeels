/**
 * PreChatQuestionnaire Component
 * 
 * Step-by-step questionnaire that gathers issue details before connecting
 * the customer to a live agent. Creates context for agents to understand
 * the issue before accepting the chat.
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Truck,
  ArrowUUpLeft,
  CreditCard,
  TShirt,
  Heart,
  User,
  ChatCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Spinner,
  X,
} from '@phosphor-icons/react';
import {
  ISSUE_CATEGORIES,
  QUESTIONNAIRE_FLOWS,
  getVisibleQuestions,
  validateStep,
  type QuestionnaireFlow,
  type QuestionnaireStep,
  type Question,
} from '@/lib/support/questionnaire-flows';

// Helper function to get icon by name
function getCategoryIcon(iconName: string) {
  switch (iconName) {
    case 'Package': return Package;
    case 'Truck': return Truck;
    case 'ArrowUUpLeft': return ArrowUUpLeft;
    case 'CreditCard': return CreditCard;
    case 'TShirt': return TShirt;
    case 'Heart': return Heart;
    case 'User': return User;
    case 'ChatCircle': return ChatCircle;
    default: return ChatCircle;
  }
}

interface PreChatQuestionnaireProps {
  customerName?: string;
  customerEmail?: string;
  onComplete: (data: {
    category: string;
    answers: Record<string, string>;
    customerName: string;
    customerEmail: string;
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    date: string;
    total: number;
    status: string;
  }>;
}

type Phase = 'category' | 'contact' | 'questions' | 'confirm';

export default function PreChatQuestionnaire({
  customerName: initialName = '',
  customerEmail: initialEmail = '',
  onComplete,
  onCancel,
  isSubmitting = false,
  recentOrders = [],
}: PreChatQuestionnaireProps) {
  // State
  const [phase, setPhase] = useState<Phase>(initialEmail ? 'category' : 'contact');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState(initialName);
  const [customerEmail, setCustomerEmail] = useState(initialEmail);

  // Get current flow and step
  const currentFlow: QuestionnaireFlow | null = selectedCategory 
    ? QUESTIONNAIRE_FLOWS[selectedCategory] 
    : null;
  const currentStep: QuestionnaireStep | null = currentFlow 
    ? currentFlow.steps[currentStepIndex] 
    : null;

  // Calculate progress
  const totalSteps = currentFlow ? currentFlow.steps.length : 0;
  const progress = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  // Handle category selection
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setAnswers({});
    setErrors({});
    setCurrentStepIndex(0);
    setPhase('questions');
  };

  // Handle answer change
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    // Clear error when user starts typing
    if (errors[questionId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  // Handle contact form submission
  const handleContactSubmit = () => {
    const newErrors: Record<string, string> = {};
    
    if (!customerName.trim()) {
      newErrors.name = 'Please enter your name';
    }
    if (!customerEmail.trim()) {
      newErrors.email = 'Please enter your email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setPhase('category');
  };

  // Handle next step
  const handleNext = () => {
    if (!currentFlow || !currentStep) return;

    // Validate current step
    const { valid, errors: stepErrors } = validateStep(currentStep, answers);
    if (!valid) {
      setErrors(stepErrors);
      return;
    }

    // Check for custom next step from answer
    const visibleQuestions = getVisibleQuestions(currentStep, answers);
    for (const question of visibleQuestions) {
      if (question.options) {
        const selectedOption = question.options.find(o => o.value === answers[question.id]);
        if (selectedOption?.nextStep) {
          const nextIndex = currentFlow.steps.findIndex(s => s.id === selectedOption.nextStep);
          if (nextIndex !== -1) {
            setCurrentStepIndex(nextIndex);
            setErrors({});
            return;
          }
        }
      }
    }

    // Default: go to next step or confirm
    if (currentStepIndex < currentFlow.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setErrors({});
    } else {
      setPhase('confirm');
    }
  };

  // Handle back
  const handleBack = () => {
    if (phase === 'confirm') {
      setPhase('questions');
      return;
    }
    if (phase === 'questions' && currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setErrors({});
      return;
    }
    if (phase === 'questions' && currentStepIndex === 0) {
      setSelectedCategory(null);
      setPhase('category');
      return;
    }
    if (phase === 'category' && !initialEmail) {
      setPhase('contact');
    }
  };

  // Handle submit
  const handleSubmit = () => {
    if (!selectedCategory) return;
    
    onComplete({
      category: selectedCategory,
      answers,
      customerName,
      customerEmail,
    });
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {phase !== 'contact' && phase !== 'category' && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft size={18} className="text-white/60" />
              </button>
            )}
            <h3 className="text-white font-semibold">
              {phase === 'contact' && 'Your Information'}
              {phase === 'category' && 'How can we help?'}
              {phase === 'questions' && currentFlow?.name}
              {phase === 'confirm' && 'Confirm Details'}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-white/60" />
          </button>
        </div>

        {/* Progress bar */}
        {phase === 'questions' && totalSteps > 1 && (
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {/* Contact Phase */}
          {phase === 'contact' && (
            <motion.div
              key="contact"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-white/60 text-sm">
                Please provide your contact information so our team can assist you.
              </p>

              <div>
                <label className="block text-sm text-white/70 mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your name"
                  className={`w-full px-3 py-2.5 bg-white/5 border rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all ${
                    errors.name ? 'border-red-500' : 'border-white/10'
                  }`}
                />
                {errors.name && (
                  <p className="text-red-400 text-xs mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="your@email.com"
                  className={`w-full px-3 py-2.5 bg-white/5 border rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all ${
                    errors.email ? 'border-red-500' : 'border-white/10'
                  }`}
                />
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              <button
                onClick={handleContactSubmit}
                className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {/* Category Selection Phase */}
          {phase === 'category' && (
            <motion.div
              key="category"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-2"
            >
              {ISSUE_CATEGORIES.map((category) => {
                const IconComponent = getCategoryIcon(category.icon || 'ChatCircle');
                return (
                  <button
                    key={category.value}
                    onClick={() => handleCategorySelect(category.value)}
                    className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/50 rounded-xl transition-all text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-pink-500/20 group-hover:bg-pink-500/30 transition-colors">
                        <IconComponent size={20} className="text-pink-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{category.label}</p>
                        <p className="text-white/50 text-sm mt-0.5">{category.description}</p>
                      </div>
                      <ArrowRight size={18} className="text-white/30 group-hover:text-pink-400 transition-colors mt-1" />
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}

          {/* Questions Phase */}
          {phase === 'questions' && currentStep && (
            <motion.div
              key={`step-${currentStepIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="mb-4">
                <h4 className="text-white font-medium">{currentStep.title}</h4>
                {currentStep.description && (
                  <p className="text-white/50 text-sm mt-1">{currentStep.description}</p>
                )}
              </div>

              {getVisibleQuestions(currentStep, answers).map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={answers[question.id] || ''}
                  onChange={(value) => handleAnswerChange(question.id, value)}
                  error={errors[question.id]}
                  recentOrders={recentOrders}
                />
              ))}
            </motion.div>
          )}

          {/* Confirm Phase */}
          {phase === 'confirm' && currentFlow && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="text-white font-medium mb-3">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Issue Type:</span>
                    <span className="text-white">{currentFlow.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Priority:</span>
                    <PriorityBadge priority={currentFlow.getPriority(answers)} />
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-white/50">Summary:</span>
                    <p className="text-white mt-1">{currentFlow.generateSummary(answers)}</p>
                  </div>
                </div>
              </div>

              <p className="text-white/50 text-sm text-center">
                You&apos;ll be connected to the next available agent.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-4 border-t border-white/10">
        {phase === 'questions' && (
          <button
            onClick={handleNext}
            className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {currentStepIndex < (currentFlow?.steps.length || 1) - 1 ? (
              <>
                Next
                <ArrowRight size={18} />
              </>
            ) : (
              <>
                Review & Connect
                <Check size={18} />
              </>
            )}
          </button>
        )}

        {phase === 'confirm' && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-500/50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Spinner size={18} className="animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Connect to Agent
                <ChatCircle size={18} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Question Field Component
interface QuestionFieldProps {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    date: string;
    total: number;
    status: string;
  }>;
}

function QuestionField({ question, value, onChange, error, recentOrders = [] }: QuestionFieldProps) {
  switch (question.type) {
    case 'select':
      return (
        <div>
          <label className="block text-sm text-white/70 mb-2">{question.text}</label>
          {question.subtext && (
            <p className="text-white/40 text-xs mb-2">{question.subtext}</p>
          )}
          <div className="space-y-2">
            {question.options?.map((option) => (
              <button
                key={option.value}
                onClick={() => onChange(option.value)}
                className={`w-full p-3 border rounded-xl text-left transition-all flex items-center gap-3 ${
                  value === option.value
                    ? 'bg-pink-500/20 border-pink-500'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    value === option.value ? 'border-pink-500' : 'border-white/30'
                  }`}
                >
                  {value === option.value && (
                    <div className="w-2 h-2 rounded-full bg-pink-500" />
                  )}
                </div>
                <span className={value === option.value ? 'text-white' : 'text-white/70'}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
      );

    case 'yesno':
      return (
        <div>
          <label className="block text-sm text-white/70 mb-2">{question.text}</label>
          <div className="flex gap-3">
            {['yes', 'no'].map((opt) => (
              <button
                key={opt}
                onClick={() => onChange(opt)}
                className={`flex-1 py-3 border rounded-xl transition-all ${
                  value === opt
                    ? 'bg-pink-500/20 border-pink-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                }`}
              >
                {opt === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
      );

    case 'order-select':
      return (
        <div>
          <label className="block text-sm text-white/70 mb-2">{question.text}</label>
          {question.subtext && (
            <p className="text-white/40 text-xs mb-2">{question.subtext}</p>
          )}
          
          {recentOrders.length > 0 ? (
            <div className="space-y-2 mb-3">
              {recentOrders.slice(0, 5).map((order) => (
                <button
                  key={order.id}
                  onClick={() => onChange(order.id)}
                  className={`w-full p-3 border rounded-xl text-left transition-all ${
                    value === order.id
                      ? 'bg-pink-500/20 border-pink-500'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-medium ${value === order.id ? 'text-white' : 'text-white/80'}`}>
                        {order.orderNumber}
                      </p>
                      <p className="text-white/50 text-sm">{order.date}</p>
                    </div>
                    <div className="text-right">
                      <p className={value === order.id ? 'text-white' : 'text-white/70'}>
                        ${order.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-white/40">{order.status}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {/* Manual entry option */}
          <div className="relative">
            <input
              type="text"
              value={value && !recentOrders.find(o => o.id === value) ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Or enter order number manually..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
            />
          </div>
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
      );

    case 'textarea':
      return (
        <div>
          <label className="block text-sm text-white/70 mb-1.5">{question.text}</label>
          {question.subtext && (
            <p className="text-white/40 text-xs mb-2">{question.subtext}</p>
          )}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder}
            rows={4}
            className={`w-full px-3 py-2.5 bg-white/5 border rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none transition-all ${
              error ? 'border-red-500' : 'border-white/10'
            }`}
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
      );

    case 'email':
      return (
        <div>
          <label className="block text-sm text-white/70 mb-1.5">{question.text}</label>
          <input
            type="email"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder || 'your@email.com'}
            className={`w-full px-3 py-2.5 bg-white/5 border rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all ${
              error ? 'border-red-500' : 'border-white/10'
            }`}
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
      );

    case 'text':
    default:
      return (
        <div>
          <label className="block text-sm text-white/70 mb-1.5">{question.text}</label>
          {question.subtext && (
            <p className="text-white/40 text-xs mb-2">{question.subtext}</p>
          )}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder}
            className={`w-full px-3 py-2.5 bg-white/5 border rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all ${
              error ? 'border-red-500' : 'border-white/10'
            }`}
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
      );
  }
}

// Priority Badge Component
function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-gray-500/20 text-gray-400',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400',
    HIGH: 'bg-orange-500/20 text-orange-400',
    URGENT: 'bg-red-500/20 text-red-400',
  };

  const colorClass = priority && colors[priority] ? colors[priority] : colors.MEDIUM;

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {priority || 'MEDIUM'}
    </span>
  );
}
