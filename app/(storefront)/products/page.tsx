import { redirect } from 'next/navigation'

/**
 * `/products` is an alias of the catch-all collection.
 *
 * `next.config.ts` also carries a permanent redirect for the same path; this
 * page keeps the alias working for client-side navigations that never hit the
 * config (and if the config rule is ever dropped).
 */
export default function ProductsAliasPage(): never {
  redirect('/collections/all')
}
