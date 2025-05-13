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

test('Promise.any', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.any([name])
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.any([
          Promise.reject(name + 'rejection!'),
          Promise.resolve(name + 'resolved'),
          Promise.delay(15, name + 'delayed')
        ]).then(function (result) {
          plan.equal(result, name + 'resolved', 'should not change the result')
        })
      }
    })
  })
})

test('Promise#any', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.reject(name + 'rejection!'),
        Promise.resolve(name + 'resolved'),
        Promise.delay(15, name + 'delayed')
      ]).any()
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
              Promise.reject(name + 'rejection!'),
              Promise.resolve(name + 'resolved'),
              Promise.delay(15, name + 'delayed')
            ]
          })
          .any()
          .then(function (result) {
            plan.equal(result, name + 'resolved', 'should not change the result')
          })
      }
    })
  })
})
