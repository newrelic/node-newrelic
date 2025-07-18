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

test('Promise.all', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      count: 1,
      end,
      testFunc: function ({ name, plan }) {
        const p1 = Promise.resolve(name + '1')
        const p2 = Promise.resolve(name + '2')

        return Promise.all([p1, p2]).then(function (result) {
          plan.deepEqual(result, [name + '1', name + '2'], name + 'should not change result')
        })
      }
    })
  })

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.all([name])
    }
  })
})

test('Promise#all', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve([Promise.resolve(name + '1'), Promise.resolve(name + '2')]).all()
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
            return [Promise.resolve(name + '1'), Promise.resolve(name + '2')]
          })
          .all()
          .then(function (result) {
            plan.deepEqual(result, [name + '1', name + '2'], name + 'should not change result')
          })
      }
    })
  })
})
