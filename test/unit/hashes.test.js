/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test_data = require('../lib/obfuscation-data')
const hashes = require('../../lib/util/hashes')

tap.test('obfuscation', (t) => {
  t.test('should objuscate strings correctly', (t) => {
    test_data.forEach(function(test) {
      t.equal(hashes.obfuscateNameUsingKey(test.input, test.key), test.output)
    })
    t.end()
  })
  t.end()
})

tap.test('deobfuscation', (t) => {
  t.test('should deobjuscate strings correctly', (t) => {
    test_data.forEach(function(test) {
      t.equal(hashes.deobfuscateNameUsingKey(test.output, test.key), test.input)
    })
    t.end()
  })
  t.end()
})

tap.test('getHash', (t) => {
  t.test('should not crash when changing the DEFAULT_ENCODING key on crypto', (t) => {
    const crypto = require('crypto')
    const oldEncoding = crypto.DEFAULT_ENCODING
    crypto.DEFAULT_ENCODING = 'utf-8'
    t.doesNotThrow(hashes.getHash.bind(null, 'TEST_APP', 'TEST_TXN'))
    crypto.DEFAULT_ENCODING = oldEncoding
    t.end()
  })
  t.end()
})
