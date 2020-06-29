/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var helper = require('../../lib/agent_helper')
var shared = require('./shared')


var s = shared.makeSuite('Tracer transactions')
var suite = s.suite
var tracer = s.agent.tracer
var tx = helper.runInTransaction(s.agent, function(_tx) { return _tx })
tracer.segment = tx.root


suite.add({
  name: 'tracer.getTransaction',
  fn: function() {
    return tracer.getTransaction()
  }
})

suite.add({
  name: 'tracer.transactionProxy',
  fn: function() {
    var test = shared.getTest()
    return tracer.transactionProxy(test.func)
  }
})

suite.add({
  name: 'tracer.transactionNestProxy',
  fn: function() {
    var test = shared.getTest()
    return tracer.transactionNestProxy('web', test.func)
  }
})

suite.run()
