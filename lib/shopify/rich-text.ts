// lib/shopify/rich-text.ts
//
// Shopify `rich_text_field` metafield JSON -> HTML string. Pure: no I/O, no
// React. Every text node and every attribute is escaped, so the result is safe
// to hand to `Prose`/`dangerouslySetInnerHTML`.
//
// Supported nodes: root, paragraph, heading (level 1-6), list
// (listType unordered|bullet|ordered), list-item, link (url, title, target),
// text (value, bold, italic). Unknown node types render their children.

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char])
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Wraps rendered children in `tag`, dropping the element when it has no content. */
function wrap(tag: string, inner: string): string {
  return inner.length > 0 ? `<${tag}>${inner}</${tag}>` : ''
}

function headingTag(level: unknown): string {
  if (typeof level !== 'number' || !Number.isFinite(level)) return 'h2'
  return `h${Math.min(6, Math.max(1, Math.round(level)))}`
}

function listTag(listType: unknown): string {
  return listType === 'ordered' ? 'ol' : 'ul'
}

/** Allows http(s), mailto and relative hrefs; everything else (javascript:, data:, ...) is rejected. */
function safeHref(url: unknown): string | null {
  if (typeof url !== 'string') return null
  // Strip control characters so a smuggled `java\nscript:` cannot slip past the scheme check.
  const cleaned = url.trim().replace(/[\u0000-\u001F\u007F]/g, '')
  if (cleaned.length === 0) return null
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(cleaned)
  if (!scheme) return cleaned
  const protocol = scheme[1].toLowerCase()
  return protocol === 'http' || protocol === 'https' || protocol === 'mailto' ? cleaned : null
}

function renderText(node: Record<string, unknown>): string {
  const value = typeof node.value === 'string' ? node.value : ''
  if (value.length === 0) return ''
  let html = escapeHtml(value)
  if (node.italic === true) html = `<em>${html}</em>`
  if (node.bold === true) html = `<strong>${html}</strong>`
  return html
}

function renderLink(node: Record<string, unknown>): string {
  const children = renderNodes(node.children)
  if (children.length === 0) return ''

  const href = safeHref(node.url)
  if (!href) return children

  let attrs = ` href="${escapeHtml(href)}"`
  if (typeof node.title === 'string' && node.title.length > 0) {
    attrs += ` title="${escapeHtml(node.title)}"`
  }
  if (typeof node.target === 'string' && node.target.length > 0) {
    attrs += ` target="${escapeHtml(node.target)}"`
  }
  attrs += ' rel="noopener"'

  return `<a${attrs}>${children}</a>`
}

function renderNode(node: unknown): string {
  const record = asRecord(node)
  if (!record) return ''

  switch (record.type) {
    case 'text':
      return renderText(record)
    case 'link':
      return renderLink(record)
    case 'paragraph':
      return wrap('p', renderNodes(record.children))
    case 'heading':
      return wrap(headingTag(record.level), renderNodes(record.children))
    case 'list':
      return wrap(listTag(record.listType), renderNodes(record.children))
    case 'list-item':
      return wrap('li', renderNodes(record.children))
    default:
      // Unknown node types contribute their children only.
      return renderNodes(record.children)
  }
}

function renderNodes(children: unknown): string {
  if (!Array.isArray(children)) return ''
  let html = ''
  for (const child of children) html += renderNode(child)
  return html
}

/**
 * Renders a Shopify rich text JSON string to HTML.
 * Returns `null` for missing input, invalid JSON, a non-root document, or a
 * document that renders to nothing (Shopify stores a cleared field as a single
 * empty paragraph).
 */
export function richTextToHtml(json: string | null | undefined): string | null {
  if (typeof json !== 'string' || json.trim().length === 0) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  const root = asRecord(parsed)
  if (!root || root.type !== 'root') return null

  const html = renderNodes(root.children)
  return html.length > 0 ? html : null
}
