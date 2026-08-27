/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const Type = require('#agentlib/transaction/type.js')

test('exposes the transaction type values', () => {
  assert.equal(Type.WEB, 'web')
  assert.equal(Type.BG, 'bg')
  assert.equal(Type.MESSAGE, 'message')
})

test('values() returns the valid type values', () => {
  assert.deepEqual(Type.values(), ['web', 'bg', 'message'])
})

test('isValid() accepts valid type values', () => {
  assert.equal(Type.isValid('web'), true)
  assert.equal(Type.isValid('bg'), true)
  assert.equal(Type.isValid('message'), true)
})

test('isValid() rejects invalid values', () => {
  assert.equal(Type.isValid('nope'), false)
  assert.equal(Type.isValid(), false)
  assert.equal(Type.isValid(null), false)
  // Inherited Object props must not validate as types.
  assert.equal(Type.isValid('toString'), false)
})

test('entries() yields KEY->value pairs', () => {
  // transaction-shim.js relies on this exact shape to define its static type
  // members.
  assert.deepEqual(Type.entries(), [
    ['WEB', 'web'],
    ['BG', 'bg'],
    ['MESSAGE', 'message']
  ])
})
