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

test('Promise.props', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.props({ name })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function ({ plan, name }) {
        return Promise.props({
          first: Promise.resolve(name + '1'),
          second: Promise.resolve(name + '2')
        }).then(function (result) {
          plan.deepEqual(
            result,
            { first: name + '1', second: name + '2' },
            'should not change results'
          )
        })
      }
    })
  })
})

test('Promise#props', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve({
        first: Promise.delay(5, name + '1'),
        second: Promise.delay(5, name + '2')
      }).props()
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
            return {
              first: Promise.resolve(name + '1'),
              second: Promise.resolve(name + '2')
            }
          })
          .props()
          .then(function (result) {
            plan.deepEqual(
              result,
              { first: name + '1', second: name + '2' },
              'should not change results'
            )
          })
      }
    })
  })
})
