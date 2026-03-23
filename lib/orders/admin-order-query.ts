export const ORDER_STATUS_VALUES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const

export const PAYMENT_STATUS_VALUES = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
] as const

export const ADMIN_ORDER_SORT_FIELDS = ['createdAt', 'total', 'status'] as const

export type AdminOrderStatus = (typeof ORDER_STATUS_VALUES)[number]
export type AdminPaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number]
export type AdminOrderSortField = (typeof ADMIN_ORDER_SORT_FIELDS)[number]
export type AdminOrderSortDirection = 'asc' | 'desc'

export type AdminOrderFilterState = {
  search: string
  statuses: string[]
  paymentStatus: string
  minTotal: string
  maxTotal: string
  dateFrom?: Date | null
  dateTo?: Date | null
  sortBy: AdminOrderSortField
  sortDir: AdminOrderSortDirection
}

export function isValidOrderStatus(status: string): status is AdminOrderStatus {
  return ORDER_STATUS_VALUES.includes(status as AdminOrderStatus)
}

export function isValidPaymentStatus(status: string): status is AdminPaymentStatus {
  return PAYMENT_STATUS_VALUES.includes(status as AdminPaymentStatus)
}

export function parseStatuses(statusesParam: string | null, statusParam: string | null): AdminOrderStatus[] {
  const values = new Set<string>()

  if (statusesParam) {
    statusesParam
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
      .forEach((value) => values.add(value))
  }

  if (statusParam) {
    values.add(statusParam.trim().toUpperCase())
  }

  return Array.from(values).filter(isValidOrderStatus)
}

export function parsePaymentStatus(paymentStatus: string | null): AdminPaymentStatus | undefined {
  if (!paymentStatus) {
    return undefined
  }
  const normalized = paymentStatus.trim().toUpperCase()
  return isValidPaymentStatus(normalized) ? normalized : undefined
}

export function parsePositiveNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined
  }
  return parsed
}

export function parseDateValue(value: string | null): Date | undefined {
  if (!value) {
    return undefined
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function parseSort(
  sortByParam: string | null,
  sortDirParam: string | null
): { sortBy: AdminOrderSortField; sortDir: AdminOrderSortDirection } {
  const normalizedSortBy = sortByParam?.trim() || 'createdAt'
  const sortBy = ADMIN_ORDER_SORT_FIELDS.includes(normalizedSortBy as AdminOrderSortField)
    ? (normalizedSortBy as AdminOrderSortField)
    : 'createdAt'

  const sortDir = sortDirParam === 'asc' ? 'asc' : 'desc'

  return { sortBy, sortDir }
}

export function buildAdminOrdersSearchParams(
  filters: AdminOrderFilterState,
  pagination: { page: number; limit: number }
): URLSearchParams {
  const params = new URLSearchParams({
    page: String(pagination.page),
    limit: String(pagination.limit),
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  })

  const search = filters.search.trim()
  if (search.length > 0) {
    params.set('search', search)
  }

  const validStatuses = filters.statuses
    .map((status) => status.toUpperCase())
    .filter(isValidOrderStatus)
  if (validStatuses.length > 0) {
    params.set('statuses', validStatuses.join(','))
  }

  const paymentStatus = parsePaymentStatus(filters.paymentStatus)
  if (paymentStatus) {
    params.set('paymentStatus', paymentStatus)
  }

  const minTotal = parsePositiveNumber(filters.minTotal)
  if (typeof minTotal === 'number') {
    params.set('minTotal', String(minTotal))
  }

  const maxTotal = parsePositiveNumber(filters.maxTotal)
  if (typeof maxTotal === 'number') {
    params.set('maxTotal', String(maxTotal))
  }

  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom.toISOString())
  }

  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo.toISOString())
  }

  return params
}

export type ActiveOrderFilterChip = {
  key: string
  label: string
  value: string
}

export function getActiveOrderFilterChips(filters: AdminOrderFilterState): ActiveOrderFilterChip[] {
  const chips: ActiveOrderFilterChip[] = []

  if (filters.search.trim()) {
    chips.push({
      key: 'search',
      label: 'Search',
      value: filters.search.trim(),
    })
  }

  if (filters.statuses.length > 0) {
    chips.push({
      key: 'statuses',
      label: 'Statuses',
      value: filters.statuses.join(', '),
    })
  }

  if (filters.paymentStatus.trim()) {
    chips.push({
      key: 'paymentStatus',
      label: 'Payment',
      value: filters.paymentStatus,
    })
  }

  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      key: 'dateRange',
      label: 'Date',
      value: `${filters.dateFrom ? filters.dateFrom.toLocaleDateString() : 'Any'} - ${filters.dateTo ? filters.dateTo.toLocaleDateString() : 'Any'}`,
    })
  }

  if (filters.minTotal || filters.maxTotal) {
    chips.push({
      key: 'totalRange',
      label: 'Total',
      value: `$${filters.minTotal || '0'} - $${filters.maxTotal || '∞'}`,
    })
  }

  return chips
}
