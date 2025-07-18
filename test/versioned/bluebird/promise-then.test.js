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

test('Promise#then', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve().then(function () {
        return name
      })
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function (res) {
            plan.deepEqual(res, [1, 2, 3, name], name + 'should have the correct result value')
            throw new Error('Promise#then test error')
          })
          .then(
            function () {
              plan.ok(0, name + 'should not go into resolve handler from rejected promise')
            },
            function (err) {
              plan.ok(err, name + 'should pass error into thenned rejection handler')
              plan.equal(err.message, 'Promise#then test error', name + 'should be correct error')
            }
          )
      }
    })
  })
})
