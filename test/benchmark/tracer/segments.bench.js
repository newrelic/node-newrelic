/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const shared = require('./shared')

const s = shared.makeSuite('Tracer segments')
const suite = s.suite
const tracer = s.agent.tracer
const contextManager = helper.getContextManager()

const tx = helper.runInTransaction(s.agent, function (_tx) {
  return _tx
})
const bound = tracer.bindFunction(shared.getTest(), tx.root, true)
contextManager.setContext(tx.root)

suite.add({
  name: 'tracer.getSegment',
  fn: function () {
    return tracer.getSegment()
  }
})

suite.add({
  name: 'tracer.createSegment',
  fn: function () {
    return tracer.createSegment('test', null, null)
  }
})

suite.add({
  name: 'tracer.addSegment',
  fn: function () {
    const test = shared.getTest()
    return tracer.addSegment('test', null, null, true, test.func)
  }
})

suite.add({
  name: 'tracer.getSegmentFromWrapped',
  fn: function () {
    return tracer.getSegmentFromWrapped(bound)
  }
})

suite.run()
