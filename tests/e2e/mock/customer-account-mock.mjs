/**
 * Mock Shopify Customer Account API (OIDC + GraphQL) for the Playwright suite
 * (Phase 4, Task 9). Mounted by `storefront-mock.mjs` under `/customer`, so the
 * dev server reaches it with `SHOPIFY_CUSTOMER_ACCOUNT_ISSUER=http://127.0.0.1:4443/customer`
 * (see `lib/shopify/customer/env.ts` / `oauth.ts`).
 *
 * - GET  /.well-known/openid-configuration  -> authorization / token / end_session endpoints
 * - GET  /.well-known/customer-account-api  -> `{ graphql_api }`
 * - GET  /oauth/authorize                   -> no hosted login: 302 straight back to
 *                                              `redirect_uri?code=mock-<n>&state=<state>`
 *                                              (PKCE challenge + nonce remembered per code)
 * - POST /oauth/token                       -> `authorization_code` (PKCE S256 verified) or
 *                                              `refresh_token` -> access/refresh/id tokens
 * - GET  /oauth/logout                      -> 302 to `post_logout_redirect_uri`
 * - POST /graphql                           -> `{ data }` keyed on the operation name, answered
 *                                              from `tests/fixtures/shopify/customer/*.json`;
 *                                              the customer's names and addresses mutate in
 *                                              memory; a missing/unknown bearer token -> 401.
 *
 * State is per sign-in: every authorization-code grant gets its own copy of the
 * fixture customer (names, addresses) that follows the token through refreshes,
 * so Playwright workers running in parallel never see each other's edits, and
 * one worker's logout never invalidates another's token.
 *
 * Test-only; no dependencies. Exports `createCustomerAccountMock`.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const CLIENT_ID = 'mock'
const TOKEN_TTL_SECONDS = 7200

const clone = (value) => JSON.parse(JSON.stringify(value))
const b64url = (value) => Buffer.from(value).toString('base64url')

/** `header.payload.signature`-shaped, unsigned: `decodeJwt` only reads the payload (`nonce`). */
function fakeIdToken(claims) {
  const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = b64url(JSON.stringify(claims))
  return `${header}.${payload}.mock-signature`
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

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Content-Length': 0 })
  res.end()
}

function operationName(body) {
  if (body?.operationName) return body.operationName
  const m = /(?:query|mutation)\s+([A-Za-z0-9_]+)/.exec(body?.query ?? '')
  return m ? m[1] : null
}

const userError = (field, message, code = 'INVALID') => ({ field, message, code })

/**
 * @param {{ issuer: string, fixturesDir: string, log?: (line: string) => void }} options
 *   `issuer` is the public base URL of this mount (e.g. `http://127.0.0.1:4443/customer`);
 *   `fixturesDir` is `tests/fixtures/shopify/customer`.
 * @returns {{ handle(req, res, pathname: string, url: URL): Promise<boolean>, reset(): void }}
 *   `handle` resolves `true` when it answered the request (pathname is relative to the mount).
 */
export function createCustomerAccountMock({ issuer, fixturesDir, log = () => {} }) {
  const load = (name) => JSON.parse(fs.readFileSync(path.join(fixturesDir, `${name}.json`), 'utf8'))
  const fx = {
    customer: load('customer'),
    orders: load('orders'),
    order: load('order'),
    addresses: load('addresses'),
  }

  // ---------------------------------------------------------------- state

  /** code -> { challenge, nonce, redirectUri } */
  const pendingCodes = new Map()
  /** access token -> session (the per-sign-in customer state) */
  const accessTokens = new Map()
  /** refresh token -> session, while it may still be exchanged */
  const refreshTokens = new Map()
  let seq = 0

  /** A fresh copy of the fixture customer for one sign-in. */
  function newSession() {
    return {
      customer: clone(fx.customer.customer),
      addresses: clone(fx.addresses.customer.addresses.nodes),
      defaultAddressId: fx.addresses.customer.defaultAddress?.id ?? null,
      addressSeq: 0,
    }
  }

  function reset() {
    pendingCodes.clear()
    accessTokens.clear()
    refreshTokens.clear()
    seq = 0
  }

  function issueTokens(nonce, session) {
    const n = ++seq
    const accessToken = `mock-access-${n}`
    const refreshToken = `mock-refresh-${n}`
    accessTokens.set(accessToken, session)
    refreshTokens.set(refreshToken, session)
    const { customer } = session
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      id_token: fakeIdToken({
        iss: issuer,
        aud: CLIENT_ID,
        sub: customer.id,
        email: customer.emailAddress?.emailAddress ?? null,
        nonce: nonce ?? undefined,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      }),
      expires_in: TOKEN_TTL_SECONDS,
      token_type: 'Bearer',
      scope: 'openid email customer-account-api:full',
    }
  }

  // ---------------------------------------------------------------- oauth

  function discoveryOidc() {
    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      end_session_endpoint: `${issuer}/oauth/logout`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],
    }
  }

  function authorize(res, url) {
    const q = url.searchParams
    const redirectUri = q.get('redirect_uri')
    const state = q.get('state') ?? ''
    if (!redirectUri) return sendJson(res, 400, { error: 'invalid_request', error_description: 'redirect_uri missing' })
    const back = new URL(redirectUri)
    const fail = (error) => {
      back.searchParams.set('error', error)
      if (state) back.searchParams.set('state', state)
      log(`OAUTH authorize -> error ${error}`)
      return redirect(res, back.toString())
    }
    if (q.get('client_id') !== CLIENT_ID) return fail('unauthorized_client')
    if (q.get('response_type') !== 'code') return fail('unsupported_response_type')
    if (q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge')) return fail('invalid_request')

    const code = `mock-code-${++seq}`
    pendingCodes.set(code, { challenge: q.get('code_challenge'), nonce: q.get('nonce'), redirectUri })
    back.searchParams.set('code', code)
    back.searchParams.set('state', state)
    log(`OAUTH authorize -> ${code}`)
    return redirect(res, back.toString())
  }

  async function token(req, res) {
    const params = new URLSearchParams(await readBody(req))
    const fail = (status, error, description) => {
      log(`OAUTH token -> ${status} ${error}`)
      return sendJson(res, status, { error, error_description: description })
    }
    if (params.get('client_id') !== CLIENT_ID) return fail(401, 'invalid_client', 'unknown client_id')
    if (!req.headers.origin) return fail(400, 'invalid_request', 'Origin header required for public clients')

    const grant = params.get('grant_type')
    if (grant === 'authorization_code') {
      const code = params.get('code') ?? ''
      const pending = pendingCodes.get(code)
      if (!pending) return fail(400, 'invalid_grant', 'unknown or used code')
      pendingCodes.delete(code)
      if (params.get('redirect_uri') !== pending.redirectUri) return fail(400, 'invalid_grant', 'redirect_uri mismatch')
      const verifier = params.get('code_verifier') ?? ''
      const challenge = createHash('sha256').update(verifier).digest('base64url')
      if (challenge !== pending.challenge) return fail(400, 'invalid_grant', 'PKCE verification failed')
      log(`OAUTH token <- ${code}`)
      return sendJson(res, 200, issueTokens(pending.nonce, newSession()))
    }
    if (grant === 'refresh_token') {
      const refreshToken = params.get('refresh_token') ?? ''
      const session = refreshTokens.get(refreshToken)
      if (!session) return fail(400, 'invalid_grant', 'unknown refresh token')
      refreshTokens.delete(refreshToken)
      log('OAUTH token <- refresh')
      const next = issueTokens(null, session)
      // Shopify's refresh answer carries no id_token.
      delete next.id_token
      return sendJson(res, 200, next)
    }
    return fail(400, 'unsupported_grant_type', `grant_type ${grant}`)
  }

  function logout(res, url) {
    const target = url.searchParams.get('post_logout_redirect_uri')
    const idToken = url.searchParams.get('id_token_hint')
    // Shopify's logout ends the hosted session; tokens already issued are not
    // revoked here (other workers may hold their own), they simply expire.
    log(`OAUTH logout${idToken ? '' : ' (no id_token_hint)'}`)
    if (!target) return sendJson(res, 400, { error: 'invalid_request', error_description: 'post_logout_redirect_uri missing' })
    return redirect(res, target)
  }

  // ---------------------------------------------------------------- graphql

  const addressesView = (s) => ({
    customer: {
      defaultAddress: s.defaultAddressId ? { id: s.defaultAddressId } : null,
      addresses: { nodes: clone(s.addresses) },
    },
  })

  const formatted = (a) =>
    [
      [a.firstName, a.lastName].filter(Boolean).join(' '),
      a.company,
      a.address1,
      a.address2,
      [a.city, a.zoneCode, a.zip].filter(Boolean).join(' '),
      a.territoryCode === 'US' ? 'United States' : a.territoryCode,
    ].filter((line) => typeof line === 'string' && line.length > 0)

  function toAddress(input, id) {
    return {
      id,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      company: input.company ?? null,
      address1: input.address1 ?? null,
      address2: input.address2 ?? null,
      city: input.city ?? null,
      province: input.zoneCode ?? null,
      zoneCode: input.zoneCode ?? null,
      territoryCode: input.territoryCode ?? null,
      zip: input.zip ?? null,
      phoneNumber: input.phoneNumber ?? null,
      formatted: formatted(input),
    }
  }

  /** Every resolver gets `(vars, session)`; `session` is the sign-in's own state. */
  const resolvers = {
    CustomerSummary: (_vars, s) => ({
      customer: {
        ...clone(s.customer),
        defaultAddress: (() => {
          const d = s.addresses.find((a) => a.id === s.defaultAddressId)
          return d ? { id: d.id, formatted: d.formatted } : null
        })(),
      },
    }),

    CustomerUpdate: (vars, s) => {
      const { customer } = s
      const input = vars?.input ?? {}
      const errors = []
      if (typeof input.firstName === 'string' && input.firstName.trim().length === 0) {
        errors.push(userError(['input', 'firstName'], 'First name can’t be blank.', 'BLANK'))
      }
      if (errors.length === 0) {
        if (typeof input.firstName === 'string') customer.firstName = input.firstName
        if (typeof input.lastName === 'string') customer.lastName = input.lastName
        customer.displayName = [customer.firstName, customer.lastName].filter(Boolean).join(' ')
      }
      return {
        customerUpdate: {
          customer: errors.length ? null : { id: customer.id, firstName: customer.firstName, lastName: customer.lastName },
          userErrors: errors,
        },
      }
    },

    CustomerOrders: (vars) => {
      const data = clone(fx.orders)
      if (vars?.after) {
        // Only one page in the fixture: a cursor past it is empty.
        data.customer.orders.nodes = []
        data.customer.orders.pageInfo = { hasNextPage: false, endCursor: null }
      }
      return data
    },

    CustomerOrder: (vars) => (vars?.id === fx.order.order.id ? clone(fx.order) : { order: null }),

    CustomerAddresses: (_vars, s) => addressesView(s),

    CustomerAddressCreate: (vars, s) => {
      const { addresses } = s
      const input = vars?.address ?? {}
      if (!input.address1) {
        return {
          customerAddressCreate: {
            customerAddress: null,
            userErrors: [userError(['address', 'address1'], 'Address can’t be blank.', 'BLANK')],
          },
        }
      }
      const id = `gid://shopify/CustomerAddress/9400000${++s.addressSeq}?model_name=CustomerAddress`
      addresses.push(toAddress(input, id))
      if (vars?.defaultAddress === true || addresses.length === 1) s.defaultAddressId = id
      return { customerAddressCreate: { customerAddress: { id }, userErrors: [] } }
    },

    CustomerAddressUpdate: (vars, s) => {
      const { addresses } = s
      const index = addresses.findIndex((a) => a.id === vars?.addressId)
      if (index === -1) {
        return {
          customerAddressUpdate: {
            customerAddress: null,
            userErrors: [userError(['addressId'], 'Address not found.', 'NOT_FOUND')],
          },
        }
      }
      if (vars?.address) addresses[index] = toAddress({ ...addresses[index], ...vars.address }, addresses[index].id)
      if (vars?.defaultAddress === true) s.defaultAddressId = addresses[index].id
      return { customerAddressUpdate: { customerAddress: { id: addresses[index].id }, userErrors: [] } }
    },

    CustomerAddressDelete: (vars, s) => {
      const { addresses } = s
      const index = addresses.findIndex((a) => a.id === vars?.addressId)
      if (index === -1) {
        return {
          customerAddressDelete: {
            deletedAddressId: null,
            userErrors: [userError(['addressId'], 'Address not found.', 'NOT_FOUND')],
          },
        }
      }
      const [removed] = addresses.splice(index, 1)
      if (s.defaultAddressId === removed.id) s.defaultAddressId = addresses[0]?.id ?? null
      return { customerAddressDelete: { deletedAddressId: removed.id, userErrors: [] } }
    },
  }

  async function graphql(req, res) {
    const auth = req.headers.authorization ?? ''
    const bearer = auth.replace(/^Bearer\s+/i, '')
    const session = accessTokens.get(bearer)
    if (!session) {
      log('GQL -> 401 (unknown access token)')
      return sendJson(res, 401, { errors: [{ message: 'Unauthorized', extensions: { code: 'UNAUTHENTICATED' } }] })
    }
    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      return sendJson(res, 400, { errors: [{ message: 'invalid JSON' }] })
    }
    const op = operationName(body)
    const resolver = op ? resolvers[op] : undefined
    if (!resolver) {
      log(`GQL WARNING unknown operation "${op}"`)
      return sendJson(res, 200, { errors: [{ message: `mock: unknown customer operation ${op}` }] })
    }
    log(`GQL ${op}`)
    return sendJson(res, 200, { data: resolver(body.variables ?? {}, session) })
  }

  // ---------------------------------------------------------------- router

  async function handle(req, res, pathname, url) {
    if (req.method === 'GET' && pathname === '/.well-known/openid-configuration') {
      sendJson(res, 200, discoveryOidc())
      return true
    }
    if (req.method === 'GET' && pathname === '/.well-known/customer-account-api') {
      sendJson(res, 200, { graphql_api: `${issuer}/graphql` })
      return true
    }
    if (req.method === 'GET' && pathname === '/oauth/authorize') {
      authorize(res, url)
      return true
    }
    if (req.method === 'POST' && pathname === '/oauth/token') {
      await token(req, res)
      return true
    }
    if (req.method === 'GET' && pathname === '/oauth/logout') {
      logout(res, url)
      return true
    }
    if (req.method === 'POST' && pathname === '/graphql') {
      await graphql(req, res)
      return true
    }
    if (req.method === 'POST' && pathname === '/__reset') {
      reset()
      sendJson(res, 200, { ok: true })
      return true
    }
    return false
  }

  return { handle, reset }
}
