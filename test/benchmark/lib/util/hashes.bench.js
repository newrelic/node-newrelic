/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const makeId = require('#agentlib/util/hashes.js').makeId

const suite = benchmark.createBenchmark({
  name: 'util.hashes',
  runs: 10000
})

suite.add({
  name: 'makeId(16)',
  fn: function () {
    makeId(16)
  }
})

suite.add({
  name: 'makeId(32)',
  fn: function () {
    makeId(32)
  }
})

suite.run()
