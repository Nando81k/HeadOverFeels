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

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

/**
 * Shopify only redirects to the callback / logout URLs registered on the
 * Customer Account client. The mock stands in for that allow-list with "the
 * storefront under test runs on this machine": anything else is refused.
 */
function localRedirectTarget(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    return LOCAL_HOSTS.has(url.hostname) ? url : null
  } catch {
    return null
  }
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
    const back = localRedirectTarget(redirectUri)
    if (!back) {
      return sendJson(res, 400, { error: 'invalid_request', error_description: 'redirect_uri missing or not registered' })
    }
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

  /** Each grant handler returns `{ status, body }`; `fail` builds the error shape. */
  const fail = (status, error, description) => ({ status, body: { error, error_description: description } })

  function authorizationCodeGrant(params) {
    const code = params.get('code') ?? ''
    const pending = pendingCodes.get(code)
    if (!pending) return fail(400, 'invalid_grant', 'unknown or used code')
    pendingCodes.delete(code)
    if (params.get('redirect_uri') !== pending.redirectUri) return fail(400, 'invalid_grant', 'redirect_uri mismatch')
    const verifier = params.get('code_verifier') ?? ''
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    if (challenge !== pending.challenge) return fail(400, 'invalid_grant', 'PKCE verification failed')
    log(`OAUTH token <- ${code}`)
    return { status: 200, body: issueTokens(pending.nonce, newSession()) }
  }

  function refreshTokenGrant(params) {
    const refreshToken = params.get('refresh_token') ?? ''
    const session = refreshTokens.get(refreshToken)
    if (!session) return fail(400, 'invalid_grant', 'unknown refresh token')
    refreshTokens.delete(refreshToken)
    log('OAUTH token <- refresh')
    const next = issueTokens(null, session)
    // Shopify's refresh answer carries no id_token.
    delete next.id_token
    return { status: 200, body: next }
  }

  const grants = { authorization_code: authorizationCodeGrant, refresh_token: refreshTokenGrant }

  function tokenResponse(params, origin) {
    if (params.get('client_id') !== CLIENT_ID) return fail(401, 'invalid_client', 'unknown client_id')
    if (!origin) return fail(400, 'invalid_request', 'Origin header required for public clients')
    const grant = params.get('grant_type')
    const handler = grants[grant]
    return handler ? handler(params) : fail(400, 'unsupported_grant_type', `grant_type ${grant}`)
  }

  async function token(req, res) {
    const params = new URLSearchParams(await readBody(req))
    const { status, body } = tokenResponse(params, req.headers.origin)
    if (status !== 200) log(`OAUTH token -> ${status} ${body.error}`)
    return sendJson(res, status, body)
  }

  function logout(res, url) {
    const target = localRedirectTarget(url.searchParams.get('post_logout_redirect_uri'))
    const idToken = url.searchParams.get('id_token_hint')
    // Shopify's logout ends the hosted session; tokens already issued are not
    // revoked here (other workers may hold their own), they simply expire.
    log(`OAUTH logout${idToken ? '' : ' (no id_token_hint)'}`)
    if (!target) {
      return sendJson(res, 400, { error: 'invalid_request', error_description: 'post_logout_redirect_uri missing or not registered' })
    }
    return redirect(res, target.toString())
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

  const ADDRESS_FIELDS = [
    'firstName',
    'lastName',
    'company',
    'address1',
    'address2',
    'city',
    'zoneCode',
    'territoryCode',
    'zip',
    'phoneNumber',
  ]

  function toAddress(input, id) {
    const address = { id }
    for (const field of ADDRESS_FIELDS) address[field] = input[field] ?? null
    address.province = address.zoneCode
    address.formatted = formatted(input)
    return address
  }

  /** Copies the string name fields of a CustomerUpdate input onto the customer. */
  function applyNames(customer, input) {
    for (const field of ['firstName', 'lastName']) {
      if (typeof input[field] === 'string') customer[field] = input[field]
    }
    customer.displayName = [customer.firstName, customer.lastName].filter(Boolean).join(' ')
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
      const blankFirstName = typeof input.firstName === 'string' && input.firstName.trim().length === 0
      if (blankFirstName) {
        return {
          customerUpdate: {
            customer: null,
            userErrors: [userError(['input', 'firstName'], 'First name can’t be blank.', 'BLANK')],
          },
        }
      }
      applyNames(customer, input)
      return {
        customerUpdate: {
          customer: { id: customer.id, firstName: customer.firstName, lastName: customer.lastName },
          userErrors: [],
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

  /** The sign-in behind a request's bearer token, or `undefined`. */
  function sessionFor(req) {
    const auth = req.headers.authorization ?? ''
    return accessTokens.get(auth.replace(/^Bearer\s+/i, ''))
  }

  /** `{ data }` or `{ errors }` for one parsed GraphQL request body. */
  function resolve(body, session) {
    const op = operationName(body)
    const resolver = op ? resolvers[op] : undefined
    if (!resolver) {
      log(`GQL WARNING unknown operation "${op}"`)
      return { errors: [{ message: `mock: unknown customer operation ${op}` }] }
    }
    log(`GQL ${op}`)
    return { data: resolver(body.variables ?? {}, session) }
  }

  async function graphql(req, res) {
    const session = sessionFor(req)
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
    return sendJson(res, 200, resolve(body, session))
  }

  // ---------------------------------------------------------------- router

  /** `"METHOD /path"` -> handler `(req, res, url)`. */
  const routes = {
    'GET /.well-known/openid-configuration': (_req, res) => sendJson(res, 200, discoveryOidc()),
    'GET /.well-known/customer-account-api': (_req, res) => sendJson(res, 200, { graphql_api: `${issuer}/graphql` }),
    'GET /oauth/authorize': (_req, res, url) => authorize(res, url),
    'POST /oauth/token': (req, res) => token(req, res),
    'GET /oauth/logout': (_req, res, url) => logout(res, url),
    'POST /graphql': (req, res) => graphql(req, res),
    'POST /__reset': (_req, res) => {
      reset()
      sendJson(res, 200, { ok: true })
    },
  }

  async function handle(req, res, pathname, url) {
    const route = routes[`${req.method} ${pathname}`]
    if (!route) return false
    await route(req, res, url)
    return true
  }

  return { handle, reset }
}
