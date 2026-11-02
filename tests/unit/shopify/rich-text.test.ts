// tests/unit/shopify/rich-text.test.ts
import { describe, expect, it } from 'vitest'

import { richTextToHtml } from '@/lib/shopify/rich-text'

const NESTED_DOC = JSON.stringify({
  type: 'root',
  children: [
    { type: 'heading', level: 3, children: [{ type: 'text', value: 'Care & Materials' }] },
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'Wash ' },
        { type: 'text', value: 'cold', bold: true },
        { type: 'text', value: ' and ' },
        { type: 'text', value: 'line dry', italic: true },
        { type: 'text', value: '. ' },
        {
          type: 'link',
          url: 'https://headoverfeels.com/care',
          title: 'Care guide',
          target: '_blank',
          children: [{ type: 'text', value: 'Full guide' }],
        },
      ],
    },
    {
      type: 'list',
      listType: 'unordered',
      children: [
        { type: 'list-item', children: [{ type: 'text', value: '80% cotton' }] },
        { type: 'list-item', children: [{ type: 'text', value: '20% recycled poly' }] },
      ],
    },
    {
      type: 'list',
      listType: 'ordered',
      children: [{ type: 'list-item', children: [{ type: 'text', value: 'Turn inside out' }] }],
    },
  ],
})

describe('richTextToHtml', () => {
  it('renders a nested document to exact HTML', () => {
    expect(richTextToHtml(NESTED_DOC)).toBe(
      '<h3>Care &amp; Materials</h3>' +
        '<p>Wash <strong>cold</strong> and <em>line dry</em>. ' +
        '<a href="https://headoverfeels.com/care" title="Care guide" target="_blank" rel="noopener">Full guide</a></p>' +
        '<ul><li>80% cotton</li><li>20% recycled poly</li></ul>' +
        '<ol><li>Turn inside out</li></ol>'
    )
  })

  it('clamps heading levels to 1–6 and defaults to h2', () => {
    const doc = (level?: unknown) =>
      JSON.stringify({
        type: 'root',
        children: [{ type: 'heading', level, children: [{ type: 'text', value: 'Hi' }] }],
      })

    expect(richTextToHtml(doc(1))).toBe('<h1>Hi</h1>')
    expect(richTextToHtml(doc(6))).toBe('<h6>Hi</h6>')
    expect(richTextToHtml(doc(0))).toBe('<h1>Hi</h1>')
    expect(richTextToHtml(doc(9))).toBe('<h6>Hi</h6>')
    expect(richTextToHtml(doc(undefined))).toBe('<h2>Hi</h2>')
    expect(richTextToHtml(doc('nope'))).toBe('<h2>Hi</h2>')
  })

  it('accepts `bullet` as a synonym for an unordered list', () => {
    const doc = JSON.stringify({
      type: 'root',
      children: [
        {
          type: 'list',
          listType: 'bullet',
          children: [{ type: 'list-item', children: [{ type: 'text', value: 'a' }] }],
        },
      ],
    })

    expect(richTextToHtml(doc)).toBe('<ul><li>a</li></ul>')
  })

  it('nests bold and italic on the same text node', () => {
    const doc = JSON.stringify({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'loud', bold: true, italic: true }],
        },
      ],
    })

    expect(richTextToHtml(doc)).toBe('<p><strong><em>loud</em></strong></p>')
  })

  it('escapes markup in text and in link attributes', () => {
    const doc = JSON.stringify({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: '<script>alert("x")</script> & \'quotes\'' },
            {
              type: 'link',
              url: '/collections/all?q=a&b=1',
              title: 'a "quoted" <title>',
              children: [{ type: 'text', value: 'link' }],
            },
          ],
        },
      ],
    })

    expect(richTextToHtml(doc)).toBe(
      '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quotes&#39;' +
        '<a href="/collections/all?q=a&amp;b=1" title="a &quot;quoted&quot; &lt;title&gt;" rel="noopener">link</a></p>'
    )
  })

  it('drops unsafe link hrefs and renders the children instead', () => {
    const doc = (url: unknown) =>
      JSON.stringify({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'link', url, children: [{ type: 'text', value: 'click' }] }],
          },
        ],
      })

    expect(richTextToHtml(doc('javascript:alert(1)'))).toBe('<p>click</p>')
    expect(richTextToHtml(doc('  JAVASCRIPT:alert(1)'))).toBe('<p>click</p>')
    expect(richTextToHtml(doc('data:text/html;base64,PHN2Zz4='))).toBe('<p>click</p>')
    expect(richTextToHtml(doc(undefined))).toBe('<p>click</p>')
    expect(richTextToHtml(doc('mailto:hi@headoverfeels.com'))).toBe(
      '<p><a href="mailto:hi@headoverfeels.com" rel="noopener">click</a></p>'
    )
  })

  it('renders the children of an unknown node type', () => {
    const doc = JSON.stringify({
      type: 'root',
      children: [
        {
          type: 'blockquote',
          children: [{ type: 'paragraph', children: [{ type: 'text', value: 'quoted' }] }],
        },
      ],
    })

    expect(richTextToHtml(doc)).toBe('<p>quoted</p>')
  })

  it('returns null for missing, invalid or non-root input', () => {
    expect(richTextToHtml(null)).toBeNull()
    expect(richTextToHtml(undefined)).toBeNull()
    expect(richTextToHtml('')).toBeNull()
    expect(richTextToHtml('   ')).toBeNull()
    expect(richTextToHtml('{ not json')).toBeNull()
    expect(richTextToHtml('"just a string"')).toBeNull()
    expect(richTextToHtml(JSON.stringify({ type: 'paragraph', children: [] }))).toBeNull()
  })

  it('returns null for an empty document', () => {
    expect(richTextToHtml(JSON.stringify({ type: 'root', children: [] }))).toBeNull()
    expect(richTextToHtml(JSON.stringify({ type: 'root' }))).toBeNull()
    // the value Shopify stores for a cleared rich text metafield
    expect(
      richTextToHtml(
        JSON.stringify({
          type: 'root',
          children: [{ type: 'paragraph', children: [{ type: 'text', value: '' }] }],
        })
      )
    ).toBeNull()
  })
})
