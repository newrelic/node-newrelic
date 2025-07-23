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

test('Promise.coroutine', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.coroutine(function * (_name) {
        for (let i = 0; i < 10; ++i) {
          yield Promise.delay(5)
        }
        return _name
      })(name)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 4,
      testFunc: function ({ plan, name }) {
        let count = 0

        plan.doesNotThrow(function () {
          Promise.coroutine.addYieldHandler(function (value) {
            if (value === name) {
              plan.ok(1, 'should call yield handler')
              return Promise.resolve(value + ' yielded')
            }
          })
        }, 'should be able to add yield handler')

        return Promise.coroutine(function * (_name) {
          for (let i = 0; i < 10; ++i) {
            yield Promise.delay(5)
            ++count
          }
          return yield _name
        })(name).then(function (result) {
          plan.equal(count, 10, 'should step through whole coroutine')
          plan.equal(result, name + ' yielded', 'should pass through resolve value')
        })
      }
    })
  })
})
