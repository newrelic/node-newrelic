/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const shared = require('./shared')

const s = shared.makeSuite()
const suite = s.suite
const tracer = s.agent.tracer
const contextManager = helper.getContextManager()
const tx = helper.runInTransaction(s.agent, function (_tx) {
  return _tx
})
contextManager.setContext(tx.root)

preOptBind()
const bound = tracer.bindFunction(shared.getTest().func, tx.root, true)

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
    name: 'just fn',
    fn: oneParamBind
  })

  suite.add({
    name: 'null segment',
    fn: nullSegmentBind
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
  test.func = tracer.bindFunction(test.func, tx.root, Math.random() > 0.5)
}

function twoParamBind() {
  const test = shared.getTest()
  Math.random() > 0.5 // rand call so all tests perform same amount of work.
  test.func = tracer.bindFunction(test.func, tx.root)
}

function oneParamBind() {
  const test = shared.getTest()
  Math.random() > 0.5 // rand call so all tests perform same amount of work.
  test.func = tracer.bindFunction(test.func)
}

function nullSegmentBind() {
  const test = shared.getTest()
  test.func = tracer.bindFunction(test.func, null, Math.random() > 0.5)
}

function randomBind() {
  const n = Math.random()
  if (n >= 0.75) {
    allParamBind()
  } else if (n >= 0.5) {
    twoParamBind()
  } else if (n >= 0.25) {
    oneParamBind()
  } else {
    nullSegmentBind()
  }
}

function preOptBind() {
  for (let i = 0; i < 1000000; ++i) {
    randomBind()
  }
}
