/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var helper = require('../../lib/agent_helper')
var shared = require('./shared')


var s = shared.makeSuite('Shim segments')
var agent = s.agent
var suite = s.suite
var shim = s.shim
var tx = helper.runInTransaction(agent, function(_tx) { return _tx })


suite.add({
  name: 'shim.bindSegment',
  fn: function() {
    var test = shared.getTest()
    shim.bindSegment(test, 'func', {}, true)
    return test
  }
})

suite.add({
  name: 'shim.record',
  fn: function() {
    var test = shared.getTest()
    shim.record(test, 'func', function(shim, fn, name, args) {
      return {name: name, args: args}
    })
    return test
  }
})

suite.add({
  name: 'shim.getSegment(obj)',
  fn: function() {
    var test = shared.getTest()
    shim.getSegment(test.func)
    return test
  }
})

suite.add({
  name: 'shim.getSegment()',
  fn: function() {
    return shim.getSegment()
  }
})

suite.add({
  name: 'shim.getActiveSegment',
  fn: function() {
    var test = shared.getTest()
    shim.getActiveSegment(test.func)
    return test
  }
})

suite.add({
  name: 'shim.storeSegment',
  fn: function() {
    var test = shared.getTest()
    shim.storeSegment(test, {})
    return test
  }
})

suite.add({
  name: 'shim.bindCallbackSegment',
  fn: function() {
    var test = shared.getTest()
    shim.bindCallbackSegment(test, 'func', {})
    return test
  }
})

suite.add({
  name: 'shim.applySegment',
  fn: function() {
    var test = shared.getTest()
    shim.applySegment(test.func, tx.trace.root, true, test, [1, 2, 3])
    return test
  }
})

suite.add({
  name: 'shim.createSegment',
  fn: function() {
    var test = shared.getTest()
    shim.createSegment('foo', test.func, tx.trace.root)
    tx.trace.root.children = []
    return test
  }
})

suite.add({
  name: 'shim.copySegmentParameters',
  fn: function() {
    shim.copySegmentParameters(tx.trace.root, {foo: 'bar'})
  }
})

suite.run()
