/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const {
  testPromiseContext,
} = require('./common-tests')
const {
  addTask,
  afterEach,
  beforeEach,
  testPromiseClassMethod,
} = require('./helpers')

test('new Promise()', async function (t) {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('throw', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 2,
      testFunc: function throwTest({ name, plan }) {
        try {
          return new Promise(function () {
            throw new Error(name + ' test error')
          }).then(
            function () {
              plan.ok(0, `${name} Error should have been caught`)
            },
            function (err) {
              plan.ok(err, name + ' Error should go to the reject handler')
              plan.equal(err.message, name + ' test error', name + ' Error should be as expected')
            }
          )
        } catch (e) {
          plan.ok(!e)
        }
      }
    })
  })

  await t.test('resolve then throw', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 1,
      testFunc: function resolveThrowTest({ name, plan }) {
        try {
          return new Promise(function (resolve) {
            resolve(name + ' foo')
            throw new Error(name + ' test error')
          }).then(
            function (res) {
              plan.equal(res, name + ' foo', name + ' promise should be resolved.')
            },
            function () {
              plan.ok(0, `${name} Error should have been caught`)
            }
          )
        } catch (e) {
          plan.ok(!e)
        }
      }
    })
  })

  await t.test('resolve usage', function (t, end) {
    const { Promise } = t.nr
    testPromiseClassMethod({
      t,
      end,
      count: 3,
      testFunc: function resolveTest({ name, plan }) {
        const tracer = helper.getTracer()
        const inTx = !!tracer.getSegment()

        return new Promise(function (resolve) {
          addTask(t.nr, function () {
            plan.ok(!tracer.getSegment(), name + 'should lose tx')
            resolve('foobar ' + name)
          })
        }).then(function (res) {
          if (inTx) {
            plan.ok(tracer.getSegment(), name + 'should return tx')
          } else {
            plan.ok(!tracer.getSegment(), name + 'should not create tx')
          }
          plan.equal(res, 'foobar ' + name, name + 'should resolve with correct value')
        })
      }
    })
  })

  await testPromiseContext({
    t,
    factory: function (Promise, name) {
      return Promise.resolve(name)
    }
  })
})
