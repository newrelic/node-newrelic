/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const {
  testPromiseContext,
  testPromiseClassCastMethod,
} = require('./common-tests')
const {
  afterEach,
  beforeEach,
  testPromiseClassMethod,
  testPromiseInstanceMethod
} = require('./helpers')

test('Promise.delay', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.delay(5, name)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, name }) {
        const DELAY = 500
        const MARGIN = 100
        const start = Date.now()
        return Promise.delay(DELAY, name).then(function (result) {
          const duration = Date.now() - start
          plan.ok(duration < DELAY + MARGIN, 'should not take more than expected time')
          plan.ok(duration > DELAY - MARGIN, 'should not take less than expected time')
          plan.equal(result, name, 'should pass through resolve value')
        })
      }
    })
  })

  await testPromiseClassCastMethod({
    t,
    count: 1,
    testFunc: function ({ plan, Promise, value }) {
      return Promise.delay(5, value).then(function (val) {
        plan.equal(val, value, 'should have expected value')
      })
    }
  })
})

test('Promise#delay', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name).delay(10)
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, promise, name }) {
        const DELAY = 500
        const MARGIN = 100
        const start = Date.now()
        return promise
          .return(name)
          .delay(DELAY)
          .then(function (result) {
            const duration = Date.now() - start
            plan.ok(duration < DELAY + MARGIN, 'should not take more than expected time')
            plan.ok(duration > DELAY - MARGIN, 'should not take less than expected time')
            plan.equal(result, name, 'should pass through resolve value')
          })
      }
    })
  })
})
