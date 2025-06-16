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

test('Promise#catchThrow', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.reject(new Error()).catchThrow(new Error(name))
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        const foo = { what: 'catchThrow test object' }
        return promise
          .throw(new Error('catchThrow test error'))
          .catchThrow(foo)
          .catch(function (err) {
            plan.equal(err, foo, name + 'should pass throught the correct object')
          })
      }
    })
  })

  await testPromiseInstanceCastMethod({
    t,
    count: 1,
    testFunc: function ({ plan, promise, value }) {
      return promise
        .then(function () {
          throw new Error('woops')
        })
        .catchThrow(value)
        .catch(function (err) {
          plan.equal(err, value, 'should have expected error')
        })
    }
  })
})
