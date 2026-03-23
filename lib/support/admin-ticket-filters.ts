export type AdminTicketFilterState = {
  search: string
  status: string
  type: string
  priority: string
}

export type AdminTicketFilterChip = {
  key: 'search' | 'status' | 'type' | 'priority'
  label: string
  value: string
}

export function buildAdminTicketSearchParams(
  filters: AdminTicketFilterState,
  pagination: { page: number; limit: number }
): URLSearchParams {
  const params = new URLSearchParams({
    page: String(pagination.page),
    limit: String(pagination.limit),
  })

  if (filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.status.trim()) params.set('status', filters.status.trim())
  if (filters.type.trim()) params.set('type', filters.type.trim())
  if (filters.priority.trim()) params.set('priority', filters.priority.trim())

  return params
}

export function getActiveTicketFilterChips(filters: AdminTicketFilterState): AdminTicketFilterChip[] {
  const chips: AdminTicketFilterChip[] = []

  if (filters.search.trim()) {
    chips.push({ key: 'search', label: 'Search', value: filters.search.trim() })
  }

  if (filters.status.trim()) {
    chips.push({ key: 'status', label: 'Status', value: filters.status.replace('_', ' ') })
  }

  if (filters.type.trim()) {
    chips.push({ key: 'type', label: 'Type', value: filters.type.replace('_', ' ') })
  }

  if (filters.priority.trim()) {
    chips.push({ key: 'priority', label: 'Priority', value: filters.priority })
  }

  return chips
}
