/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const { URL } = require('node:url')

const {
  assignOutgoingHeaders,
  extractHostPort,
  extractHostPortViaProxy,
  parseRequest
} = require('#agentlib/subscribers/core/http/client-utils.js')

test('extractHostPort', async (t) => {
  const defaultPorts = [
    ['no protocol', {}, 80],
    ['http:', { protocol: 'http:' }, 80],
    ['https:', { protocol: 'https:' }, 443]
  ]
  for (const [label, opts, port] of defaultPorts) {
    await t.test(`should default the port to ${port} for ${label}`, () => {
      assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', ...opts }), {
        host: 'example.com',
        hostname: 'example.com',
        port
      })
    })
  }

  const defaultProtocols = [
    ['http:', 80],
    ['https:', 443]
  ]
  for (const [defaultProtocol, port] of defaultProtocols) {
    await t.test(`should default the port to ${port} for no protocol and a default protocol of ${defaultProtocol}`, () => {
      assert.deepStrictEqual(extractHostPort({ hostname: 'example.com' }, defaultProtocol), {
        host: 'example.com',
        hostname: 'example.com',
        port
      })
    })
  }

  await t.test('should prefer the protocol of the options to the default protocol', () => {
    assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', protocol: 'http:' }, 'https:'), {
      host: 'example.com',
      hostname: 'example.com',
      port: 80
    })
  })

  await t.test('should add an explicit port to the host', () => {
    assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', port: 8080 }), {
      host: 'example.com:8080',
      hostname: 'example.com',
      port: 8080
    })
  })

  const explicitDefaultPorts = [
    ['http:', 80],
    ['https:', 443]
  ]
  for (const [protocol, port] of explicitDefaultPorts) {
    await t.test(`should not add an explicit ${port} to the host for ${protocol}`, () => {
      assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', protocol, port }), {
        host: 'example.com',
        hostname: 'example.com',
        port
      })
    })
  }

  await t.test('should add the default port of the other protocol to the host', () => {
    assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', protocol: 'https:', port: 80 }), {
      host: 'example.com:80',
      hostname: 'example.com',
      port: 80
    })
  })

  await t.test('should use the defaultPort option when there is no port', () => {
    assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', defaultPort: 8000 }), {
      host: 'example.com:8000',
      hostname: 'example.com',
      port: 8000
    })
  })

  await t.test('should prefer port to defaultPort', () => {
    assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', port: 8080, defaultPort: 8000 }), {
      host: 'example.com:8080',
      hostname: 'example.com',
      port: 8080
    })
  })

  // `http` converts a string port with `+port`
  const stringPorts = [
    ['a string port', { port: '8080' }, 'example.com:8080', 8080],
    ['a string port with whitespace', { port: ' 8080 ' }, 'example.com:8080', 8080],
    ['a hex string port', { port: '0x1F90' }, 'example.com:8080', 8080],
    ['a string default port', { protocol: 'https:', port: '443' }, 'example.com', 443],
    ['a string defaultPort option', { defaultPort: '8000' }, 'example.com:8000', 8000]
  ]
  for (const [label, opts, host, port] of stringPorts) {
    await t.test(`should convert ${label} to a number`, () => {
      assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', ...opts }), {
        host,
        hostname: 'example.com',
        port
      })
    })
  }

  await t.test('should default the port for an empty string port', () => {
    assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', port: '' }), {
      host: 'example.com',
      hostname: 'example.com',
      port: 80
    })
  })

  await t.test('should keep a string port that is not a number as is', () => {
    assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', port: 'abc' }), {
      host: 'example.com:abc',
      hostname: 'example.com',
      port: 'abc'
    })
  })

  await t.test('should fall back to localhost when there is no host', () => {
    assert.deepStrictEqual(extractHostPort({}), { host: 'localhost', hostname: 'localhost', port: 80 })
  })

  await t.test('should fall back to localhost and keep an explicit port', () => {
    assert.deepStrictEqual(extractHostPort({ port: 8080 }), {
      host: 'localhost:8080',
      hostname: 'localhost',
      port: 8080
    })
  })

  await t.test('should not add brackets to an ipv6 host', () => {
    assert.deepStrictEqual(extractHostPort({ hostname: '::1', port: 8080 }), {
      host: '::1:8080',
      hostname: '::1',
      port: 8080
    })
  })

  await t.test('should use host when there is no hostname', () => {
    assert.deepStrictEqual(extractHostPort({ host: 'example.com' }), {
      host: 'example.com',
      hostname: 'example.com',
      port: 80
    })
  })

  await t.test('should add an explicit port to host', () => {
    assert.deepStrictEqual(extractHostPort({ host: 'example.com', port: 8080 }), {
      host: 'example.com:8080',
      hostname: 'example.com',
      port: 8080
    })
  })

  await t.test('should prefer hostname to host', () => {
    assert.deepStrictEqual(extractHostPort({ hostname: 'example.com', host: 'example.org' }), {
      host: 'example.com',
      hostname: 'example.com',
      port: 80
    })
  })
})

test('extractHostPortViaProxy', async (t) => {
  const nonProxyPaths = [
    ['no path', {}],
    ['a relative path', { path: '/foo?a=b' }],
    ['a relative pathname', { pathname: '/foo' }],
    ['a path that is not http or https', { path: 'ftp://example.com/foo' }]
  ]
  for (const [label, opts] of nonProxyPaths) {
    await t.test(`should return null for ${label}`, () => {
      assert.equal(extractHostPortViaProxy({ host: 'proxy.local', port: 3128, ...opts }), null)
    })
  }

  const proxyTargets = [
    ['an http target', 'http://example.com/foo?a=b', 'example.com', 80],
    ['an https target', 'https://example.com/foo?a=b', 'example.com', 443],
    ['an http target with a port', 'http://example.com:8080/foo', 'example.com:8080', 8080],
    ['an https target with a port', 'https://example.com:8443/foo', 'example.com:8443', 8443],
    ['an http target with an explicit default port', 'http://example.com:80/foo', 'example.com', 80],
    ['an https target with an explicit default port', 'https://example.com:443/foo', 'example.com', 443]
  ]
  for (const [label, path, host, port] of proxyTargets) {
    await t.test(`should return the host and numeric port of ${label}`, () => {
      assert.deepStrictEqual(extractHostPortViaProxy({ host: 'proxy.local', port: 3128, path }), {
        host,
        hostname: 'example.com',
        port
      })
    })
  }

  await t.test('should return the brackets of an ipv6 target', () => {
    assert.deepStrictEqual(extractHostPortViaProxy({ path: 'http://[::1]:8080/foo' }), {
      host: '[::1]:8080',
      hostname: '[::1]',
      port: 8080
    })
  })

  await t.test('should prefer pathname to path', () => {
    const opts = { pathname: 'https://example.com/foo', path: 'http://example.org/foo' }
    assert.deepStrictEqual(extractHostPortViaProxy(opts), {
      host: 'example.com',
      hostname: 'example.com',
      port: 443
    })
  })
})

test('parseRequest', async (t) => {
  const URL_STRING = 'https://user:pass@example.com:8443/foo?a=b#hash'
  const URL_OPTIONS = {
    protocol: 'https:',
    hostname: 'example.com',
    hash: '#hash',
    search: '?a=b',
    pathname: '/foo',
    path: '/foo?a=b',
    href: URL_STRING,
    port: 8443,
    auth: 'user:pass'
  }
  const cb = () => {}

  const urlInputs = [
    ['a url string', () => URL_STRING],
    ['a URL', () => new URL(URL_STRING)]
  ]
  for (const [label, makeInput] of urlInputs) {
    await t.test(`should convert ${label} to options`, () => {
      assert.deepStrictEqual(parseRequest(makeInput()), [URL_OPTIONS, undefined])
    })

    await t.test(`should convert ${label} and return the callback`, () => {
      const [options, callback] = parseRequest(makeInput(), cb)
      assert.deepStrictEqual(options, URL_OPTIONS)
      assert.equal(callback, cb)
    })

    await t.test(`should merge the options into ${label}`, () => {
      const [options, callback] = parseRequest(makeInput(), { method: 'POST', hostname: 'example.org' })
      assert.deepStrictEqual(options, { ...URL_OPTIONS, method: 'POST', hostname: 'example.org' })
      assert.equal(callback, undefined)
    })

    await t.test(`should merge the options into ${label} and return the callback`, () => {
      const [options, callback] = parseRequest(makeInput(), { method: 'POST' }, cb)
      assert.deepStrictEqual(options, { ...URL_OPTIONS, method: 'POST' })
      assert.equal(callback, cb)
    })
  }

  await t.test('should leave the port and auth unset when the url has none', () => {
    const [options] = parseRequest('http://example.com/')
    assert.equal('port' in options, false)
    assert.equal('auth' in options, false)
  })

  await t.test('should remove the brackets from an ipv6 url host', () => {
    const [options] = parseRequest('http://[::1]:8080/foo')
    assert.equal(options.hostname, '::1')
    assert.equal(options.port, 8080)
  })

  await t.test('should copy an options object', () => {
    const input = { hostname: 'example.com', path: '/foo' }
    const [options, callback] = parseRequest(input)
    assert.deepStrictEqual(options, input)
    assert.notEqual(options, input, 'should not return the caller\'s options')
    assert.equal(callback, undefined)
  })

  await t.test('should copy an options object and return the callback', () => {
    const input = { hostname: 'example.com', path: '/foo' }
    const [options, callback] = parseRequest(input, cb)
    assert.deepStrictEqual(options, input)
    assert.notEqual(options, input, 'should not return the caller\'s options')
    assert.equal(callback, cb)
  })

  await t.test('should not modify the caller\'s options when merging them into a url', () => {
    const input = { method: 'POST' }
    parseRequest(URL_STRING, input, cb)
    assert.deepStrictEqual(input, { method: 'POST' })
  })

  await t.test('should throw on an invalid url string', () => {
    assert.throws(() => parseRequest('not a url'), { code: 'ERR_INVALID_URL' })
  })
})

test('assignOutgoingHeaders', async (t) => {
  await t.test('should merge the outbound headers into object headers', () => {
    const current = { 'x-foo': 'bar', traceparent: 'old' }
    const headers = assignOutgoingHeaders(current, { traceparent: 'new', tracestate: 'state' })
    assert.deepStrictEqual({ ...headers }, { 'x-foo': 'bar', traceparent: 'new', tracestate: 'state' })
    assert.equal(Object.getPrototypeOf(headers), null, 'should return a null-prototype object')
    assert.deepStrictEqual(current, { 'x-foo': 'bar', traceparent: 'old' }, 'should not modify the current headers')
  })

  await t.test('should return the outbound headers when there are no current headers', () => {
    const headers = assignOutgoingHeaders(undefined, { traceparent: 'new' })
    assert.deepStrictEqual({ ...headers }, { traceparent: 'new' })
  })

  await t.test('should append the outbound headers to array headers as tuples', () => {
    const current = [['host', 'example.com'], ['x-foo', 'bar']]
    const headers = assignOutgoingHeaders(current, { traceparent: 'new', tracestate: 'state' })
    assert.deepStrictEqual(headers, [
      ['host', 'example.com'],
      ['x-foo', 'bar'],
      ['traceparent', 'new'],
      ['tracestate', 'state']
    ])
    assert.deepStrictEqual(current, [['host', 'example.com'], ['x-foo', 'bar']], 'should not modify the current headers')
  })
})
