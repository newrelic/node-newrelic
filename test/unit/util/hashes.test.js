/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')

const testData = require('../../lib/obfuscation-data')
const hashes = require('../../../lib/util/hashes')

const major = process.version.slice(1).split('.').map(Number).shift()

test('#makeId always returns the correct length', () => {
  for (let length = 4; length < 64; length++) {
    for (let attempts = 0; attempts < 500; attempts++) {
      const id = hashes.makeId(length)
      assert.equal(id.length, length)
    }
  }
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

// TODO: remove this test when we drop support for node 18
test('getHash', { skip: major > 18 }, async (t) => {
  /**
   * TODO: crypto.DEFAULT_ENCODING has been deprecated.
   * When fully disabled, this test can likely be removed.
   * https://nodejs.org/api/deprecations.html#DEP0091
   */
  /* eslint-disable node/no-deprecated-api */
  await t.test('should not crash when changing the DEFAULT_ENCODING key on crypto', () => {
    const crypto = require('node:crypto')
    const oldEncoding = crypto.DEFAULT_ENCODING
    crypto.DEFAULT_ENCODING = 'utf-8'
    assert.doesNotThrow(hashes.getHash.bind(null, 'TEST_APP', 'TEST_TXN'))
    crypto.DEFAULT_ENCODING = oldEncoding
  })
})
