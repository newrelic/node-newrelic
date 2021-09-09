/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const truncate = require('../../../lib/util/byte-limit').truncate

const suite = benchmark.createBenchmark({
  name: 'util.byte-limit'
})

const shortString = '123456'
const equalString = '1234567890'

// 2^20 characters
// using unicode characters to force it into the search case
let longString = '1324\uD87E\uDC04\uD87E\uDC04'
for (let i = 0; i < 20; ++i) {
  longString += longString
}

suite.add({
  name: 'truncate (smaller than limit)',
  fn: function () {
    truncate(shortString, 10)
  }
})

suite.add({
  name: 'truncate (equal to limit)',
  fn: function () {
    truncate(equalString, 10)
  }
})

suite.add({
  name: 'truncate (longer than limit)',
  fn: function () {
    truncate(longString, 1023)
  }
})

suite.run()
