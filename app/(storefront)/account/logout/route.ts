import { NextResponse } from 'next/server'

import { getCustomerAccountEnv, hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { buildLogoutUrl, discover } from '@/lib/shopify/customer/oauth'
import { clearCustomerSession, readCustomerSession } from '@/lib/shopify/customer/session'

/**
 * /account/logout
 *
 * POST clears the `hof_customer` cookie and 302s to Shopify's logout endpoint
 * (`id_token_hint` + `post_logout_redirect_uri` = the storefront origin) so
 * both sides are signed out; without an id token (or when discovery fails)
 * it 302s home. A POST whose `Origin` is another site is refused (403).
 *
 * GET never signs anyone out: it renders a small confirm page whose only
 * control is a POST form, for visitors who land here from a link.
 */

export const dynamic = 'force-dynamic'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const CONFIRM_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sign out · Head Over Feels</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: white; color: black; }
  main { max-width: 28rem; margin: 4rem auto; padding: 0 1rem; }
  h1 { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.01em; }
  p { line-height: 1.5; }
  button { font: inherit; padding: 0.75rem 1.25rem; background: black; color: white; border: 1px solid black; cursor: pointer; }
  a { color: inherit; }
</style>
</head>
<body>
<main>
  <h1>Sign out of your account?</h1>
  <p>You will be signed out of Head Over Feels and of Shopify on this device.</p>
  <form method="post" action="/account/logout">
    <button type="submit">Sign out</button>
  </form>
  <p><a href="/account">Back to your account</a></p>
</main>
</body>
</html>
`

export async function GET(): Promise<Response> {
  return new NextResponse(CONFIRM_PAGE, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const origin = request.headers.get('origin')
  if (origin && origin !== url.origin) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const session = await readCustomerSession()
  await clearCustomerSession()

  const home = () => NextResponse.redirect(new URL('/', url), 302)
  const idToken = session?.tokens.idToken ?? null
  if (!idToken || !hasCustomerAccountEnv()) return home()

  try {
    const { baseUrl } = getCustomerAccountEnv()
    const discovery = await discover()
    return NextResponse.redirect(
      buildLogoutUrl(discovery, { idToken, postLogoutRedirectUri: baseUrl }),
      302
    )
  } catch (error) {
    console.error(`[storefront] customer logout redirect failed: ${errorMessage(error)}`)
    return home()
  }
}
