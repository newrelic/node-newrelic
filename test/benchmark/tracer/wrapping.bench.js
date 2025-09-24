/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EventEmitter = require('events').EventEmitter
const helper = require('#testlib/agent_helper.js')
const shared = require('./shared')

const s = shared.makeSuite('Tracer wrapping')
const suite = s.suite
const tracer = s.agent.tracer
const tx = helper.runInTransaction(s.agent, function (_tx) {
  return _tx
})

suite.add({
  name: 'tracer.bindFunction',
  fn: function () {
    const test = shared.getTest()
    let ctx = tracer.getContext()
    ctx = ctx.enterSegment({ transaction: tx, segment: tx.trace.root })
    return tracer.bindFunction(test.func, ctx, true)
  }
})

suite.add({
  name: 'tracer.bindEmitter',
  fn: function () {
    return tracer.bindEmitter(new EventEmitter(), tx.trace.root)
  }
})

suite.add({
  name: 'tracer.wrapFunctionFirstNoSegment',
  fn: function () {
    const test = shared.getTest()
    return tracer.wrapFunctionFirstNoSegment(test.func, 'func')
  }
})

suite.add({
  name: 'tracer.wrapFunction',
  fn: function () {
    const test = shared.getTest()
    return tracer.wrapFunction('func', null, test.func, function () {}, null)
  }
})

suite.add({
  name: 'tracer.wrapFunctionLast',
  fn: function () {
    const test = shared.getTest()
    return tracer.wrapFunctionLast('func', null, test.func)
  }
})

suite.add({
  name: 'tracer.wrapFunctionFirst',
  fn: function () {
    const test = shared.getTest()
    return tracer.wrapFunctionFirst('func', null, test.func)
  }
})

suite.add({
  name: 'tracer.wrapSyncFunction',
  fn: function () {
    const test = shared.getTest()
    return tracer.wrapSyncFunction('func', null, test.func)
  }
})

suite.add({
  name: 'tracer.wrapCallback',
  fn: function () {
    const test = shared.getTest()
    return tracer.wrapCallback(test.func, tx.trace.root, null)
  }
})

suite.run()
