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

test('Promise.race', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.race([name])
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.race([
          Promise.resolve(name + 'resolved'),
          // eslint-disable-next-line prefer-promise-reject-errors
          Promise.reject(name + 'rejection!'),
          Promise.delay(15, name + 'delayed')
        ]).then(function (result) {
          plan.equal(result, name + 'resolved', 'should not change the result')
        })
      }
    })
  })
})

test('Promise#race', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([
        Promise.resolve(name + 'resolved'),
        Promise.delay(15, name + 'delayed')
      ]).race()
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
            return [Promise.resolve(name + 'resolved'), Promise.delay(15, name + 'delayed')]
          })
          .race()
          .then(function (result) {
            plan.equal(result, name + 'resolved', 'should not change the result')
          })
      }
    })
  })
})
