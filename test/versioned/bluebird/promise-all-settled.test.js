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
  testPromiseClassMethod,
} = require('./helpers')
const { version: pkgVersion } = require('bluebird/package')

test('Promise.allSettled', { skip: semver.lt(pkgVersion, '3.7.0') }, async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.allSettled([Promise.resolve(name), Promise.reject(name)])
    }
  })

  await t.test('usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      count: 1,
      end,
      testFunc: function ({ name, plan }) {
        const p1 = Promise.resolve(name + '1')
        // eslint-disable-next-line prefer-promise-reject-errors
        const p2 = Promise.reject(name + '2')

        return Promise.allSettled([p1, p2]).then(function (inspections) {
          const result = inspections.map(function (i) {
            return i.isFulfilled() ? { value: i.value() } : { reason: i.reason() }
          })
          plan.deepEqual(
            result,
            [{ value: name + '1' }, { reason: name + '2' }],
            name + 'should not change result'
          )
        })
      }
    })
  })
})
