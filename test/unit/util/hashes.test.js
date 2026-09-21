/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')

const testData = require('../../lib/obfuscation-data')
const hashes = require('../../../lib/util/hashes')

test('#makeId always returns the correct length', () => {
  for (let length = 4; length < 64; length++) {
    for (let attempts = 0; attempts < 500; attempts++) {
      const id = hashes.makeId(length)
      assert.equal(id.length, length)
    }
  }
})

test('#makeId always returns lowercase hex characters', () => {
  for (let length = 1; length < 64; length++) {
    for (let attempts = 0; attempts < 100; attempts++) {
      const id = hashes.makeId(length)
      assert.match(id, /^[0-9a-f]*$/)
    }
  }
})

test('#makeId handles lengths beyond the internal shared buffer', () => {
  // makeId reuses a fixed-size buffer for typical ids (max 32 hex chars,
  // i.e. 16 bytes) and falls back to a fresh allocation above that. Exercise
  // both sides of that boundary.
  for (const length of [62, 63, 64, 65, 100, 200]) {
    for (let attempts = 0; attempts < 100; attempts++) {
      const id = hashes.makeId(length)
      assert.equal(id.length, length)
      assert.match(id, /^[0-9a-f]*$/)
    }
  }
})

test('#makeId handles a length of zero', () => {
  assert.equal(hashes.makeId(0), '')
})

test('#makeId always unique', () => {
  const ids = {}
  for (let length = 16; length < 64; length++) {
    for (let attempts = 0; attempts < 500; attempts++) {
      const id = hashes.makeId(length)

      // Should be unique
      assert.equal(ids[id], undefined)
      ids[id] = true

      // and the correct length
      assert.equal(id.length, length)
    }
  }
})

test('obfuscation', async (t) => {
  await t.test('should obfuscate strings correctly', () => {
    for (const data of testData) {
      assert.equal(hashes.obfuscateNameUsingKey(data.input, data.key), data.output)
    }
  })
})

test('deobfuscation', async (t) => {
  await t.test('should deobfuscate strings correctly', () => {
    for (const data of testData) {
      assert.equal(hashes.deobfuscateNameUsingKey(data.output, data.key), data.input)
    }
  })
})
