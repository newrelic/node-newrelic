/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')

const agent = helper.loadMockedAgent()
const contextManager = helper.getContextManager()

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
  return { name: 'foo', callback: shim.LAST }
})

suite.add({
  name: 'wrapper - no transaction',
  fn: function () {
    contextManager.setContext(null)
    wrapped.func(noop)
  }
})

suite.add({
  name: 'wrapper - in transaction',
  fn: function () {
    contextManager.setContext(transaction.trace.root)
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
