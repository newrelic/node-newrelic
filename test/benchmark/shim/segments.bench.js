/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const shared = require('./shared')

const s = shared.makeSuite('Shim segments')
const agent = s.agent
const suite = s.suite
const shim = s.shim
const tx = helper.runInTransaction(agent, function (_tx) {
  return _tx
})

suite.add({
  name: 'shim.bindSegment',
  fn: function () {
    const test = shared.getTest()
    shim.bindSegment(test, 'func', {}, true)
    return test
  }
})

suite.add({
  name: 'shim.record',
  fn: function () {
    const test = shared.getTest()
    shim.record(test, 'func', function (shim, fn, name, args) {
      return { name: name, args: args }
    })
    return test
  }
})

suite.add({
  name: 'shim.getSegment(obj)',
  fn: function () {
    const test = shared.getTest()
    shim.getSegment(test.func)
    return test
  }
})

suite.add({
  name: 'shim.getSegment()',
  fn: function () {
    return shim.getSegment()
  }
})

suite.add({
  name: 'shim.getActiveSegment',
  fn: function () {
    const test = shared.getTest()
    shim.getActiveSegment(test.func)
    return test
  }
})

suite.add({
  name: 'shim.storeSegment',
  fn: function () {
    const test = shared.getTest()
    shim.storeSegment(test, {})
    return test
  }
})

suite.add({
  name: 'shim.bindCallbackSegment',
  fn: function () {
    const test = shared.getTest()
    shim.bindCallbackSegment(test, 'func', {})
    return test
  }
})

suite.add({
  name: 'shim.applySegment',
  fn: function () {
    const test = shared.getTest()
    shim.applySegment(test.func, tx.trace.root, true, test, [1, 2, 3])
    return test
  }
})

suite.add({
  name: 'shim.createSegment',
  fn: function () {
    const test = shared.getTest()
    shim.createSegment('foo', test.func, tx.trace.root)
    tx.trace.root.children = []
    return test
  }
})

suite.add({
  name: 'shim.copySegmentParameters',
  fn: function () {
    shim.copySegmentParameters(tx.trace.root, { foo: 'bar' })
  }
})

suite.run()
