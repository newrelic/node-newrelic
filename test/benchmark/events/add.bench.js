/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const PriorityQueue = require('../../../lib/priority-queue')

const poolSize = 10000
const queue = new PriorityQueue(poolSize)
const suite = benchmark.createBenchmark({
  name: 'PriorityQueue.add'
})

suite.add({
  name: 'single event',
  before: function () {
    queue._data.clear()
  },
  fn: function () {
    queue.add('test')
  }
})

suite.add({
  name: 'filled pool',
  before: function () {
    queue._data.clear()
  },
  fn: function () {
    for (let i = 0; i < poolSize; ++i) {
      queue.add('test')
    }
  }
})

suite.add({
  name: 'overflowing pool',
  initialize: function () {
    for (let i = 0; i < queue.limit; ++i) {
      queue.add('init')
    }
  },
  fn: function () {
    queue.add('test')
  }
})

suite.run()
