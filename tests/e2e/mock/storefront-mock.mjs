#!/usr/bin/env node
/**
 * Mock Shopify Storefront API for the Playwright suite (Phase 3, Task 8).
 *
 *   node tests/e2e/mock/storefront-mock.mjs [--port 4443]
 *
 * Plain HTTP on 127.0.0.1. The dev server reaches it through
 * `SHOPIFY_STORE_DOMAIN=127.0.0.1:4443` + `SHOPIFY_STOREFRONT_INSECURE_LOCAL=1`
 * (see `lib/shopify/client.ts`), so no hosts entries or certificates are needed.
 *
 * - POST /api/<version>/graphql.json -> `{ data }` keyed on the operation name.
 *   Catalog operations answer from `tests/fixtures/shopify/*.json` (collections
 *   patched per handle, availability/price filters and price/title sort, an
 *   unknown handle -> null). Cart operations keep carts in memory, compute
 *   costs from the fixture prices, and accept `GOLD15` (15% off the subtotal)
 *   as the only applicable discount code.
 * - GET /s/files/**.(jpg|png|webp) -> a PNG from `public/assets` picked by keyword.
 * - GET /health -> 200 (Playwright's readiness probe).
 *
 * Test-only; no dependencies; exports nothing.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const FIXTURES = path.join(REPO, 'tests/fixtures/shopify')
const ASSETS = path.join(REPO, 'public/assets')
const portArg = process.argv.indexOf('--port')
const PORT = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.MOCK_PORT || 4443)
const CHECKOUT_ORIGIN = 'https://tgqucm-qg.myshopify.com'

// ------------------------------------------------------------------ fixtures

const load = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))

const fx = {
  shopLayout: load('shop-layout'),
  policies: load('policies'),
  collections: load('collections'),
  collectionProducts: load('collection-products'),
  productByHandle: load('product-by-handle'),
  predictiveSearch: load('predictive-search'),
  searchResults: load('search-results'),
  recommendations: load('recommendations'),
  sitemapProducts: load('sitemap-products'),
  sitemapCollections: load('sitemap-collections'),
}

const collectionNodes = fx.collections.collections.nodes
const productCards = fx.collectionProducts.collection.products.nodes
const findCollection = (handle) => collectionNodes.find((c) => c.handle === handle) ?? null
const findCard = (handle) => productCards.find((p) => p.handle === handle) ?? null
const amount = (p) => Number(p?.priceRange?.minVariantPrice?.amount ?? 0)

/** Narrow the fixture's cards to a collection, apply availability/price filters + sort. */
function productsFor(handle, variables) {
  let nodes = clone(productCards)

  // hoodies / tees carry matching tags on the cards; drops / best-sellers / all keep everything.
  if (handle !== 'all' && handle !== 'drops' && handle !== 'best-sellers') {
    const stem = handle.replace(/s$/, '').toLowerCase()
    const tagged = nodes.filter(
      (p) => (p.tags ?? []).includes(handle) || p.title.toLowerCase().includes(stem)
    )
    if (tagged.length > 0) nodes = tagged
  }

  const filters = Array.isArray(variables?.filters) ? variables.filters : []
  for (const f of filters) {
    if (f && typeof f.available === 'boolean') nodes = nodes.filter((p) => p.availableForSale === f.available)
    if (f && f.price) {
      const min = Number(f.price.min ?? -Infinity)
      const max = Number(f.price.max ?? Infinity)
      nodes = nodes.filter((p) => amount(p) >= min && amount(p) <= max)
    }
  }

  const sortKey = variables?.sortKey
  if (sortKey === 'PRICE') nodes.sort((a, b) => amount(a) - amount(b))
  else if (sortKey === 'TITLE') nodes.sort((a, b) => a.title.localeCompare(b.title))
  if (variables?.reverse) nodes.reverse()

  return nodes
}

const catalog = {
  ShopLayout: () => fx.shopLayout,
  Policies: () => fx.policies,
  Collections: () => fx.collections,
  PredictiveSearch: () => fx.predictiveSearch,
  SearchProducts: (vars) => {
    const data = clone(fx.searchResults)
    data.search.nodes = productsFor('all', vars).filter((p) =>
      fx.searchResults.search.nodes.some((n) => n.handle === p.handle)
    )
    if (data.search.nodes.length === 0) data.search.nodes = clone(fx.searchResults.search.nodes)
    data.search.totalCount = data.search.nodes.length
    return data
  },
  Recommendations: () => fx.recommendations,
  SitemapProducts: () => fx.sitemapProducts,
  SitemapCollections: () => fx.sitemapCollections,

  CollectionProducts: (vars) => {
    const handle = vars?.handle ?? 'all'
    const data = clone(fx.collectionProducts)
    if (handle !== 'all') {
      const summary = findCollection(handle)
      if (!summary) return { collection: null }
      data.collection.id = summary.id
      data.collection.handle = summary.handle
      data.collection.title = summary.title
      data.collection.descriptionHtml = summary.description ? `<p>${summary.description}</p>` : ''
      data.collection.image = summary.image
    }
    data.collection.products.nodes = productsFor(handle, vars)
    return data
  },

  ProductByHandle: (vars) => {
    const handle = vars?.handle
    if (!handle || handle === fx.productByHandle.product.handle) return fx.productByHandle
    const card = findCard(handle)
    if (!card) return { product: null }
    const data = clone(fx.productByHandle)
    const p = data.product
    Object.assign(p, {
      id: card.id,
      handle: card.handle,
      title: card.title,
      availableForSale: card.availableForSale,
      tags: card.tags,
      featuredImage: card.featuredImage,
      images: card.images,
      priceRange: card.priceRange,
      compareAtPriceRange: card.compareAtPriceRange,
    })
    if (p.seo) p.seo = { title: card.title, description: p.seo.description }
    // Options / variants / gallery / metafields stay from the fixture.
    return data
  },
}

// ------------------------------------------------------------------ merchandise

/** merchandiseId -> the `... on ProductVariant` shape `CartLineFields` selects. */
const merchandise = new Map()

const productRef = (p, maxPerOrder) => ({
  id: p.id,
  handle: p.handle,
  title: p.title,
  tags: p.tags ?? [],
  featuredImage: p.featuredImage ?? null,
  maxPerOrder,
})

const pdp = fx.productByHandle.product
for (const v of pdp.variants.nodes) {
  merchandise.set(v.id, {
    id: v.id,
    title: v.title,
    sku: v.sku ?? null,
    availableForSale: v.availableForSale,
    quantityAvailable: v.quantityAvailable ?? null,
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? null,
    selectedOptions: v.selectedOptions,
    image: v.image ?? null,
    product: productRef(pdp, pdp.maxPerOrder?.value ? { value: pdp.maxPerOrder.value } : null),
  })
}

// Every other card gets one synthesized default variant; the drop caps at 2 per order.
for (const card of productCards) {
  if (card.handle === pdp.handle) continue
  const id = `gid://shopify/ProductVariant/${card.id.split('/').pop()}00`
  const compareAt = card.compareAtPriceRange?.minVariantPrice
  const isDrop = (card.tags ?? []).includes('drop')
  merchandise.set(id, {
    id,
    title: 'Default Title',
    sku: `HOF-${card.handle.toUpperCase()}`,
    availableForSale: card.availableForSale,
    quantityAvailable: card.availableForSale ? 10 : 0,
    price: card.priceRange.minVariantPrice,
    compareAtPrice: compareAt && Number(compareAt.amount) > 0 ? compareAt : null,
    selectedOptions: [{ name: 'Title', value: 'Default Title' }],
    image: card.featuredImage ?? null,
    product: productRef(card, isDrop ? { value: '2' } : null),
  })
}

// ------------------------------------------------------------------ carts

const carts = new Map()
let cartSeq = 0
let lineSeq = 0

const cents = (money) => Math.round(Number(money.amount) * 100)
/** 17600 -> "176.0", 2640 -> "26.4" (Shopify's decimal-string style). */
const decimal = (value) => (value / 100).toFixed(2).replace(/0$/, '')
const money = (value, currencyCode = 'USD') => ({ amount: decimal(value), currencyCode })
const isGold = (code) => code.trim().toUpperCase() === 'GOLD15'

function newCart() {
  const n = ++cartSeq
  const cart = {
    id: `gid://shopify/Cart/mock-${n}`,
    checkoutUrl: `${CHECKOUT_ORIGIN}/checkouts/cn/mock-${n}`,
    note: '',
    lines: [],
    discountCodes: [],
    buyerIdentity: { email: null, countryCode: 'US', customer: null },
  }
  carts.set(cart.id, cart)
  return cart
}

/** Serialise an in-memory cart into the `CartFields` selection. */
function view(cart) {
  const nodes = cart.lines.map((line) => {
    const m = merchandise.get(line.merchandiseId)
    const unit = cents(m.price)
    return {
      id: line.id,
      quantity: line.quantity,
      attributes: [],
      cost: {
        totalAmount: money(unit * line.quantity),
        amountPerQuantity: money(unit),
        compareAtAmountPerQuantity: m.compareAtPrice ? money(cents(m.compareAtPrice)) : null,
      },
      discountAllocations: [],
      merchandise: m,
    }
  })
  const subtotal = cart.lines.reduce(
    (sum, line) => sum + cents(merchandise.get(line.merchandiseId).price) * line.quantity,
    0
  )
  const discountCodes = cart.discountCodes.map((code) => ({ code, applicable: isGold(code) && subtotal > 0 }))
  const discount = discountCodes.some((d) => d.applicable) ? Math.round(subtotal * 0.15) : 0
  const total = subtotal - discount
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
    note: cart.note,
    buyerIdentity: cart.buyerIdentity,
    discountCodes,
    discountAllocations: discount > 0 ? [{ discountedAmount: money(discount) }] : [],
    cost: { subtotalAmount: money(subtotal), totalAmount: money(total), checkoutChargeAmount: money(total) },
    lines: { nodes },
  }
}

const userError = (field, message, code = 'INVALID') => ({ field, message, code })
const payload = (cart, userErrors = []) => ({ cart: cart ? view(cart) : null, userErrors, warnings: [] })
const missingCart = () => payload(null, [userError(['cartId'], 'The specified cart does not exist.')])

/** Add (merging by merchandiseId); returns userErrors for unknown merchandise. */
function addLines(cart, lines = []) {
  const errors = []
  lines.forEach((input, index) => {
    const quantity = Number(input.quantity ?? 1)
    if (!merchandise.has(input.merchandiseId)) {
      errors.push(
        userError(['lines', String(index), 'merchandiseId'], `The merchandise with id ${input.merchandiseId} does not exist.`)
      )
      return
    }
    const existing = cart.lines.find((line) => line.merchandiseId === input.merchandiseId)
    if (existing) existing.quantity += quantity
    else cart.lines.push({ id: `gid://shopify/CartLine/mock-${++lineSeq}?cart=${cart.id.split('/').pop()}`, merchandiseId: input.merchandiseId, quantity })
  })
  return errors
}

/** Runs `mutate` on an existing cart; unknown id -> cart: null + a cartId userError. */
const withCart = (cartId, mutate) => {
  const cart = carts.get(cartId)
  if (!cart) return missingCart()
  return payload(cart, mutate(cart) ?? [])
}

const cartOps = {
  CartById: (vars) => ({ cart: carts.has(vars.id) ? view(carts.get(vars.id)) : null }),

  CartCreate: (vars) => {
    const input = vars.input ?? {}
    const cart = newCart()
    const errors = addLines(cart, input.lines)
    if (typeof input.note === 'string') cart.note = input.note
    if (Array.isArray(input.discountCodes)) cart.discountCodes = [...input.discountCodes]
    if (input.buyerIdentity) Object.assign(cart.buyerIdentity, input.buyerIdentity)
    return { cartCreate: payload(cart, errors) }
  },

  CartLinesAdd: (vars) => ({ cartLinesAdd: withCart(vars.cartId, (cart) => addLines(cart, vars.lines)) }),

  CartLinesUpdate: (vars) => ({
    cartLinesUpdate: withCart(vars.cartId, (cart) => {
      const errors = []
      ;(vars.lines ?? []).forEach((input, index) => {
        const line = cart.lines.find((l) => l.id === input.id)
        if (!line) return errors.push(userError(['lines', String(index), 'id'], `The cart line with id ${input.id} does not exist.`))
        if (input.merchandiseId && merchandise.has(input.merchandiseId)) line.merchandiseId = input.merchandiseId
        if (typeof input.quantity === 'number') line.quantity = input.quantity
      })
      cart.lines = cart.lines.filter((line) => line.quantity > 0)
      return errors
    }),
  }),

  CartLinesRemove: (vars) => ({
    cartLinesRemove: withCart(vars.cartId, (cart) => {
      const ids = new Set(vars.lineIds ?? [])
      cart.lines = cart.lines.filter((line) => !ids.has(line.id))
    }),
  }),

  CartDiscountCodesUpdate: (vars) => ({
    cartDiscountCodesUpdate: withCart(vars.cartId, (cart) => {
      cart.discountCodes = [...new Set((vars.discountCodes ?? []).map((code) => code.trim()).filter(Boolean))]
    }),
  }),

  CartNoteUpdate: (vars) => ({
    cartNoteUpdate: withCart(vars.cartId, (cart) => {
      cart.note = vars.note ?? ''
    }),
  }),

  CartBuyerIdentityUpdate: (vars) => ({
    cartBuyerIdentityUpdate: withCart(vars.cartId, (cart) => {
      const { email, countryCode, customerAccessToken } = vars.buyerIdentity ?? {}
      if (email !== undefined) cart.buyerIdentity.email = email
      if (countryCode !== undefined) cart.buyerIdentity.countryCode = countryCode
      if (customerAccessToken) cart.buyerIdentity.customer = { id: 'gid://shopify/Customer/mock' }
    }),
  }),
}

const resolvers = { ...catalog, ...cartOps }

function operationName(body) {
  if (body?.operationName) return body.operationName
  const m = /(?:query|mutation)\s+([A-Za-z0-9_]+)/.exec(body?.query ?? '')
  return m ? m[1] : null
}

/** One short detail string per operation for the log line. */
function describe(vars) {
  const parts = []
  if (vars.handle) parts.push(`handle=${vars.handle}`)
  if (vars.q !== undefined) parts.push(`q=${JSON.stringify(vars.q)}`)
  const cartId = vars.cartId ?? vars.id
  if (cartId) parts.push(`cart=${String(cartId).split('/').pop()}`)
  const lines = vars.lines ?? vars.input?.lines
  if (Array.isArray(lines)) parts.push(`lines=${lines.map((l) => `${String(l.merchandiseId ?? l.id).split('/').pop()}x${l.quantity}`).join(',')}`)
  if (Array.isArray(vars.lineIds)) parts.push(`remove=${vars.lineIds.length}`)
  if (Array.isArray(vars.discountCodes)) parts.push(`codes=${vars.discountCodes.join(',') || '-'}`)
  return parts.join(' ')
}

// ------------------------------------------------------------------ images

const imageCache = new Map()
function assetFor(filename) {
  const f = filename.toLowerCase()
  let name = 'Accessories.png'
  if (/(hoodie|crew|sweat|collection-all|collection-drops)/.test(f)) name = 'Sweatshirt_hoodie_collection.png'
  else if (/tee/.test(f)) name = 'Tee_tops_collection.png'
  else if (/(cuff|detail|texture)/.test(f)) name = 'stitching_img.png'
  if (!imageCache.has(name)) imageCache.set(name, fs.readFileSync(path.join(ASSETS, name)))
  return { name, buf: imageCache.get(name) }
}

// ------------------------------------------------------------------ http

function log(line) {
  console.log(`[mock ${new Date().toISOString().slice(11, 23)}] ${line}`)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}

async function handler(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') return sendJson(res, 200, { ok: true })

  if (req.method === 'POST' && /^\/api\/[^/]+\/graphql\.json$/.test(url.pathname)) {
    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      return sendJson(res, 400, { errors: [{ message: 'invalid JSON' }] })
    }
    const op = operationName(body)
    const vars = body.variables ?? {}
    const resolver = op ? resolvers[op] : undefined
    if (!resolver) {
      log(`WARNING unknown operation "${op}"`)
      return sendJson(res, 200, { errors: [{ message: `mock: unknown operation ${op}` }] })
    }
    log(`${op} ${describe(vars)}`.trimEnd())
    return sendJson(res, 200, { data: resolver(vars) })
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/s/files/') && /\.(jpe?g|png|webp)$/i.test(url.pathname)) {
    const filename = path.basename(url.pathname)
    const { name, buf } = assetFor(filename)
    log(`IMG ${filename} -> ${name}`)
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    })
    return res.end(req.method === 'HEAD' ? undefined : buf)
  }

  log(`${req.method} ${url.pathname} -> 404`)
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('not found')
}

const server = http.createServer((req, res) => {
  handler(req, res).catch((error) => {
    console.error('[mock] handler error', error)
    if (!res.headersSent) res.writeHead(500)
    res.end()
  })
})
server.on('error', (error) => {
  console.error(`[mock] could not listen on ${PORT}: ${error.code ?? error.message}`)
  process.exit(1)
})
server.listen(PORT, '127.0.0.1', () => log(`Storefront mock listening on http://127.0.0.1:${PORT}`))

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
