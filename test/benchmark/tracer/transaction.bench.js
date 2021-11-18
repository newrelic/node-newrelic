/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const shared = require('./shared')

const s = shared.makeSuite('Tracer transactions')
const suite = s.suite
const tracer = s.agent.tracer

const contextManager = helper.getContextManager()
const tx = helper.runInTransaction(s.agent, function (_tx) {
  return _tx
})

contextManager.setContext(tx.root)

suite.add({
  name: 'tracer.getTransaction',
  fn: function () {
    return tracer.getTransaction()
  }
})

suite.add({
  name: 'tracer.transactionProxy',
  fn: function () {
    const test = shared.getTest()
    return tracer.transactionProxy(test.func)
  }
})

suite.add({
  name: 'tracer.transactionNestProxy',
  fn: function () {
    const test = shared.getTest()
    return tracer.transactionNestProxy('web', test.func)
  }
})

suite.run()
