/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var helper = require('../../lib/agent_helper')
var shared = require('./shared')


var s = shared.makeSuite('Tracer segments')
var suite = s.suite
var tracer = s.agent.tracer
var tx = helper.runInTransaction(s.agent, function(_tx) { return _tx })
var bound = tracer.bindFunction(shared.getTest(), tx.root, true)
tracer.segment = tx.root

suite.add({
  name: 'tracer.getSegment',
  fn: function() {
    return tracer.getSegment()
  }
})

suite.add({
  name: 'tracer.createSegment',
  fn: function() {
    tracer.segment = tracer.createSegment('test', null, null)
  }
})

suite.add({
  name: 'tracer.addSegment',
  fn: function() {
    var test = shared.getTest()
    return tracer.addSegment('test', null, null, true, test.func)
  }
})

suite.add({
  name: 'tracer.getSegmentFromWrapped',
  fn: function() {
    return tracer.getSegmentFromWrapped(bound)
  }
})

suite.run()
