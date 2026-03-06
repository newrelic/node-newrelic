/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('#testlib/agent_helper.js')
const shared = require('./shared')

const s = shared.makeSuite('runInContext')
const suite = s.suite
const tracer = helper.getTracer()
const ctxManager = tracer._contextManager
const als = ctxManager._asyncLocalStorage

const tx = helper.runInTransaction(s.agent, function (_tx) {
  return _tx
})
tracer.setSegment({ transaction: tx, segment: tx.trace.root })
const ctx = tracer.getContext()

function handler(a, b, c) {
  return a + b + c
}

function runInContextWithBind(context, callback, cbThis, args) {
  const toInvoke = cbThis ? callback.bind(cbThis) : callback
  if (args) {
    return als.run(context, toInvoke, ...args)
  }
  return als.run(context, toInvoke)
}

function runInContextWithReflect(context, callback, cbThis, args) {
  if (cbThis || args) {
    return als.run(context, Reflect.apply, callback, cbThis ?? null, args ?? [])
  }
  return als.run(context, callback)
}

const thisArg = {}

// warmup
for (let i = 0; i < 100000; ++i) {
  runInContextWithBind(ctx, handler, thisArg, [1, 2, 3])
  runInContextWithReflect(ctx, handler, thisArg, [1, 2, 3])
}

setTimeout(function () {
  suite.add({
    name: '.bind + spread (array)',
    fn: function () {
      for (let i = 0; i < 100; ++i) {
        runInContextWithBind(ctx, handler, thisArg, [1, 2, 3])
      }
    }
  })

  suite.add({
    name: 'reflect.apply (array)',
    fn: function () {
      for (let i = 0; i < 100; ++i) {
        runInContextWithReflect(ctx, handler, thisArg, [1, 2, 3])
      }
    }
  })

  suite.add({
    name: '.bind + spread (arguments)',
    fn: function () {
      for (let i = 0; i < 100; ++i) {
        invokeOld(1, 2, 3)
      }
    }
  })

  suite.add({
    name: 'reflect.apply (arguments)',
    fn: function () {
      for (let i = 0; i < 100; ++i) {
        invokeNew(1, 2, 3)
      }
    }
  })

  suite.run()
}, 15)

function invokeOld(a, b, c) {
  return runInContextWithBind(ctx, handler, thisArg, arguments)
}

function invokeNew(a, b, c) {
  return runInContextWithReflect(ctx, handler, thisArg, arguments)
}
