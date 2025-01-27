/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const validateLicenseKey = require('#agentlib/validate-license-key.js')

test('normal key is valid', () => {
  assert.equal(validateLicenseKey('08a2ad66c637a29c3982469a3fe8d1982d002c4a'), true)
})

test('region aware key is valid', () => {
  assert.equal(validateLicenseKey('eu01xx66c637a29c3982469a3fe8d1982d002c4'), true)
})

test('min length key is valid', () => {
  assert.equal(validateLicenseKey('a'.repeat(10)), true)
})

test('max length key is valid', () => {
  assert.equal(validateLicenseKey('a'.repeat(64)), true)
})

test('short key is invalid', () => {
  assert.equal(validateLicenseKey('a'.repeat(9)), false)
})

test('long key is invalid', () => {
  assert.equal(validateLicenseKey('a'.repeat(65)), false)
})

test('empty key is invalid', () => {
  assert.equal(validateLicenseKey(''), false)
})

test('unicode key is invalid', () => {
  assert.equal(validateLicenseKey('🍍'.repeat(24)), false)
})
