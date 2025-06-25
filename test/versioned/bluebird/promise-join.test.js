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
} = require('./helpers')

test('Promise.join', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.join(name)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.join(
          Promise.resolve(1),
          Promise.resolve(2),
          Promise.resolve(3),
          Promise.resolve(name)
        ).then(function (res) {
          plan.deepEqual(res, [1, 2, 3, name], name + 'should have all the values')
        })
      }
    })
  })

  await testPromiseClassCastMethod({
    t,
    count: 1,
    testFunc: function ({ plan, Promise, name, value }) {
      return Promise.join(value, name).then(function (values) {
        plan.deepEqual(values, [value, name], 'should have expected values')
      })
    }
  })
})
