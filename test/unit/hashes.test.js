/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const testData = require('../lib/obfuscation-data')
const hashes = require('../../lib/util/hashes')

const major = process.version.slice(1).split('.').map(Number).shift()

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
