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

test('Promise#call', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve({
        foo: function () {
          return Promise.resolve(name)
        }
      }).call('foo')
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, promise, name }) {
        const foo = {
          test: function () {
            plan.equal(this, foo, name + 'should have correct this value')
            plan.ok(1, name + 'should call the test method of foo')
            return 'foobar'
          }
        }
        return promise
          .then(function () {
            return foo
          })
          .call('test')
          .then(function (res) {
            plan.deepEqual(res, 'foobar', name + 'parameters should be correct')
          })
      }
    })
  })
})
