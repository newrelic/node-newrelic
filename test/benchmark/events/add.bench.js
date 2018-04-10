'use strict'

var benchmark = require('../../lib/benchmark')
var PriorityQueue = require('../../../lib/priority-queue')

var poolSize = 10000
var queue = new PriorityQueue(poolSize)
var suite = benchmark.createBenchmark({
  name: 'PriorityQueue.add',
  after: function() {
    queue = new PriorityQueue(poolSize)
  }
})

suite.add({
  name: 'single event',
  fn: function() {
    queue.add('test')
  }
})

suite.add({
  name: 'filled pool',
  fn: function() {
    for (var i = 0; i < poolSize; ++i) {
      queue.add('test')
    }
  }
})

suite.add({
  name: 'overflowing pool',
  before: function() {
    for (var i = 0; i < poolSize; ++i) {
      queue.add('test')
    }
  },
  fn: function() {
    for (var i = 0; i < poolSize; ++i) {
      queue.add('test')
    }
  }
})

suite.run()
