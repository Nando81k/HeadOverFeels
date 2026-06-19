'use client'

import type { AddressRow } from '@/lib/admin/customers'

/**
 * Placeholder stub for AddressInspector.
 *
 * The real implementation is delivered by Phase 8 Wave 4 (Task 17). This stub
 * exists only so that CustomerAddressesPanelClient (Task 10) can statically
 * import the module and so that TypeScript/Vitest can resolve it. Task 17 will
 * replace this file with the full create/update drawer form.
 */
export interface AddressInspectorProps {
  open: boolean
  customerId: string
  address: AddressRow | null
  onClose: () => void
}

export function AddressInspector(_props: AddressInspectorProps) {
  return null
}
