/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const {
  testPromiseContext,
  testPromiseInstanceCastMethod
} = require('./common-tests')
const {
  afterEach,
  beforeEach,
  testPromiseInstanceMethod
} = require('./helpers')

test('Promise#return', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve().return(name)
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        const foo = { what: 'return test object' }
        return promise.return(foo).then(function (res) {
          plan.equal(res, foo, name + 'should pass throught the correct object')
        })
      }
    })
  })

  await testPromiseInstanceCastMethod({
    t,
    count: 1,
    testFunc: function ({ plan, promise, value }) {
      return promise.return(value).then(function (val) {
        plan.equal(val, value, 'should have expected value')
      })
    }
  })
})
