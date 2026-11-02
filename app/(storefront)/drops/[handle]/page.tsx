/**
 * A drop product is a product: `/drops/<handle>` renders the same PDP as
 * `/products/<handle>` (plan route map). Phase 5 layers the drop state machine
 * — upcoming · early-access · live · ended — on top of this route.
 *
 * Route segment config cannot be re-exported (Next parses it statically), so
 * `revalidate` is redeclared with the same value as the products page.
 */
export { default, generateMetadata } from '../../products/[handle]/page'

export const revalidate = 300
