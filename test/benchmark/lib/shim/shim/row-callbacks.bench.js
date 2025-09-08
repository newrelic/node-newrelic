/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const EventEmitter = require('events').EventEmitter
const helper = require('#testlib/agent_helper.js')
const Shim = require('#agentlib/shim/shim.js')
const { RecorderSpec } = require('#agentlib/shim/specs/index.js')

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
  return new RecorderSpec({ name: 'streamer', stream: 'foo' })
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
