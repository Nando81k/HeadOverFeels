/**
 * Customer API Utilities
 * 
 * Client-side utilities for interacting with customer endpoints
 */

export interface CustomerListItem {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  totalSpent: number;
  totalOrders: number;
  lastOrderDate: Date | null;
  avgOrderValue: number;
  segment: string;
  createdAt: Date;
}

export interface CustomerDetail extends CustomerListItem {
  birthday: Date | null;
  newsletter: boolean;
  smsOptIn: boolean;
  isAdmin: boolean;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: Date;
  }>;
  notes: Array<{
    id: string;
    content: string;
    authorName: string;
    isImportant: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  content: string;
  authorId: string;
  authorName: string;
  isImportant: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerListFilters {
  search?: string;
  segment?: 'VIP' | 'New' | 'At-Risk' | 'Active' | 'Inactive';
  minSpent?: number;
  minOrders?: number;
  sortBy?: 'name' | 'email' | 'totalSpent' | 'totalOrders' | 'lastOrderDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedCustomerResponse {
  customers: CustomerListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Fetch customers list with filters and pagination
 */
export async function fetchCustomers(
  filters: CustomerListFilters = {}
): Promise<PaginatedCustomerResponse> {
  const params = new URLSearchParams();
  
  if (filters.search) params.append('search', filters.search);
  if (filters.segment) params.append('segment', filters.segment);
  if (filters.minSpent !== undefined) params.append('minSpent', filters.minSpent.toString());
  if (filters.minOrders !== undefined) params.append('minOrders', filters.minOrders.toString());
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  
  const response = await fetch(`/api/customers?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch customers: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch single customer details
 */
export async function fetchCustomerById(id: string): Promise<CustomerDetail> {
  const response = await fetch(`/api/customers/${id}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch customer: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.data;
}

/**
 * Add note to customer
 */
export async function addCustomerNote(
  customerId: string,
  content: string,
  isImportant: boolean = false
): Promise<ApiResponse<CustomerNote>> {
  const response = await fetch(`/api/customers/${customerId}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, isImportant }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to add note: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Update customer note
 */
export async function updateCustomerNote(
  customerId: string,
  noteId: string,
  content: string,
  isImportant: boolean
): Promise<ApiResponse<CustomerNote>> {
  const response = await fetch(`/api/customers/${customerId}/notes/${noteId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, isImportant }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update note: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Delete customer note
 */
export async function deleteCustomerNote(
  customerId: string,
  noteId: string
): Promise<ApiResponse<void>> {
  const response = await fetch(`/api/customers/${customerId}/notes/${noteId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete note: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Export customers to CSV
 */
export function exportCustomersToCSV(customers: CustomerListItem[]): string {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Total Spent',
    'Total Orders',
    'Avg Order Value',
    'Last Order Date',
    'Segment',
    'Member Since'
  ];
  
  const rows = customers.map(customer => [
    customer.name || '',
    customer.email,
    customer.phone || '',
    `$${customer.totalSpent.toFixed(2)}`,
    customer.totalOrders.toString(),
    `$${customer.avgOrderValue.toFixed(2)}`,
    customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'Never',
    customer.segment,
    new Date(customer.createdAt).toLocaleDateString()
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCustomersCSV(customers: CustomerListItem[], filename?: string) {
  const csv = exportCustomersToCSV(customers);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename || `customers-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
