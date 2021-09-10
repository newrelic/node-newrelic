/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const PriorityQueue = require('../../../lib/priority-queue')

const poolSize = 10000
let queue = new PriorityQueue(poolSize)
const suite = benchmark.createBenchmark({
  name: 'PriorityQueue.merge',
  after: function () {
    queue = new PriorityQueue(poolSize)
  }
})

// Fill queue to serialize
for (let i = 0; i < poolSize; ++i) {
  queue.add('test')
}

suite.add({
  name: 'toArray',
  fn: function () {
    queue.toArray()
  }
})

suite.add({
  name: 'getRawEvents',
  fn: function () {
    queue.getRawEvents()
  }
})

suite.run()
