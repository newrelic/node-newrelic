/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const resolvePackageVersion = require('#agentlib/subscribers/resolve-package-version.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    logs: {
      warn: [],
      trace: []
    }
  }
  ctx.nr.logger = {
    warn(...args) {
      ctx.nr.logs.warn.push(args)
    },
    trace(...args) {
      ctx.nr.logs.trace.push(args)
    }
  }
})

test('logs if module cannot be found', (t) => {
  const result = resolvePackageVersion('foo', t.nr)
  t.assert.equal(result, 'unknown')
  t.assert.deepStrictEqual(t.nr.logs.warn, [
    [
      { moduleSpecifier: 'foo' },
      'Could not resolve module path. Possibly a built-in or Node.js bundled module.'
    ]
  ])
})

test('returns unknown if manifest does not have version field', (t) => {
  t.plan(4)
  const req = (specifier) => {
    t.assert.equal(specifier, 'test/package.json')
    return {}
  }
  req.resolve = (specifier) => {
    t.assert.equal(specifier, 'foo')
    return 'test/foo'
  }

  const result = resolvePackageVersion('foo', { ...t.nr, req })
  t.assert.equal(result, 'unknown')
  t.assert.deepStrictEqual(t.nr.logs.trace, [
    [
      { moduleSpecifier: 'foo', version: 'unknown' },
      'Resolved package version.'
    ]
  ])
})

test('iterates up the tree to the package.json', (t) => {
  t.plan(3)
  const req = (specifier) => {
    if (specifier === 'test/lib/package.json') {
      throw Error('not found')
    }
    if (specifier.endsWith('test/package.json')) {
      return { version: '1.0.0' }
    }
  }
  req.resolve = (specifier) => {
    t.assert.equal(specifier, 'foo')
    return 'test/lib/foo'
  }

  const result = resolvePackageVersion('foo', { ...t.nr, req })
  t.assert.equal(result, '1.0.0')
  t.assert.deepStrictEqual(t.nr.logs.trace, [
    [
      { moduleSpecifier: 'foo', version: '1.0.0' },
      'Resolved package version.'
    ]
  ])
})

test('stops looking after reaching app root', (t) => {
  t.plan(3)
  const req = (specifier) => {
    if (specifier === 'test/lib/package.json') {
      throw Error('not found')
    }
    if (specifier.endsWith('test/package.json')) {
      throw Error('try again')
    }
    throw Error('app root, no manifest')
  }
  req.resolve = (specifier) => {
    t.assert.equal(specifier, 'foo')
    return 'test/lib/foo'
  }

  const result = resolvePackageVersion('foo', { ...t.nr, req })
  t.assert.equal(result, 'unknown')
  t.assert.deepStrictEqual(t.nr.logs.trace, [
    [
      { moduleSpecifier: 'foo', version: 'unknown' },
      'Resolved package version.'
    ]
  ])
})

test('returns version', (t) => {
  t.plan(5)
  const req = (specifier) => {
    t.assert.equal(specifier, 'test/package.json')
    return { version: '1.0.0' }
  }
  req.resolve = (specifier) => {
    t.assert.equal(specifier, 'foo')
    return 'test/foo'
  }

  const result = resolvePackageVersion('foo', { ...t.nr, req })
  t.assert.equal(result, '1.0.0')
  t.assert.deepStrictEqual(t.nr.logs.trace, [
    [
      { moduleSpecifier: 'foo', version: '1.0.0' },
      'Resolved package version.'
    ]
  ])
  t.assert.equal(t.nr.logs.warn.length, 0)
})
