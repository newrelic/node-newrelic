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
  name: 'PriorityQueue.add'
})

suite.add({
  name: 'single event',
  before: function() {
    queue._data.clear()
  },
  fn: function() {
    queue.add('test')
  }
})

suite.add({
  name: 'filled pool',
  before: function() {
    queue._data.clear()
  },
  fn: function() {
    for (var i = 0; i < poolSize; ++i) {
      queue.add('test')
    }
  }
})

suite.add({
  name: 'overflowing pool',
  initialize: function() {
    for (var i = 0; i < queue.limit; ++i) {
      queue.add('init')
    }
  },
  fn: function() {
    queue.add('test')
  }
})

suite.run()
