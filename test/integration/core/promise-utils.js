/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const asyncHooks = require('async_hooks')

function createHook() {
  const testMetrics = {
    initCalled: 0,
    beforeCalled: 0,
    afterCalled: 0,
    destroyCalled: 0
  }

  let calls = 0
  const promiseIds = {}
  const hook = asyncHooks.createHook({
    init: function initHook(id, type) {
      if (type === 'PROMISE') {
        // There are a lot of promises being run around the test framework
        // just get the first two as they are for the test
        if (calls < 2) {
          promiseIds[id] = true
          testMetrics.initCalled++
        }
        calls++
      }
    },
    before: function beforeHook(id) {
      if (promiseIds[id]) {
        testMetrics.beforeCalled++
      }
    },
    after: function afterHook(id) {
      if (promiseIds[id]) {
        testMetrics.afterCalled++
      }
    },
    destroy: function destHook(id) {
      if (promiseIds[id]) {
        testMetrics.destroyCalled++
      }
    }
  })

  hook.enable()

  return testMetrics
}

function checkCallMetrics(plan, testMetrics) {
  plan.ok(testMetrics.initCalled, 2, 'two promises were created')
  plan.equal(testMetrics.beforeCalled, 1, 'before hook called for all async promises')
  plan.equal(
    testMetrics.beforeCalled,
    testMetrics.afterCalled,
    'before should be called as many times as after'
  )
}

class TestResource extends asyncHooks.AsyncResource {
  constructor(id) {
    super('PROMISE', id)
  }

  doStuff(callback) {
    process.nextTick(() => {
      if (this.runInAsyncScope) {
        this.runInAsyncScope(callback)
      } else {
        this.emitBefore()
        callback()
        this.emitAfter()
      }
    })
  }
}

module.exports = {
  createHook,
  checkCallMetrics,
  TestResource
}
