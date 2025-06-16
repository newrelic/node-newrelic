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
  testPromiseClassMethod,
} = require('./helpers')

test('Promise.method', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.method(function () {
        return name
      })()
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, name }) {
        const fn = Promise.method(function () {
          throw new Error('Promise.method test error')
        })

        return fn()
          .then(
            function () {
              plan.ok(0, name + 'should not go into resolve after throwing')
            },
            function (err) {
              plan.ok(err, name + 'should have error')
              plan.equal(err.message, 'Promise.method test error', name + 'should be correct error')
            }
          )
          .then(function () {
            const foo = { what: 'Promise.method test object' }
            const fn2 = Promise.method(function () {
              return foo
            })

            return fn2().then(function (obj) {
              plan.equal(obj, foo, name + 'should also work on success')
            })
          })
      }
    })
  })
})
