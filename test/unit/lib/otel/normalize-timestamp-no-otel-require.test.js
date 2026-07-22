/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', '..', '..', '..')

/**
 * Regression test for https://github.com/newrelic/node-newrelic/issues/4162
 *
 * `lib/otel/normalize-timestamp.js` is reachable from the always-on agent
 * startup path:
 *
 *   lib/transaction/tracer/index.js
 *     -> lib/context-manager/async-local-context-manager.js
 *       -> lib/otel/context.js
 *         -> lib/otel/fake-span.js
 *           -> lib/spans/timed-event.js
 *             -> lib/otel/normalize-timestamp.js
 *
 * It must not `require('@opentelemetry/core')` (or any `@opentelemetry/*`
 * package) at module load time, otherwise the "slim" Lambda layer/image --
 * which ships without any `@opentelemetry/*` packages -- crashes at startup
 * with `Cannot find module '@opentelemetry/core'`.
 *
 * These tests run in a child process so the assertion sees a pristine module
 * cache, and so a broken require actually throws MODULE_NOT_FOUND rather than
 * silently resolving against this test suite's own dependencies.
 */

function runChild(script) {
  return execFileSync(process.execPath, ['-e', script], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

test('requiring normalize-timestamp does not load @opentelemetry/core', () => {
  const output = runChild(`
    require('./lib/otel/normalize-timestamp.js')
    const loaded = Object.keys(require.cache).some((k) => k.includes('@opentelemetry'))
    process.stdout.write(loaded ? 'loaded' : 'clean')
  `)
  assert.equal(output, 'clean')
})

test('the always-on tracer require chain does not load @opentelemetry/core', () => {
  const output = runChild(`
    require('./lib/transaction/tracer/index.js')
    const loaded = Object.keys(require.cache).filter((k) => k.includes('@opentelemetry'))
    process.stdout.write(loaded.length === 0 ? 'clean' : loaded.join(','))
  `)
  assert.equal(output, 'clean')
})

test('normalize-timestamp works when @opentelemetry/* cannot be resolved', () => {
  // Simulate the slim build by making every `@opentelemetry/*` resolution fail,
  // then exercise the code path that used to depend on `isTimeInputHrTime`.
  const output = runChild(`
    const Module = require('module')
    const origResolve = Module._resolveFilename
    Module._resolveFilename = function (request, ...rest) {
      if (request.startsWith('@opentelemetry/')) {
        const err = new Error("Cannot find module '" + request + "'")
        err.code = 'MODULE_NOT_FOUND'
        throw err
      }
      return origResolve.call(this, request, ...rest)
    }

    const normalizeTimestamp = require('./lib/otel/normalize-timestamp.js')
    // [seconds, nanoseconds] hrtime tuple -> milliseconds since epoch.
    const found = normalizeTimestamp([1764938931, 327000000])
    process.stdout.write(new Date(found).toISOString())
  `)
  assert.equal(output, '2025-12-05T12:48:51.327Z')
})
