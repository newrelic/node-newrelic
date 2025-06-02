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
  testPromiseInstanceMethod
} = require('./helpers')

test('Promise.map', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.map([name], function (v) {
        return v.toUpperCase()
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.map([Promise.resolve('1'), Promise.resolve('2')], function (item) {
          return Promise.resolve(name + item)
        }).then(function (result) {
          plan.deepEqual(result, [name + '1', name + '2'], 'should not change the result')
        })
      }
    })
  })
})

test('Promise#map', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([Promise.resolve('1'), Promise.resolve('2')]).map(function (item) {
        return Promise.resolve(name + item)
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [Promise.resolve('1'), Promise.resolve('2')]
          })
          .map(function (item) {
            return Promise.resolve(name + item)
          })
          .then(function (result) {
            plan.deepEqual(result, [name + '1', name + '2'], 'should not change the result')
          })
      }
    })
  })
})
