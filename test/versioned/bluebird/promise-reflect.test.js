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

test('Promise#reflect', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name).reflect()
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 12,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .reflect()
          .then(function (inspection) {
            // Inspection of a resolved promise.
            plan.ok(!inspection.isPending(), name + 'should not be pending')
            plan.ok(!inspection.isRejected(), name + 'should not be rejected')
            plan.ok(inspection.isFulfilled(), name + 'should be fulfilled')
            plan.ok(!inspection.isCancelled(), name + 'should not be cancelled')
            plan.throws(function () {
              inspection.reason()
            }, name + 'should throw when accessing reason')
            plan.ok(inspection.value(), name + 'should have the value')
          })
          .throw(new Error(name + 'test error'))
          .reflect()
          .then(function (inspection) {
            plan.ok(!inspection.isPending(), name + 'should not be pending')
            plan.ok(inspection.isRejected(), name + 'should be rejected')
            plan.ok(!inspection.isFulfilled(), name + 'should not be fulfilled')
            plan.ok(!inspection.isCancelled(), name + 'should not be cancelled')
            plan.ok(inspection.reason(), name + 'should have the reason for rejection')
            plan.throws(function () {
              inspection.value()
            }, 'should throw accessing the value')
          })
      }
    })
  })
})
