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

test('Promise#tap', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name).tap(function () {})
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 4,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .tap(function (res) {
            plan.deepEqual(res, [1, 2, 3, name], name + 'should pass values into tap handler')
          })
          .then(function (res) {
            plan.deepEqual(res, [1, 2, 3, name], name + 'should pass values beyond tap handler')
            throw new Error('Promise#tap test error')
          })
          .tap(function () {
            plan.ok(0, name + 'should not call tap after rejected promises')
          })
          .catch(function (err) {
            plan.ok(err, name + 'should pass error beyond tap handler')
            plan.equal(
              err && err.message,
              'Promise#tap test error',
              name + 'should be correct error'
            )
          })
      }
    })
  })
})
