/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - startSegment', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    agent = null

    done()
  })

  t.test('should name the segment as provided', (t) => {
    helper.runInTransaction(agent, function() {
      api.startSegment('foobar', false, function() {
        const segment = api.shim.getSegment()
        t.ok(segment)
        t.equal(segment.name, 'foobar')

        t.end()
      })
    })
  })

  t.test('should return the return value of the handler', (t) => {
    helper.runInTransaction(agent, function() {
      const obj = {}
      const ret = api.startSegment('foobar', false, function() {
        return obj
      })

      t.equal(ret, obj)
      t.end()
    })
  })

  t.test('should not record a metric when `record` is `false`', (t) => {
    helper.runInTransaction(agent, function(tx) {
      tx.name = 'test'
      api.startSegment('foobar', false, function() {
        const segment = api.shim.getSegment()

        t.ok(segment)
        t.equal(segment.name, 'foobar')
      })

      tx.end()

      const hasNameMetric = Object.hasOwnProperty.call(tx.metrics.scoped, tx.name)
      t.notOk(hasNameMetric)

      const hasCustomMetric = Object.hasOwnProperty.call(tx.metrics.unscoped, 'Custom/foobar')
      t.notOk(hasCustomMetric)

      t.end()
    })
  })

  t.test('should record a metric when `record` is `true`', (t) => {
    helper.runInTransaction(agent, function(tx) {
      tx.name = 'test'
      api.startSegment('foobar', true, function() {
        const segment = api.shim.getSegment()

        t.ok(segment)
        t.equal(segment.name, 'foobar')
      })
      tx.end()

      const transactionNameMetric = tx.metrics.scoped[tx.name]
      t.ok(transactionNameMetric)

      const transactionScopedCustomMetric = transactionNameMetric['Custom/foobar']
      t.ok(transactionScopedCustomMetric)

      const unscopedCustomMetric = tx.metrics.unscoped['Custom/foobar']
      t.ok(unscopedCustomMetric)

      t.end()
    })
  })

  t.test('should time the segment from the callback if provided', (t) => {
    helper.runInTransaction(agent, function() {
      api.startSegment('foobar', false, function(cb) {
        const segment = api.shim.getSegment()
        setTimeout(cb, 150, null, segment)
      }, function(err, segment) {
        t.notOk(err)
        t.ok(segment)

        const duration = segment.getDurationInMillis()
        const isExpectedRange = (duration >= 100) && (duration < 200)
        t.ok(isExpectedRange)

        t.end()
      })
    })
  })

  t.test('should time the segment from a returned promise', (t) => {
    return helper.runInTransaction(agent, function() {
      return api.startSegment('foobar', false, function() {
        const segment = api.shim.getSegment()
        return new Promise(function(resolve) {
          setTimeout(resolve, 150, segment)
        })
      }).then(function(segment) {
        t.ok(segment)

        const duration = segment.getDurationInMillis()
        const isExpectedRange = (duration >= 100) && (duration < 200)
        t.ok(isExpectedRange)

        t.end()
      })
    })
  })
})
