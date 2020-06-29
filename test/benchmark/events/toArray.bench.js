/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')
var PriorityQueue = require('../../../lib/priority-queue')

var poolSize = 10000
var queue = new PriorityQueue(poolSize)
var suite = benchmark.createBenchmark({
  name: 'PriorityQueue.merge',
  after: function() {
    queue = new PriorityQueue(poolSize)
  }
})

// Fill queue to serialize
for (var i = 0; i < poolSize; ++i) {
  queue.add('test')
}

suite.add({
  name: 'toArray',
  fn: function() {
    queue.toArray()
  }
})

suite.add({
  name: 'getRawEvents',
  fn: function() {
    queue.getRawEvents()
  }
})

suite.run()
