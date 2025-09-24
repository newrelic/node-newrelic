/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const helper = require('#testlib/agent_helper.js')
const Shim = require('#agentlib/shim/shim.js')
const { RecorderSpec } = require('#agentlib/shim/specs/index.js')

const agent = helper.loadMockedAgent()
const tracer = helper.getTracer()

const shim = new Shim(agent, 'test-module', './')
const suite = benchmark.createBenchmark({ name: 'Shim#record' })

const transaction = helper.runInTransaction(agent, function (tx) {
  return tx
})

suite.add({
  name: 'function',
  fn: function () {
    return shim.record(getTest().func, function () {})
  }
})

suite.add({
  name: 'property',
  fn: function () {
    return shim.record(getTest(), 'func', function () {})
  }
})

const wrapped = shim.record(getTest(), 'func', function () {
  return new RecorderSpec({ name: 'foo', callback: shim.LAST })
})

suite.add({
  name: 'wrapper - no transaction',
  fn: function () {
    tracer.setSegment({ segment: null, transaction: null })
    wrapped.func(noop)
  }
})

suite.add({
  name: 'wrapper - in transaction',
  fn: function () {
    tracer.setSegment({ transaction, segment: transaction.trace.root })
    wrapped.func(noop)
  }
})

suite.run()

function getTest() {
  return {
    func: function (cb) {
      cb()
    }
  }
}

function noop() {}
