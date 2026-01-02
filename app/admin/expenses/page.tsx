'use client';

import { useState, useEffect } from 'react';
// Local type definition for ExpenseCategory until Prisma schema is updated
type ExpenseCategory = "MANUFACTURING" | "SHIPPING" | "MARKETING" | "PACKAGING" | "PLATFORM_FEES" | "HOSTING" | "LABOR" | "UTILITIES" | "SUPPLIES" | "RETURNS_REFUNDS" | "OTHER";

interface Expense {
  id: string;
  category: ExpenseCategory;
  subcategory?: string | null;
  amount: number;
  description: string;
  date: string;
  vendor?: string | null;
  invoiceNumber?: string | null;
  notes?: string | null;
  product?: { id: string; name: string; slug: string } | null;
  order?: { id: string; orderNumber: string } | null;
  createdAt: string;
}

interface ExpenseSummary {
  byCategory: Array<{
    category: ExpenseCategory;
    _sum: { amount: number | null };
    _count: { id: number };
  }>;
  total: number;
}

const EXPENSE_CATEGORIES = [
  { value: 'MANUFACTURING', label: 'Manufacturing', color: 'bg-purple-100 text-purple-800' },
  { value: 'SHIPPING', label: 'Shipping', color: 'bg-blue-100 text-blue-800' },
  { value: 'MARKETING', label: 'Marketing', color: 'bg-pink-100 text-pink-800' },
  { value: 'PACKAGING', label: 'Packaging', color: 'bg-green-100 text-green-800' },
  { value: 'PLATFORM_FEES', label: 'Platform Fees', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'HOSTING', label: 'Hosting', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'LABOR', label: 'Labor', color: 'bg-red-100 text-red-800' },
  { value: 'UTILITIES', label: 'Utilities', color: 'bg-teal-100 text-teal-800' },
  { value: 'SUPPLIES', label: 'Supplies', color: 'bg-orange-100 text-orange-800' },
  { value: 'RETURNS_REFUNDS', label: 'Returns & Refunds', color: 'bg-rose-100 text-rose-800' },
  { value: 'OTHER', label: 'Other', color: 'bg-gray-100 text-gray-800' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    category: 'MANUFACTURING' as ExpenseCategory,
    subcategory: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    invoiceNumber: '',
    notes: '',
  });

  useEffect(() => {
    fetchExpenses();
  }, [filterCategory, startDate, endDate]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterCategory) params.append('category', filterCategory);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/admin/expenses?${params}`);
      const data = await response.json();
      
      if (data.data) {
        setExpenses(data.data);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          subcategory: formData.subcategory || null,
          vendor: formData.vendor || null,
          invoiceNumber: formData.invoiceNumber || null,
          notes: formData.notes || null,
        }),
      });
      
      if (response.ok) {
        setShowAddForm(false);
        setFormData({
          category: 'MANUFACTURING',
          subcategory: '',
          amount: '',
          description: '',
          date: new Date().toISOString().split('T')[0],
          vendor: '',
          invoiceNumber: '',
          notes: '',
        });
        fetchExpenses();
      }
    } catch (error) {
      console.error('Error creating expense:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    try {
      const response = await fetch(`/api/admin/expenses/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        fetchExpenses();
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const getCategoryInfo = (category: ExpenseCategory) => {
    return EXPENSE_CATEGORIES.find(c => c.value === category) || EXPENSE_CATEGORIES[0];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Expense Tracking</h1>
          <p className="text-gray-600">
            Track and manage all store expenses for accurate profit calculations
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Total Expenses</h3>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(summary.total)}</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Total Transactions</h3>
              <p className="text-3xl font-bold text-gray-900">
                {summary.byCategory.reduce((sum, cat) => sum + cat._count.id, 0)}
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">Categories</h3>
              <p className="text-3xl font-bold text-gray-900">{summary.byCategory.length}</p>
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {summary && summary.byCategory.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {summary.byCategory.map((cat) => {
                const categoryInfo = getCategoryInfo(cat.category);
                return (
                  <div key={cat.category} className="border rounded-lg p-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${categoryInfo.color}`}>
                      {categoryInfo.label}
                    </span>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(cat._sum.amount || 0)}</p>
                    <p className="text-sm text-gray-600">{cat._count.id} transactions</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions and Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              {showAddForm ? 'Cancel' : '+ Add Expense'}
            </button>
            
            <div className="flex-1 flex gap-4">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="">All Categories</option>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
              
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
          </div>

          {/* Add Expense Form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="border-t pt-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    placeholder="Brief description of expense"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor
                  </label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    placeholder="Company or person paid"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice #
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    placeholder="Reference number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    placeholder="Additional details"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Add Expense
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Expenses List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Expenses</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-600">Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-gray-600">No expenses found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expenses.map((expense) => {
                    const categoryInfo = getCategoryInfo(expense.category);
                    return (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(expense.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${categoryInfo.color}`}>
                            {categoryInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {expense.description}
                          {expense.invoiceNumber && (
                            <span className="block text-xs text-gray-500">#{expense.invoiceNumber}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {expense.vendor || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDelete(expense.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
