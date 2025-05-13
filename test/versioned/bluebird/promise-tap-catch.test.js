/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const semver = require('semver')

const {
  testPromiseContext,
} = require('./common-tests')
const {
  afterEach,
  beforeEach,
  testPromiseInstanceMethod
} = require('./helpers')
const { version: pkgVersion } = require('bluebird/package')

test('Promise#tapCatch', { skip: semver.lt(pkgVersion, '3.5.0') }, async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.reject(new Error(name)).tapCatch(function () {})
    }
  })

  await t.test('usage', function (t, end) {
    testPromiseInstanceMethod({
      t,
      end,
      count: 3,
      testFunc: function ({ plan, promise, name }) {
        return promise
          .throw(new Error(name))
          .tapCatch(function (err) {
            plan.equal(err && err.message, name, name + 'should pass values into tapCatch handler')
          })
          .then(function () {
            plan.ok(0, 'should not enter following resolve handler')
          })
          .catch(function (err) {
            plan.equal(
              err && err.message,
              name,
              name + 'should pass values beyond tapCatch handler'
            )
            return name + 'resolve test'
          })
          .tapCatch(function () {
            plan.ok(0, name + 'should not call tapCatch after resolved promises')
          })
          .then(function (value) {
            plan.equal(value, name + 'resolve test', name + 'should pass error beyond tap handler')
          })
      }
    })
  })
})
