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

test('Promise.filter', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.filter([name], function () {
        return true
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
        return Promise.filter(
          [
            Promise.resolve(name + '1'),
            Promise.resolve(name + '2'),
            Promise.resolve(name + '3'),
            Promise.resolve(name + '4')
          ],
          function (value) {
            return Promise.resolve(/[24]$/.test(value))
          }
        ).then(function (result) {
          plan.deepEqual(result, [name + '2', name + '4'], 'should not change the result')
        })
      }
    })
  })
})

test('Promise#filter', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.resolve(name + '1'),
        Promise.resolve(name + '2'),
        Promise.resolve(name + '3'),
        Promise.resolve(name + '4')
      ]).filter(function (value, i) {
        return Promise.delay(i, /[24]$/.test(value))
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
            return [
              Promise.resolve(name + '1'),
              Promise.resolve(name + '2'),
              Promise.resolve(name + '3'),
              Promise.resolve(name + '4')
            ]
          })
          .filter(function (value) {
            return Promise.resolve(/[24]$/.test(value))
          })
          .then(function (result) {
            plan.deepEqual(result, [name + '2', name + '4'], 'should not change the result')
          })
      }
    })
  })
})
