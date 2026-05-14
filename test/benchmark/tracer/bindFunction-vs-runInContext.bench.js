/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('#testlib/agent_helper.js')
const shared = require('./shared')
const assert = require('node:assert')

const s = shared.makeSuite('runInContext')
const suite = s.suite
const tracer = helper.getTracer()

const tx = helper.runInTransaction(s.agent, function (_tx) {
  return _tx
})
tracer.setSegment({ transaction: tx, segment: tx.trace.root })
const ctx = tracer.getContext()

function handler(a, b, c) {
  return a + b + c
}

const thisArg = {}
const args = [1, 2, 3]

function runBoundFunctionInContext(ctx, handler, thisArg, args) {
  return tracer.bindFunction(handler, ctx, false).apply(thisArg, args)
}

function runFunctionInContext(ctx, handler, thisArg, args) {
  return tracer.runInContext({ handler, context: ctx, thisArg, args })
}

// warmup
for (let i = 0; i < 1000; ++i) {
  runBoundFunctionInContext(ctx, handler, thisArg, args)
  runFunctionInContext(ctx, handler, thisArg, args)
}

setTimeout(function () {
  suite.add({
    name: 'bindFunction with args',
    fn: function () {
      for (let i = 0; i < 1000; ++i) {
        const result = runBoundFunctionInContext(ctx, handler, thisArg, args)
        assert.equal(result, 6)
      }
    }
  })

  suite.add({
    name: 'runInContext with args',
    fn: function () {
      for (let i = 0; i < 1000; ++i) {
        const result = runFunctionInContext(ctx, handler, thisArg, args)
        assert.equal(result, 6)
      }
    }
  })

  suite.run()
}, 15)
