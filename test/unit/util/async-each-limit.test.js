/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const sinon = require('sinon')
const eachLimit = require('../../../lib/util/async-each-limit')

test('eachLimit', async (t) => {
  t.autoend()

  t.test('should limit concurrent executions', async (t) => {
    t.autoend()

    let firstPromiseResolve
    let secondPromiseResolve
    let thirdPromiseResolve

    const access = sinon
      .stub()
      .onCall(0)
      .returns(
        new Promise((resolve) => {
          firstPromiseResolve = resolve
        })
      )
      .onCall(1)
      .returns(
        new Promise((resolve) => {
          secondPromiseResolve = resolve
        })
      )
      .onCall(2)
      .returns(
        new Promise((resolve) => {
          thirdPromiseResolve = resolve
        })
      )

    const items = ['foo.json', 'bar.json', 'baz.json']
    const mapper = async (file) => {
      try {
        await access(file)
        return true
      } catch (err) {
        return false
      }
    }

    const promise = eachLimit(items, mapper, 2)

    t.equal(access.callCount, 2, 'should have called two promises')
    t.ok(access.calledWith('foo.json'), 'should have called the first promise')
    t.ok(access.calledWith('bar.json'), 'should have called the second promise')
    t.notOk(access.calledWith('baz.json'), 'should not have called the third promise yet')

    firstPromiseResolve()
    t.notOk(access.calledWith('baz.json'), 'should still not have called the third promise')

    secondPromiseResolve()
    thirdPromiseResolve()

    const results = await promise

    t.equal(access.callCount, 3, 'should have called three promises')
    t.ok(access.calledWith('baz.json'), 'should have called the third promise')
    t.same(results, [true, true, true], 'should return the correct results')
  })
})
