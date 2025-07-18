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

test('Promise.promisify', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.promisify(function (cb) {
        cb(null, name)
      })()
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 4,
      testFunc: function ({ plan, name }) {
        const fn = Promise.promisify(function (cb) {
          cb(new Error('Promise.promisify test error'))
        })

        // Test error handling.
        return fn()
          .then(
            function () {
              plan.ok(0, name + 'should not go into resolve after throwing')
            },
            function (err) {
              plan.ok(err, name + 'should have error')
              plan.equal(
                err.message,
                'Promise.promisify test error',
                name + 'should be correct error'
              )
            }
          )
          .then(function () {
            // Test success handling.
            const foo = { what: 'Promise.promisify test object' }
            const fn2 = Promise.promisify(function (cb) {
              cb(null, foo)
            })

            return fn2().then(function (obj) {
              plan.equal(obj, foo, name + 'should also work on success')
            })
          })
          .then(() => {
            // Test property copying.
            const unwrapped = (cb) => cb()
            const property = { name }
            unwrapped.property = property

            const wrapped = Promise.promisify(unwrapped)
            plan.equal(wrapped.property, property, 'should have copied properties')
          })
      }
    })
  })
})
