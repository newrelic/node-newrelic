/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var shared = require('./shared')
var helper = require('../../lib/agent_helper')


var s = shared.makeSuite('Tracer utilities')
var suite = s.suite
var tracer = s.agent.tracer
var tx = helper.runInTransaction(s.agent, function(_tx) { return _tx })
tracer.segment = tx.root


suite.add({
  name: 'tracer.slice',
  fn: function() {
    function toSlice() {
      return tracer.slice(arguments)
    }
    return toSlice({}, 'func', 1, 2, 3)
  }
})

suite.add({
  name: 'tracer.getOriginal',
  fn: function() {
    var test = shared.getTest()
    return tracer.getOriginal(test.func)
  }
})

suite.run()
