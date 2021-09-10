/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../lib/benchmark')

const suite = benchmark.createBenchmark({
  name: 'async hooks',
  async: true,
  fn: runBenchmark
})

const asyncHooks = require('async_hooks')
const noopHook = asyncHooks.createHook({
  init: function () {},
  before: function () {},
  after: function () {},
  destroy: function () {}
})

const tests = [
  { name: 'no agent, no hooks' },
  {
    name: 'no agent, noop async hooks',
    before: function registerHook() {
      noopHook.enable()
    },
    after: function deregisterHook() {
      noopHook.disable()
    }
  },
  {
    name: 'instrumentation',
    agent: {
      config: { feature_flag: { await_support: false } }
    },
    runInTransaction: true
  },
  {
    name: 'agent async hooks',
    agent: {
      config: { feature_flag: { await_support: true } }
    },
    runInTransaction: true
  }
]

tests.forEach((test) => suite.add(test))

suite.run()

function runBenchmark(agent, cb) {
  let p = Promise.resolve()
  for (let i = 0; i < 300; ++i) {
    p = p.then(function noop() {})
  }
  p.then(cb)
}
