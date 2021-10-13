/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const testData = require('../lib/obfuscation-data')
const hashes = require('../../lib/util/hashes')

tap.test('obfuscation', (t) => {
  t.test('should objuscate strings correctly', (t) => {
    testData.forEach(function (test) {
      t.equal(hashes.obfuscateNameUsingKey(test.input, test.key), test.output)
    })
    t.end()
  })
  t.end()
})

tap.test('deobfuscation', (t) => {
  t.test('should deobjuscate strings correctly', (t) => {
    testData.forEach(function (test) {
      t.equal(hashes.deobfuscateNameUsingKey(test.output, test.key), test.input)
    })
    t.end()
  })
  t.end()
})

tap.test('getHash', (t) => {
  /**
   * TODO: crypto.DEFAULT_ENCODING has been deprecated.
   * When fully disabled, this test can likely be removed.
   * https://nodejs.org/api/deprecations.html#DEP0091
   */
  /* eslint-disable node/no-deprecated-api */
  t.test('should not crash when changing the DEFAULT_ENCODING key on crypto', (t) => {
    const crypto = require('crypto')
    const oldEncoding = crypto.DEFAULT_ENCODING
    crypto.DEFAULT_ENCODING = 'utf-8'
    t.doesNotThrow(hashes.getHash.bind(null, 'TEST_APP', 'TEST_TXN'))
    crypto.DEFAULT_ENCODING = oldEncoding
    t.end()
  })
  /* eslint-enable node/no-deprecated-api */
  t.end()
})
