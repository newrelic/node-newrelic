/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const shared = require('./shared')
const helper = require('#testlib/agent_helper.js')

const s = shared.makeSuite('Tracer utilities')
const suite = s.suite
const tracer = helper.getTracer()

const tx = helper.runInTransaction(s.agent, function (_tx) {
  return _tx
})

tracer.setSegment({ transaction: tx, segment: tx.root })

suite.add({
  name: 'tracer.slice',
  fn: function () {
    function toSlice() {
      return tracer.slice(arguments)
    }
    return toSlice({}, 'func', 1, 2, 3)
  }
})

suite.add({
  name: 'tracer.getOriginal',
  fn: function () {
    const test = shared.getTest()
    return tracer.getOriginal(test.func)
  }
})

suite.run()
