/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/* eslint-disable prefer-promise-reject-errors */
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

test('Promise.some', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.some([name], 1)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.some(
          [
            Promise.resolve(name + 'resolved'),
            Promise.reject(name + 'rejection!'),
            Promise.delay(100, name + 'delayed more'),
            Promise.delay(5, name + 'delayed')
          ],
          2
        ).then(function (result) {
          plan.deepEqual(
            result,
            [name + 'resolved', name + 'delayed'],
            'should not change the result'
          )
        })
      }
    })
  })
})

test('Promise#some', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.resolve(name + 'resolved'),
        Promise.reject(name + 'rejection!'),
        Promise.delay(100, name + 'delayed more'),
        Promise.delay(5, name + 'delayed')
      ]).some(2)
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
              Promise.resolve(name + 'resolved'),
              Promise.reject(name + 'rejection!'),
              Promise.delay(100, name + 'delayed more'),
              Promise.delay(5, name + 'delayed')
            ]
          })
          .some(2)
          .then(function (result) {
            plan.deepEqual(
              result,
              [name + 'resolved', name + 'delayed'],
              'should not change the result'
            )
          })
      }
    })
  })
})
