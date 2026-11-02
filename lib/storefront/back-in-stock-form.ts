/**
 * Back-in-stock form contract shared by the Server Action and the client form
 * (Phase 5, Task 3). Lives outside the `'use server'` module because that file
 * may only export async functions.
 */

export type BackInStockFormState = {
  status: 'idle' | 'success' | 'error'
  /** The address the alert goes to, echoed on success. */
  email?: string
  error?: string
  code?: string
  values?: { email: string }
}

export const BACK_IN_STOCK_IDLE: BackInStockFormState = { status: 'idle' }
export const BACK_IN_STOCK_EMAIL_ERROR = 'Enter a valid email address.'
export const BACK_IN_STOCK_GENERIC_ERROR = 'Could not save your alert. Please try again.'
