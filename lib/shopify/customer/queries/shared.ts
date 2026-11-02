import type { ShopImage } from '../../types'
import type { ShopifyUserError } from '../../errors'

/** Pieces shared by the customer query files; not part of the public surface. */

export type RawUserError = { field: string[] | null; message: string; code: string | null }

/** Customer Account images carry only `url` + `altText` in the validated documents. */
export type RawCustomerImage = { url: string; altText: string | null } | null

export function toShopifyUserErrors(errors: RawUserError[]): ShopifyUserError[] {
  return errors.map((error) =>
    error.code === null || error.code === undefined
      ? { field: error.field, message: error.message }
      : { field: error.field, message: error.message, code: error.code }
  )
}

export function toCustomerImage(raw: RawCustomerImage | undefined): ShopImage | null {
  if (!raw) return null
  return { url: raw.url, altText: raw.altText ?? null, width: null, height: null }
}
