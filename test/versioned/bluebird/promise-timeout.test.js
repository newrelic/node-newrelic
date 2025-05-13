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

test('Promise#timeout', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name).timeout(10)
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 4,
      testFunc: function ({ plan, promise, name }) {
        let start = null
        return promise
          .timeout(1000)
          .then(
            function (res) {
              plan.deepEqual(res, [1, 2, 3, name], name + 'should pass values into tap handler')
              start = Date.now()
            },
            function (err) {
              plan.ok(!err)
            }
          )
          .delay(1000, 'never see me')
          .timeout(500, name + 'timed out')
          .then(
            function () {
              plan.ok(0, name + 'should have timed out long delay')
            },
            function (err) {
              const duration = Date.now() - start
              plan.ok(duration < 600, name + 'should not timeout slower than expected')
              plan.ok(duration > 400, name + 'should not timeout faster than expected')
              plan.equal(err.message, name + 'timed out', name + 'should have expected error')
            }
          )
      }
    })
  })
})
