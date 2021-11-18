/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const helper = require('../../lib/agent_helper')
const WebFrameworkShim = require('../../../lib/shim/webframework-shim')

const agent = helper.loadMockedAgent()
const contextManager = helper.getContextManager()
const shim = new WebFrameworkShim(agent, 'test-module', './')
const suite = benchmark.createBenchmark({ name: 'recordMiddleware' })

const transaction = helper.runInTransaction(agent, function (tx) {
  return tx
})

shim.setFramework('benchmarks')

preOptRecordMiddleware()

addTests('implicit spec', implicitSpec)
addTests('explicit spec', explicitSpec)
addTests('   mixed spec', randomSpec)

setTimeout(function () {
  suite.run()
}, 500)

function addTests(name, speccer) {
  const middleware = recordFunc(speccer())

  suite.add({
    name: name + ' - function middleware',
    fn: function () {
      return recordFunc(speccer())
    }
  })

  suite.add({
    name: name + ' - property middleware',
    fn: function () {
      return recordProperty(speccer())
    }
  })

  suite.add({
    name: name + ' - mixed middleware   ',
    fn: function () {
      return randomRecord(speccer())
    }
  })

  suite.add({
    name: name + ' - wrapper (no tx)    ',
    fn: function () {
      contextManager.setContext(null)
      middleware(getReqd(), {}, noop)
    }
  })

  suite.add({
    name: name + ' - wrapper (tx)       ',
    fn: function () {
      contextManager.setContext(transaction.trace.root)
      middleware(getReqd(), {}, noop)
    }
  })
}

function getTest() {
  return {
    func: function (req, res, next) {
      next()
    }
  }
}

function getReqd() {
  return {
    params: { a: 1, b: 2, c: 3 },
    __NR_transactionInfo: {
      transaction: transaction,
      segmentStack: [],
      errorHandled: false,
      error: null
    }
  }
}

function implicitSpec() {
  return {}
}

function partialSpec() {
  return {
    next: shim.LAST,
    req: shim.FIRST
  }
}

function explicitSpec() {
  return {
    req: shim.FIRST,
    res: shim.SECOND,
    next: shim.LAST,
    name: 'funcy_name',
    params: function (shim, fn, name, args) {
      return args[0].params
    }
  }
}

function randomSpec() {
  const n = Math.random()
  if (n > 0.666) {
    return implicitSpec()
  } else if (n > 0.333) {
    return partialSpec()
  }
  return explicitSpec()
}

function recordFunc(spec) {
  return shim.recordMiddleware(getTest().func, spec)
}

function recordProperty(spec) {
  return shim.recordMiddleware(getTest(), 'func', spec)
}

function randomRecord(spec) {
  if (Math.random() > 0.5) {
    return recordFunc(spec)
  }
  return recordProperty(spec)
}

function noop() {}

function preOptRecordMiddleware() {
  for (let i = 0; i < 1000; ++i) {
    let m = randomRecord(randomSpec)
    m = typeof m === 'function' ? m : m.func
    for (let j = 0; j < 100; ++j) {
      m(getReqd(), {}, noop)
    }
  }
}
