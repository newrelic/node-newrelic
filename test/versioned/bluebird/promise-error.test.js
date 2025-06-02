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

test('Promise#error', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  function OperationalError(message) {
    this.message = message
    this.isOperational = true
  }

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.reject(new OperationalError(name)).error(function (err) {
        return err
      })
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 2,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .error(function (err) {
            plan.ok(!err)
          })
          .then(function () {
            throw new OperationalError('Promise#error test error')
          })
          .error(function (err) {
            plan.ok(err, name + 'should pass error into rejection handler')
            plan.equal(err.message, 'Promise#error test error', name + 'should be correct error')
          })
      }
    })
  })
})
