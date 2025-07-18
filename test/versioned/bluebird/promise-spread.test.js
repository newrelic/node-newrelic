/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const {
  testPromiseContext,
} = require('./common-tests')
const {
  afterEach,
  beforeEach,
  testPromiseInstanceMethod
} = require('./helpers')

test('Promise#spread', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([name, 1, 2, 3, 4]).spread(function () {})
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise.spread(function (a, b, c, d) {
          plan.deepEqual([a, b, c, d], [1, 2, 3, name], name + 'parameters should be correct')
        })
      }
    })
  })
})
