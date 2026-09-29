/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const NrLogger = require('#agentlib/otel/logs/nr-logger.js')

test('emit calls the emit handler with the log record', () => {
  const records = []
  const logger = new NrLogger((record) => records.push(record), () => true)
  const record = { body: 'hello', severityNumber: 9 }
  logger.emit(record)
  assert.equal(records.length, 1)
  assert.strictEqual(records[0], record)
})

test('emit calls the emit handler on each invocation', () => {
  let callCount = 0
  const logger = new NrLogger(() => { callCount += 1 }, () => true)
  logger.emit({ body: 'first' })
  logger.emit({ body: 'second' })
  assert.equal(callCount, 2)
})

test('enabled defers to the enabled handler', () => {
  const enabledLogger = new NrLogger(() => {}, () => true)
  assert.equal(enabledLogger.enabled(), true)

  const disabledLogger = new NrLogger(() => {}, () => false)
  assert.equal(disabledLogger.enabled(), false)
})

test('emit passes the logger scope to the emit handler', () => {
  const scopes = []
  const scope = { name: 'my-lib', version: '1.0' }
  const logger = new NrLogger((_record, s) => scopes.push(s), () => true, scope)
  logger.emit({ body: 'hello' })
  assert.equal(scopes.length, 1)
  assert.strictEqual(scopes[0], scope)
})

test('emit passes undefined scope when the logger was not given one', () => {
  const scopes = []
  const logger = new NrLogger((_record, s) => scopes.push(s), () => true)
  logger.emit({ body: 'hello' })
  assert.equal(scopes[0], undefined)
})
