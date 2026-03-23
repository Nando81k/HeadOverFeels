export const ADMIN_CUSTOMER_SEGMENTS = ['VIP', 'New', 'At-Risk', 'Active', 'Inactive'] as const
export const ADMIN_CUSTOMER_SORT_FIELDS = [
  'createdAt',
  'name',
  'email',
  'totalSpent',
  'totalOrders',
  'lastOrderDate',
  'currentPoints',
] as const

export type AdminCustomerSegment = (typeof ADMIN_CUSTOMER_SEGMENTS)[number]
export type AdminCustomerSortField = (typeof ADMIN_CUSTOMER_SORT_FIELDS)[number]
export type AdminCustomerSortDirection = 'asc' | 'desc'

export type AdminCustomerFilterState = {
  search: string
  segment: string
  tier: string
  minSpent: string
  minOrders: string
  sortBy: AdminCustomerSortField
  sortDir: AdminCustomerSortDirection
}

export type ParsedAdminCustomerQuery = {
  search: string
  segment?: AdminCustomerSegment
  tier?: string
  minSpent?: number
  minOrders?: number
  sortBy: AdminCustomerSortField
  sortDir: AdminCustomerSortDirection
  page: number
  limit: number
  skip: number
}

export type AdminCustomerFilterChip = {
  key: 'search' | 'segment' | 'tier' | 'minSpent' | 'minOrders'
  label: string
  value: string
}

export function isValidAdminCustomerSegment(value: string): value is AdminCustomerSegment {
  return ADMIN_CUSTOMER_SEGMENTS.includes(value as AdminCustomerSegment)
}

export function isValidAdminCustomerSortField(value: string): value is AdminCustomerSortField {
  return ADMIN_CUSTOMER_SORT_FIELDS.includes(value as AdminCustomerSortField)
}

export function parseAdminCustomerSort(
  sortByParam: string | null,
  sortDirParam: string | null
): { sortBy: AdminCustomerSortField; sortDir: AdminCustomerSortDirection } {
  const normalizedSortBy = (sortByParam || '').trim()
  const sortBy = isValidAdminCustomerSortField(normalizedSortBy) ? normalizedSortBy : 'createdAt'
  const sortDir = sortDirParam === 'asc' ? 'asc' : 'desc'
  return { sortBy, sortDir }
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

export function parsePositiveInteger(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined
  }

  return parsed
}

export function parseAdminCustomerQuery(searchParams: URLSearchParams): ParsedAdminCustomerQuery {
  const rawPage = Number.parseInt(searchParams.get('page') || '1', 10)
  const rawLimit = Number.parseInt(searchParams.get('limit') || '20', 10)
  const page = Math.min(10000, Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage))
  const limit = Math.min(100, Math.max(1, Number.isNaN(rawLimit) ? 20 : rawLimit))

  const search = (searchParams.get('search') || '').trim().slice(0, 255)
  const segmentParam = (searchParams.get('segment') || '').trim()
  const segment = isValidAdminCustomerSegment(segmentParam) ? segmentParam : undefined
  const tier = (searchParams.get('tier') || '').trim() || undefined

  const minSpent = parsePositiveNumber(searchParams.get('minSpent'))
  const minOrders = parsePositiveInteger(searchParams.get('minOrders'))
  const { sortBy, sortDir } = parseAdminCustomerSort(
    searchParams.get('sortBy'),
    searchParams.get('sortDir')
  )

  return {
    search,
    segment,
    tier,
    minSpent,
    minOrders,
    sortBy,
    sortDir,
    page,
    limit,
    skip: (page - 1) * limit,
  }
}

export function buildAdminCustomersSearchParams(
  filters: AdminCustomerFilterState,
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

  const segment = filters.segment.trim()
  if (segment && isValidAdminCustomerSegment(segment)) {
    params.set('segment', segment)
  }

  const tier = filters.tier.trim()
  if (tier) {
    params.set('tier', tier)
  }

  const minSpent = parsePositiveNumber(filters.minSpent)
  if (typeof minSpent === 'number') {
    params.set('minSpent', String(minSpent))
  }

  const minOrders = parsePositiveInteger(filters.minOrders)
  if (typeof minOrders === 'number') {
    params.set('minOrders', String(minOrders))
  }

  return params
}

export function getActiveCustomerFilterChips(filters: AdminCustomerFilterState): AdminCustomerFilterChip[] {
  const chips: AdminCustomerFilterChip[] = []

  if (filters.search.trim()) {
    chips.push({
      key: 'search',
      label: 'Search',
      value: filters.search.trim(),
    })
  }

  if (filters.segment.trim() && isValidAdminCustomerSegment(filters.segment.trim())) {
    chips.push({
      key: 'segment',
      label: 'Segment',
      value: filters.segment.trim(),
    })
  }

  if (filters.tier.trim()) {
    chips.push({
      key: 'tier',
      label: 'Tier',
      value: filters.tier.trim(),
    })
  }

  if (filters.minSpent.trim()) {
    chips.push({
      key: 'minSpent',
      label: 'Min Spent',
      value: `$${filters.minSpent.trim()}`,
    })
  }

  if (filters.minOrders.trim()) {
    chips.push({
      key: 'minOrders',
      label: 'Min Orders',
      value: filters.minOrders.trim(),
    })
  }

  return chips
}
