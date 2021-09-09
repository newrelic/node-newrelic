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
const tx = helper.runInTransaction(s.agent, function (_tx) {
  return _tx
})
const bound = tracer.bindFunction(shared.getTest(), tx.root, true)
tracer.segment = tx.root

suite.add({
  name: 'tracer.getSegment',
  fn: function () {
    return tracer.getSegment()
  }
})

suite.add({
  name: 'tracer.createSegment',
  fn: function () {
    tracer.segment = tracer.createSegment('test', null, null)
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
