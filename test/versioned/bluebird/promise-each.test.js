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

test('Promise.each', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.each([name], function () {})
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 5,
      testFunc: function ({ plan, name }) {
        return Promise.each(
          [
            Promise.resolve(name + '1'),
            Promise.resolve(name + '2'),
            Promise.resolve(name + '3'),
            Promise.resolve(name + '4')
          ],
          function (value, i) {
            plan.equal(value, name + (i + 1), 'should not change input to iterator')
          }
        ).then(function (result) {
          plan.deepEqual(result, [name + '1', name + '2', name + '3', name + '4'])
        })
      }
    })
  })
})

test('Promise#each', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.delay(Math.random() * 10, name + '1'),
        Promise.delay(Math.random() * 10, name + '2'),
        Promise.delay(Math.random() * 10, name + '3'),
        Promise.delay(Math.random() * 10, name + '4')
      ]).each(function (value, i) {
        return Promise.delay(i, value)
      })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 5,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .then(function () {
            return [
              Promise.delay(Math.random() * 10, name + '1'),
              Promise.delay(Math.random() * 10, name + '2'),
              Promise.delay(Math.random() * 10, name + '3'),
              Promise.delay(Math.random() * 10, name + '4')
            ]
          })
          .each(function (value, i) {
            plan.equal(value, name + (i + 1), 'should not change input to iterator')
          })
          .then(function (result) {
            plan.deepEqual(result, [name + '1', name + '2', name + '3', name + '4'])
          })
      }
    })
  })
})
