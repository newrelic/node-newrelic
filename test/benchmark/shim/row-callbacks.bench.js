/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const EventEmitter = require('events').EventEmitter
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')

const CYCLES = 1000

const agent = helper.loadMockedAgent()
const shim = new Shim(agent, 'test-module', './')
const suite = benchmark.createBenchmark({
  name: 'row callbacks'
})

const test = {
  stream: function () {
    return new EventEmitter()
  },

  streamWrapped: function () {
    return new EventEmitter()
  }
}
shim.record(test, 'streamWrapped', function () {
  return { name: 'streamer', stream: 'foo' }
})

suite.add({
  name: 'shim.record({stream}).emit("foo")',
  fn: function () {
    helper.runInTransaction(agent, function (tx) {
      const stream = test.streamWrapped()
      stream.on('foo', function () {})

      for (let i = 0; i < CYCLES; ++i) {
        stream.emit('foo', i)
      }
      tx.end()
    })
  }
})

suite.add({
  name: 'shim.record({stream}).emit("bar")',
  fn: function () {
    helper.runInTransaction(agent, function (tx) {
      const stream = test.streamWrapped()
      stream.on('bar', function () {})

      for (let i = 0; i < CYCLES; ++i) {
        stream.emit('bar', i)
      }
      tx.end()
    })
  }
})

suite.add({
  name: 'unwrapped',
  fn: function () {
    helper.runInTransaction(agent, function (tx) {
      const stream = test.stream()
      stream.on('foo', function () {})

      for (let i = 0; i < CYCLES; ++i) {
        stream.emit('foo', i)
      }
      tx.end()
    })
  }
})

suite.run()
