/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const dc = require('node:diagnostics_channel')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const resolvePackageVersion = require('#agentlib/subscribers/resolve-package-version.js')

const nrPkg = require('../../../../package.json')
const Foo = require('./fixtures/foo/index.js')
const Bar = require('./fixtures/foo/lib/bar.js')
const Baz = require('./fixtures/baz/index.js')

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

test('iterates up the tree to the package.json', (t) => {
  t.plan(2)

  t.after(() => {
    dc.unsubscribe('bar.test', handler)
  })

  dc.subscribe('bar.test', handler)
  const bar = new Bar()
  bar.bar()

  function handler() {
    const result = resolvePackageVersion('foo', t.nr)
    t.assert.equal(result, '1.0.0')
    t.assert.deepStrictEqual(t.nr.logs.trace, [
      [
        { moduleSpecifier: 'foo', version: '1.0.0' },
        'Resolved package version.'
      ]
    ])
  }
})

test('stops looking after reaching app root', (t) => {
  t.plan(2)

  t.after(() => {
    dc.unsubscribe('baz.test', handler)
  })

  dc.subscribe('baz.test', handler)
  const baz = new Baz()
  baz.baz()

  function handler() {
    const result = resolvePackageVersion('baz', t.nr)
    t.assert.equal(result, nrPkg.version)
    t.assert.deepStrictEqual(t.nr.logs.trace, [
      [
        { moduleSpecifier: 'baz', version: nrPkg.version },
        'Resolved package version.'
      ]
    ])
  }
})

test('returns unknown if app root does not have manifest', (t) => {
  const result = spawnSync(
    process.execPath,
    [
      './app_root.js'
    ],
    {
      cwd: path.join(__dirname, 'fixtures')
    }
  )
  t.assert.equal(result.stdout.toString(), 'unknown\n')
})

test('returns version', (t) => {
  t.plan(2)

  t.after(() => {
    dc.unsubscribe('foo.test', handler)
  })

  dc.subscribe('foo.test', handler)
  const foo = new Foo()
  foo.foo()

  // eslint-disable-next-line sonarjs/no-identical-functions
  function handler() {
    const result = resolvePackageVersion('foo', t.nr)
    t.assert.equal(result, '1.0.0')
    t.assert.deepStrictEqual(t.nr.logs.trace, [
      [
        { moduleSpecifier: 'foo', version: '1.0.0' },
        'Resolved package version.'
      ]
    ])
  }
})
