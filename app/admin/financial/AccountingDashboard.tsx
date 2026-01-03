'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  House,
  Receipt,
  Invoice,
  Wallet,
  Calculator,
  ChartLine,
  CurrencyDollar,
  TrendUp,
  CaretDown,
  ArrowUp,
  ArrowDown,
} from '@phosphor-icons/react';
import {
  ExpenseTracker,
  InvoiceManager,
  BudgetPlanner,
  TaxSummary,
  FinancialReports,
} from '@/components/admin/accounting';
import ProfitMarginCalculator from '@/components/admin/ProfitMarginCalculator';
import CashFlowProjections from '@/components/admin/CashFlowProjections';
import GlobalDateRangePicker, { getDefaultDateRange, DateRange } from '@/components/admin/GlobalDateRangePicker';

type TabId = 'overview' | 'expenses' | 'invoices' | 'budgets' | 'tax' | 'reports';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface QuickStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  pendingInvoices: number;
  budgetUtilization: number;
  revenueTrend: number;
  expenseTrend: number;
  profitTrend: number;
}

const tabs: Tab[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <House size={20} weight="duotone" />,
    description: 'Financial health at a glance',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    icon: <Receipt size={20} weight="duotone" />,
    description: 'Track and categorize business expenses',
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: <Invoice size={20} weight="duotone" />,
    description: 'Manage customer invoices and payments',
  },
  {
    id: 'budgets',
    label: 'Budgets',
    icon: <Wallet size={20} weight="duotone" />,
    description: 'Set and monitor spending limits',
  },
  {
    id: 'tax',
    label: 'Tax Center',
    icon: <Calculator size={20} weight="duotone" />,
    description: 'Tax planning and deduction tracking',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <ChartLine size={20} weight="duotone" />,
    description: 'Generate financial reports and exports',
  },
];

export default function AccountingDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());

  const fetchQuickStats = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = dateRange.startDate.toISOString();
      const endDate = dateRange.endDate.toISOString();
      const response = await fetch(`/api/admin/accounting/summary?startDate=${startDate}&endDate=${endDate}`);
      if (response.ok) {
        const data = await response.json();
        setQuickStats({
          totalRevenue: data.profitAndLoss?.revenue?.current || 0,
          totalExpenses: data.profitAndLoss?.expenses?.current || 0,
          netProfit: data.profitAndLoss?.netProfit?.current || 0,
          pendingInvoices: data.invoices?.pendingAmount || 0,
          budgetUtilization: data.budgetHealth?.overallUtilization || 0,
          revenueTrend: data.profitAndLoss?.revenue?.change || 0,
          expenseTrend: data.profitAndLoss?.expenses?.change || 0,
          profitTrend: data.profitAndLoss?.netProfit?.change || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch quick stats:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchQuickStats();
  }, [fetchQuickStats]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  const TrendIndicator = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const isPositive = value > 0;
    return (
      <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? <ArrowUp size={12} weight="bold" /> : <ArrowDown size={12} weight="bold" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Range Picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Financial Dashboard</h1>
          <p className="text-sm text-white/50">Track revenue, expenses, and business health</p>
        </div>
        <GlobalDateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Quick Stats Bar */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-24 mb-2"></div>
              <div className="h-7 bg-white/10 rounded w-20"></div>
            </div>
          ))}
        </div>
      ) : quickStats && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4"
        >
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400/80 text-sm mb-1">
                <TrendUp size={16} />
                Total Revenue
              </div>
              <TrendIndicator value={quickStats.revenueTrend} />
            </div>
            <div className="text-xl font-bold text-emerald-300">
              {formatCurrency(quickStats.totalRevenue)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 backdrop-blur-sm rounded-xl p-4 border border-rose-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400/80 text-sm mb-1">
                <Receipt size={16} />
                Total Expenses
              </div>
              <TrendIndicator value={-quickStats.expenseTrend} />
            </div>
            <div className="text-xl font-bold text-rose-300">
              {formatCurrency(quickStats.totalExpenses)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm rounded-xl p-4 border border-blue-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400/80 text-sm mb-1">
                <CurrencyDollar size={16} />
                Net Profit
              </div>
              <TrendIndicator value={quickStats.profitTrend} />
            </div>
            <div className={`text-xl font-bold ${quickStats.netProfit >= 0 ? 'text-blue-300' : 'text-red-400'}`}>
              {formatCurrency(quickStats.netProfit)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 backdrop-blur-sm rounded-xl p-4 border border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-400/80 text-sm mb-1">
              <Invoice size={16} />
              Pending Invoices
            </div>
            <div className="text-xl font-bold text-amber-300">
              {formatCurrency(quickStats.pendingInvoices)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-purple-400/80 text-sm mb-1">
              <Wallet size={16} />
              Budget Utilization
            </div>
            <div className={`text-xl font-bold ${
              quickStats.budgetUtilization > 100 ? 'text-red-400' :
              quickStats.budgetUtilization > 80 ? 'text-amber-300' : 'text-purple-300'
            }`}>
              {formatPercent(quickStats.budgetUtilization)}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="relative">
        {/* Desktop Tabs */}
        <div className="hidden md:flex items-center gap-1 bg-white/5 backdrop-blur-sm rounded-xl p-1 border border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-fuchsia-600 to-violet-600 rounded-lg"
                  transition={{ type: 'spring', duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{tab.icon}</span>
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Mobile Tab Selector */}
        <div className="md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 text-white"
          >
            <div className="flex items-center gap-2">
              {activeTabData?.icon}
              <span className="font-medium">{activeTabData?.label}</span>
            </div>
            <CaretDown
              size={20}
              className={`transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-50 w-full mt-2 bg-gray-900 rounded-xl border border-white/10 overflow-hidden shadow-xl"
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-fuchsia-600/20 text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    <div>
                      <div className="font-medium">{tab.label}</div>
                      <div className="text-xs text-gray-500">{tab.description}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'expenses' && <ExpenseTracker />}
          {activeTab === 'invoices' && <InvoiceManager />}
          {activeTab === 'budgets' && <BudgetPlanner />}
          {activeTab === 'tax' && <TaxSummary />}
          {activeTab === 'reports' && <FinancialReports />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-8">
      {/* Welcome Message */}
      <div className="bg-gradient-to-r from-fuchsia-600/20 to-violet-600/20 rounded-xl p-6 border border-fuchsia-500/20">
        <h2 className="text-xl font-bold text-white mb-2">
          Welcome to Your Accounting Suite
        </h2>
        <p className="text-gray-300">
          Manage all your business finances in one place. Track expenses, send invoices,
          plan budgets, and stay on top of your tax obligations.
        </p>
      </div>

      {/* Profit Margin Calculator */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
          <CurrencyDollar size={24} weight="duotone" className="text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Profit Margin Analysis</h3>
        </div>
        <div className="p-6">
          <ProfitMarginCalculator refreshInterval={60000} />
        </div>
      </div>

      {/* Cash Flow Projections */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
          <TrendUp size={24} weight="duotone" className="text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Cash Flow Projections</h3>
        </div>
        <div className="p-6">
          <CashFlowProjections refreshInterval={60000} />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLinkCard
          icon={<Receipt size={32} weight="duotone" className="text-rose-400" />}
          title="Record Expense"
          description="Log a new business expense with receipts"
          href="#expenses"
        />
        <QuickLinkCard
          icon={<Invoice size={32} weight="duotone" className="text-blue-400" />}
          title="Create Invoice"
          description="Generate a new customer invoice"
          href="#invoices"
        />
        <QuickLinkCard
          icon={<ChartLine size={32} weight="duotone" className="text-emerald-400" />}
          title="View Reports"
          description="Generate detailed financial reports"
          href="#reports"
        />
      </div>
    </div>
  );
}

interface QuickLinkCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

function QuickLinkCard({ icon, title, description }: QuickLinkCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 cursor-pointer hover:border-fuchsia-500/50 transition-colors"
    >
      <div className="mb-4">{icon}</div>
      <h4 className="font-semibold text-white mb-1">{title}</h4>
      <p className="text-sm text-gray-400">{description}</p>
    </motion.div>
  );
}
