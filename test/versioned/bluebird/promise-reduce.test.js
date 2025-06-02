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

test('Promise.reduce', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.reduce([name, name], function (a, b) {
        return a + b
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
        return Promise.reduce(
          [Promise.resolve('1'), Promise.resolve('2'), Promise.resolve('3'), Promise.resolve('4')],
          function (a, b) {
            return Promise.resolve(name + a + b)
          }
        ).then(function (result) {
          plan.equal(result, name + name + name + '1234', 'should not change the result')
        })
      }
    })
  })
})

test('Promise#reduce', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.resolve('1'),
        Promise.resolve('2'),
        Promise.resolve('3'),
        Promise.resolve('4')
      ]).reduce(function (a, b) {
        return Promise.resolve(name + a + b)
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
              Promise.resolve('1'),
              Promise.resolve('2'),
              Promise.resolve('3'),
              Promise.resolve('4')
            ]
          })
          .reduce(function (a, b) {
            return Promise.resolve(name + a + b)
          })
          .then(function (result) {
            plan.equal(result, name + name + name + '1234', 'should not change the result')
          })
      }
    })
  })
})
