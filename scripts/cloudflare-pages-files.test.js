// @vitest-environment node
// The default jsdom environment resolves `import.meta.url` to a URL that is not the file path.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readPublicFile = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8')

describe('Cloudflare Pages _redirects', () => {
  it('rewrites manager routes to the manager page', () => {
    const rules = readPublicFile('_redirects').split('\n').filter(Boolean)

    expect(rules).toEqual(['/manager/* /manager/index.html 200'])
  })
})

describe('Cloudflare Pages _headers', () => {
  const blocks = readPublicFile('_headers')
    .split(/\n\s*\n/)
    .map((block) => block.trim().split('\n'))
    .filter((lines) => lines[0])
  const headersFor = (path) =>
    blocks
      .find((lines) => lines[0] === path)
      ?.slice(1)
      .map((line) => line.trim())

  it('caches hashed files for both apps as immutable', () => {
    const immutable = 'Cache-Control: public, max-age=31556952, immutable'

    expect(headersFor('/assets/*')).toEqual([immutable])
    expect(headersFor('/manager/assets/*')).toEqual([immutable])
  })

  it('never caches the two index pages', () => {
    expect(headersFor('/index.html')).toEqual(['Cache-Control: no-cache'])
    expect(headersFor('/manager/index.html')).toEqual(['Cache-Control: no-cache'])
  })

  it('adds the security headers to every path without a Content-Security-Policy', () => {
    expect(headersFor('/*')).toEqual([
      'X-Content-Type-Options: nosniff',
      'Referrer-Policy: strict-origin-when-cross-origin',
    ])
  })

  it('does not set Cache-Control on the catch-all rule, so rules never conflict', () => {
    expect(headersFor('/*').join('\n')).not.toMatch(/cache-control/i)
  })
})
