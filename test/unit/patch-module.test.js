/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const Module = require('node:module')
const ModulePatch = require('#agentlib/patch-module.js')
const path = require('node:path')
const { readFileSync } = require('node:fs')

test.beforeEach((ctx) => {
  const subscribers = {
    packages: new Set(['pkg-1']),
    instrumentations: [
      {
        channelName: 'unitTest',
        module: { name: 'pkg-1', versionRange: '>=1', filePath: 'foo.js' },
        functionQuery: {
          className: 'Foo',
          methodName: 'doStuff',
          kind: 'Async'
        }
      }
    ]
  }
  const modulePath = path.join(__dirname, '../lib/example-deps/lib/node_modules/pkg-1/foo.js')
  const modulePatch = new ModulePatch(subscribers)
  ctx.nr = {
    subscribers,
    modulePatch,
    modulePath
  }
})

test.afterEach((ctx) => {
  ctx.nr.modulePatch.unpatch()
})

test('should init ModulePatch', (t) => {
  const { modulePatch } = t.nr
  assert.ok(modulePatch instanceof ModulePatch)
  assert.ok(modulePatch.instrumentator)
  assert.equal(modulePatch.resolve, Module._resolveFilename)
  assert.ok(modulePatch.compile, Module.prototype._compile)
  assert.ok(modulePatch.transformers instanceof Map)
})

test('should set a transformer for a matched patch', (t) => {
  const { modulePath, modulePatch } = t.nr
  modulePatch.patch()
  Module._resolveFilename(modulePath, null, false)
  assert.ok(modulePatch.transformers.has(modulePath))
  modulePatch.unpatch()
  assert.equal(modulePatch.transformers.size, 0)
})

test('should not set a transformer for an unmatched patch', (t) => {
  const { modulePatch } = t.nr
  modulePatch.patch()
  const modulePath = path.join(__dirname, '../lib/example-deps/lib/node_modules/pkg-2/index.js')
  Module._resolveFilename(modulePath, null, false)
  assert.equal(modulePatch.transformers.size, 0)
})

test('should rewrite code for a match transformer', (t) => {
  const { modulePath, modulePatch } = t.nr
  modulePatch.patch()
  const resolvedPath = Module._resolveFilename(modulePath, null, false)
  const data = readFileSync(resolvedPath, 'utf8')
  const testModule = new Module(resolvedPath)
  testModule._compile(data, resolvedPath)
  const rewrittenCode = testModule.exports.toString()
  assert.ok(rewrittenCode.includes('return tr_ch_apm$unitTest.tracePromise(__apm$traced'))
})

test('should not rewrite code for an unmatch patch', (t) => {
  const { modulePatch } = t.nr
  modulePatch.patch()
  const modulePath = path.join(__dirname, '../lib/example-deps/lib/node_modules/pkg-2/index.js')
  const resolvedPath = Module._resolveFilename(modulePath, null, false)
  const data = readFileSync(resolvedPath, 'utf8')
  const testModule = new Module(resolvedPath)
  testModule._compile(data, resolvedPath)
  const rewrittenCode = testModule.exports.toString()
  assert.ok(!rewrittenCode.includes('tr_ch_apm$'))
})
