/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const shared = require('./shared')

const s = shared.makeSuite()
const suite = s.suite
const tracer = helper.getTracer()
const tx = helper.runInTransaction(s.agent, function (_tx) {
  return _tx
})
tracer.setSegment({ transaction: tx, segment: tx.trace.root })

preOptBind()
const ctx = tracer.getContext()
const bound = tracer.bindFunction(shared.getTest().func, ctx, true)

setTimeout(function () {
  suite.add({
    name: 'all parameters',
    fn: allParamBind
  })

  suite.add({
    name: 'fn and segment',
    fn: twoParamBind
  })

  suite.add({
    name: 'mixed',
    fn: randomBind
  })

  suite.add({
    name: 'wrapped',
    fn: function () {
      return bound(Math.random(), Math.random(), Math.random())
    }
  })

  suite.run()
}, 15)

function allParamBind() {
  const test = shared.getTest()
  const ctx = tracer.getContext()
  test.func = tracer.bindFunction(test.func, ctx, Math.random() > 0.5)
}

function twoParamBind() {
  const test = shared.getTest()
  // eslint-disable-next-line no-unused-expressions
  Math.random() > 0.5 // rand call so all tests perform same amount of work.
  const ctx = tracer.getContext()
  test.func = tracer.bindFunction(test.func, ctx)
}

function randomBind() {
  const n = Math.random()
  if (n >= 0.75) {
    allParamBind()
  } else if (n >= 0.5) {
    twoParamBind()
  }
}

function preOptBind() {
  for (let i = 0; i < 1000000; ++i) {
    randomBind()
  }
}
