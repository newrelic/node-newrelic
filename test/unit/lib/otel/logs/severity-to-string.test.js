/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const severityToString = require('#agentlib/otel/logs/severity-to-string.js')

test('maps trace levels', () => {
  for (let i = 1; i <= 4; i += 1) {
    const found = severityToString(i)
    assert.equal(found, 'trace')
  }
})

test('maps debug levels', () => {
  for (let i = 5; i <= 8; i += 1) {
    const found = severityToString(i)
    assert.equal(found, 'debug')
  }
})

test('maps info levels', () => {
  for (let i = 9; i <= 12; i += 1) {
    const found = severityToString(i)
    assert.equal(found, 'info')
  }
})

test('maps warn levels', () => {
  for (let i = 13; i <= 16; i += 1) {
    const found = severityToString(i)
    assert.equal(found, 'warn')
  }
})

test('maps error levels', () => {
  for (let i = 17; i <= 20; i += 1) {
    const found = severityToString(i)
    assert.equal(found, 'error')
  }
})

test('maps fatal levels', () => {
  for (let i = 21; i <= 24; i += 1) {
    const found = severityToString(i)
    assert.equal(found, 'fatal')
  }
})

test('maps unknown levels', () => {
  let found = severityToString(0)
  assert.equal(found, 'unknown')

  found = severityToString(25)
  assert.equal(found, 'unknown')
})
