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
  fn: function() {
    queue._data.clear()
    queue.add('test')
  }
})

suite.add({
  name: 'filled pool',
  fn: function() {
    queue._data.clear()
    for (var i = 0; i < poolSize; ++i) {
      queue.add('test')
    }
  }
})

suite.add({
  name: 'overflowing pool',
  fn: function() {
    queue.add('test')
  }
})

suite.run()
