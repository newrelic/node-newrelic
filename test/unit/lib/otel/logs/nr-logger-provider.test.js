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

test('getLogger returns the same logger instance for the same name and version', () => {
  const provider = new NrLoggerProvider(() => {}, () => true)
  const logger = provider.getLogger('a', '1.0')
  assert.strictEqual(provider.getLogger('a', '1.0'), logger)
  assert.strictEqual(provider.getLogger('a', '1.0', { schemaUrl: 'http://example.com' }), logger)
})

test('getLogger returns a distinct logger instance for a different name or version', () => {
  const provider = new NrLoggerProvider(() => {}, () => true)
  const logger = provider.getLogger('a', '1.0')
  assert.notStrictEqual(provider.getLogger('b', '1.0'), logger)
  assert.notStrictEqual(provider.getLogger('a', '2.0'), logger)
})

test('emit passes the requested name and version through as the logger scope', () => {
  const scopes = []
  const provider = new NrLoggerProvider((_record, scope) => scopes.push(scope), () => true)
  provider.getLogger('my-lib', '1.2.3').emit({ body: 'hi' })
  assert.equal(scopes.length, 1)
  assert.equal(scopes[0].name, 'my-lib')
  assert.equal(scopes[0].version, '1.2.3')
})
