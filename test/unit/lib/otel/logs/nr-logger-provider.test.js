/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const NrLoggerProvider = require('#agentlib/otel/logs/nr-logger-provider.js')

test('getLogger returns a logger that routes to the emit handler', () => {
  const records = []
  const provider = new NrLoggerProvider((record) => records.push(record), () => true)
  const logger = provider.getLogger('my-lib', '1.0')
  const record = { body: 'test', severityNumber: 9 }
  logger.emit(record)
  assert.equal(records.length, 1)
  assert.strictEqual(records[0], record)
})

test('getLogger ignores name, version, and options arguments', () => {
  let called = false
  const provider = new NrLoggerProvider(() => { called = true }, () => true)
  const logger = provider.getLogger('lib', '2.0', { schemaUrl: 'http://example.com' })
  logger.emit({ body: 'x' })
  assert.equal(called, true)
})

test('multiple loggers from the same provider all route to the same handler', () => {
  const records = []
  const provider = new NrLoggerProvider((r) => records.push(r), () => true)
  provider.getLogger('a').emit({ body: 'from a' })
  provider.getLogger('b').emit({ body: 'from b' })
  assert.equal(records.length, 2)
  assert.equal(records[0].body, 'from a')
  assert.equal(records[1].body, 'from b')
})

test('getLogger returns a logger whose enabled defers to the provider enabled handler', () => {
  const provider = new NrLoggerProvider(() => {}, () => false)
  const logger = provider.getLogger('lib')
  assert.equal(logger.enabled(), false)
})

test('getLogger returns the same logger instance regardless of name, version, or options', () => {
  const provider = new NrLoggerProvider(() => {}, () => true)
  const logger = provider.getLogger('a', '1.0')
  assert.strictEqual(provider.getLogger('a', '1.0'), logger)
  assert.strictEqual(provider.getLogger('b', '2.0', { schemaUrl: 'http://example.com' }), logger)
})
