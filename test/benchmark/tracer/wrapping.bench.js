/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var EventEmitter = require('events').EventEmitter
var helper = require('../../lib/agent_helper')
var shared = require('./shared')


var s = shared.makeSuite('Tracer wrapping')
var suite = s.suite
var tracer = s.agent.tracer
var tx = helper.runInTransaction(s.agent, function(_tx) { return _tx })


suite.add({
  name: 'tracer.bindFunction',
  fn: function() {
    var test = shared.getTest()
    return tracer.bindFunction(test.func, tx.root, true)
  }
})

suite.add({
  name: 'tracer.bindEmitter',
  fn: function() {
    return tracer.bindEmitter(new EventEmitter(), tx.root)
  }
})

suite.add({
  name: 'tracer.wrapFunctionNoSegment',
  fn: function() {
    var test = shared.getTest()
    return tracer.wrapFunctionNoSegment(test.func, 'func', function() {})
  }
})

suite.add({
  name: 'tracer.wrapFunctionFirstNoSegment',
  fn: function() {
    var test = shared.getTest()
    return tracer.wrapFunctionFirstNoSegment(test.func, 'func')
  }
})

suite.add({
  name: 'tracer.wrapFunction',
  fn: function() {
    var test = shared.getTest()
    return tracer.wrapFunction('func', null, test.func, function() {}, null)
  }
})

suite.add({
  name: 'tracer.wrapFunctionLast',
  fn: function() {
    var test = shared.getTest()
    return tracer.wrapFunctionLast('func', null, test.func)
  }
})

suite.add({
  name: 'tracer.wrapFunctionFirst',
  fn: function() {
    var test = shared.getTest()
    return tracer.wrapFunctionFirst('func', null, test.func)
  }
})

suite.add({
  name: 'tracer.wrapSyncFunction',
  fn: function() {
    var test = shared.getTest()
    return tracer.wrapSyncFunction('func', null, test.func)
  }
})

suite.add({
  name: 'tracer.wrapCallback',
  fn: function() {
    var test = shared.getTest()
    return tracer.wrapCallback(test.func, tx.root, null)
  }
})

suite.run()
