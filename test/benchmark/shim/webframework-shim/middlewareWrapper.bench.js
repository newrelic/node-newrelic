/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const helper = require('#testlib/agent_helper.js')

const agent = helper.loadMockedAgent()
const tracer = helper.getTracer()
const als = tracer._contextManager._asyncLocalStorage

const suite = benchmark.createBenchmark({ name: 'handler invocation', runs: 10000 })

const transaction = helper.runInTransaction(agent, function (tx) {
  return tx
})

function handler(req, res, next) {
  return next()
}

function noop() {}

tracer.setSegment({ transaction, segment: transaction.trace.root })
const ctx = tracer.getContext()
const segment = tracer.createSegment({
  name: 'Nodejs/Middleware/Benchmarks/handler',
  parent: ctx.segment,
  transaction
})
const newCtx = ctx.enterSegment({ segment })

// warmup both paths
for (let i = 0; i < 100000; ++i) {
  // eslint-disable-next-line no-useless-call
  tracer.bindFunction(handler, newCtx, true).apply(null, [{}, {}, noop])
  als.run(newCtx, Reflect.apply, handler, null, [{}, {}, noop])
}

setTimeout(function () {
  suite.add({
    name: 'bindFunction (full=true)',
    fn: function () {
      tracer.setSegment({ transaction, segment: transaction.trace.root })
      for (let i = 0; i < 100; ++i) {
        // eslint-disable-next-line no-useless-call
        tracer.bindFunction(handler, newCtx, true).apply(null, [{}, {}, noop])
      }
    }
  })

  suite.add({
    name: 'bindFunction (full=false)',
    fn: function () {
      tracer.setSegment({ transaction, segment: transaction.trace.root })
      for (let i = 0; i < 100; ++i) {
        // eslint-disable-next-line no-useless-call
        tracer.bindFunction(handler, newCtx, false).apply(null, [{}, {}, noop])
      }
    }
  })

  suite.add({
    name: 'direct ALS.run + reflect.apply',
    fn: function () {
      tracer.setSegment({ transaction, segment: transaction.trace.root })
      for (let i = 0; i < 100; ++i) {
        als.run(newCtx, Reflect.apply, handler, null, [{}, {}, noop])
      }
    }
  })

  suite.run()
}, 15)
