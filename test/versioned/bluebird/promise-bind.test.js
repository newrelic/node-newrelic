/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const {
  testPromiseContext,
  testPromiseClassCastMethod,
  testPromiseInstanceCastMethod,
} = require('./common-tests')
const {
  afterEach,
  beforeEach,
  testPromiseClassMethod,
  testPromiseInstanceMethod
} = require('./helpers')

test('Promise.bind', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.bind(name)
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 2,
      testFunc: function ({ plan, name }) {
        const ctx = {}
        return Promise.bind(ctx, name).then(function (value) {
          plan.equal(this, ctx, 'should have expected `this` value')
          plan.equal(value, name, 'should not change passed value')
        })
      }
    })
  })

  await testPromiseClassCastMethod({
    t,
    count: 4,
    testFunc: function ({ plan, Promise, name, value }) {
      return Promise.bind(value, name).then(function (ctx) {
        plan.equal(this, value, 'should have expected `this` value')
        plan.equal(ctx, name, 'should not change passed value')

        // Try with this context type in both positions.
        return Promise.bind(name, value).then(function (val2) {
          plan.equal(this, name, 'should have expected `this` value')
          plan.equal(val2, value, 'should not change passed value')
        })
      })
    }
  })
})

test('Promise#bind', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name).bind({ name })
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseInstanceMethod({
      t,
      end,
      count: 4,
      testFunc: function ({ plan, promise, name }) {
        const foo = { what: 'test object' }
        const ctx2 = { what: 'a different test object' }
        const err = new Error('oh dear')
        return promise
          .bind(foo)
          .then(function (res) {
            plan.equal(this, foo, name + 'should have correct this value')
            plan.deepEqual(res, [1, 2, 3, name], name + 'parameters should be correct')

            return Promise.reject(err)
          })
          .bind(ctx2, name)
          .catch(function (reason) {
            plan.equal(this, ctx2, 'should have expected `this` value')
            plan.equal(reason, err, 'should not change rejection reason')
          })
      }
    })
  })

  await testPromiseInstanceCastMethod({
    t,
    count: 2,
    testFunc: function ({ plan, promise, name, value }) {
      return promise.bind(value).then(function (val) {
        plan.equal(this, value, 'should have correct context')
        plan.equal(val, name, 'should have expected value')
      })
    }
  })
})
