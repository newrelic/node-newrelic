/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')
var EventEmitter = require('events').EventEmitter
var helper = require('../../lib/agent_helper')
var Shim = require('../../../lib/shim/shim')


var CYCLES = 1000

var agent = helper.loadMockedAgent()
var shim = new Shim(agent, 'test-module', './')
var suite = benchmark.createBenchmark({
  name: 'row callbacks'
})

var test = {
  stream: function() {
    return new EventEmitter()
  },

  streamWrapped: function() {
    return new EventEmitter()
  }
}
shim.record(test, 'streamWrapped', function() {
  return {name: 'streamer', stream: 'foo'}
})


suite.add({
  name: 'shim.record({stream}).emit("foo")',
  fn: function() {
    helper.runInTransaction(agent, function(tx) {
      var stream = test.streamWrapped()
      stream.on('foo', function() {})

      for (var i = 0; i < CYCLES; ++i) {
        stream.emit('foo', i)
      }
      tx.end()
    })
  }
})

suite.add({
  name: 'shim.record({stream}).emit("bar")',
  fn: function() {
    helper.runInTransaction(agent, function(tx) {
      var stream = test.streamWrapped()
      stream.on('bar', function() {})

      for (var i = 0; i < CYCLES; ++i) {
        stream.emit('bar', i)
      }
      tx.end()
    })
  }
})

suite.add({
  name: 'unwrapped',
  fn: function() {
    helper.runInTransaction(agent, function(tx) {
      var stream = test.stream()
      stream.on('foo', function() {})

      for (var i = 0; i < CYCLES; ++i) {
        stream.emit('foo', i)
      }
      tx.end()
    })
  }
})

suite.run()
