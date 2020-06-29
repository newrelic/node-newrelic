/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')
var PriorityQueue = require('../../../lib/priority-queue')

var poolSize = 10000
var queue1 = new PriorityQueue(poolSize)
var queue2 = new PriorityQueue(poolSize)
var suite = benchmark.createBenchmark({
  name: 'PriorityQueue.merge',
  after: function() {
    queue1 = new PriorityQueue(poolSize)
    queue2 = new PriorityQueue(poolSize)
  }
})

suite.add({
  name: 'few into many',
  before: function() {
    for (var i = 0; i < poolSize; ++i) {
      queue1.add('test')
    }
    for (var i = 0; i < poolSize / 100; ++i) {
      queue2.add('test')
    }
  },
  fn: function() {
    queue1.merge(queue2)
  }
})

suite.add({
  name: 'many into few',
  before: function() {
    for (var i = 0; i < poolSize; ++i) {
      queue2.add('test')
    }
    for (var i = 0; i < poolSize / 100; ++i) {
      queue1.add('test')
    }
  },
  fn: function() {
    queue1.merge(queue2)
  }
})

suite.add({
  name: 'two full queues (toArray)',
  before: function() {
    for (var i = 0; i < poolSize; ++i) {
      queue1.add('test')
      queue2.add('test')
    }
  },
  fn: function() {
    queue2.toArray()
    queue1.merge(queue2)
  }
})

suite.add({
  name: 'two full queues (getRawEvents)',
  before: function() {
    for (var i = 0; i < poolSize; ++i) {
      queue1.add('test')
      queue2.add('test')
    }
  },
  fn: function() {
    const ev = queue2.getRawEvents()
    const mapped = ev.map((e) => e.value) // eslint-disable-line no-unused-vars
    queue1.merge(ev)
  }
})

suite.run()
