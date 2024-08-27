/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const { assertCLMAttrs } = require('../../lib/custom-assertions')

test('Agent API - startSegment', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should name the segment as provided', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function () {
      api.startSegment('foobar', false, function () {
        const segment = api.shim.getSegment()
        assert.ok(segment)
        assert.equal(segment.name, 'foobar')

        end()
      })
    })
  })

  await t.test('should return the return value of the handler', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function () {
      const obj = {}
      const ret = api.startSegment('foobar', false, function () {
        return obj
      })

      assert.equal(ret, obj)
      end()
    })
  })

  await t.test('should not record a metric when `record` is `false`', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (tx) {
      tx.name = 'test'
      api.startSegment('foobar', false, function () {
        const segment = api.shim.getSegment()

        assert.ok(segment)
        assert.equal(segment.name, 'foobar')
      })

      tx.end()

      const hasNameMetric = Object.hasOwnProperty.call(tx.metrics.scoped, tx.name)
      assert.ok(!hasNameMetric)

      const hasCustomMetric = Object.hasOwnProperty.call(tx.metrics.unscoped, 'Custom/foobar')
      assert.ok(!hasCustomMetric)

      end()
    })
  })

  await t.test('should record a metric when `record` is `true`', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function (tx) {
      tx.name = 'test'
      api.startSegment('foobar', true, function () {
        const segment = api.shim.getSegment()

        assert.ok(segment)
        assert.equal(segment.name, 'foobar')
      })
      tx.end()

      const transactionNameMetric = tx.metrics.scoped[tx.name]
      assert.ok(transactionNameMetric)

      const transactionScopedCustomMetric = transactionNameMetric['Custom/foobar']
      assert.ok(transactionScopedCustomMetric)

      const unscopedCustomMetric = tx.metrics.unscoped['Custom/foobar']
      assert.ok(unscopedCustomMetric)

      end()
    })
  })

  await t.test('should time the segment from the callback if provided', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function () {
      api.startSegment(
        'foobar',
        false,
        function (cb) {
          const segment = api.shim.getSegment()
          setTimeout(cb, 150, null, segment)
        },
        function (err, segment) {
          assert.ok(!err)
          assert.ok(segment)

          const duration = segment.getDurationInMillis()
          const isExpectedRange = duration >= 100 && duration < 200
          assert.ok(isExpectedRange)

          end()
        }
      )
    })
  })

  await t.test('should time the segment from a returned promise', (t) => {
    const { agent, api } = t.nr
    return helper.runInTransaction(agent, function () {
      return api
        .startSegment('foobar', false, function () {
          const segment = api.shim.getSegment()
          return new Promise(function (resolve) {
            setTimeout(resolve, 150, segment)
          })
        })
        .then(function (segment) {
          assert.ok(segment)

          const duration = segment.getDurationInMillis()
          const isExpectedRange = duration >= 100 && duration < 200
          assert.ok(isExpectedRange)
        })
    })
  })

  const clmEnabled = [true, false]
  await Promise.all(
    clmEnabled.map(async (enabled) => {
      await t.test(`should ${enabled ? 'add' : 'not add'} CLM attributes to segment`, (t, end) => {
        const { agent, api } = t.nr
        agent.config.code_level_metrics.enabled = enabled
        helper.runInTransaction(agent, function () {
          api.startSegment('foobar', false, function segmentRecorder() {
            const segment = api.shim.getSegment()
            assertCLMAttrs({
              segments: [
                {
                  segment,
                  name: 'segmentRecorder',
                  filepath: 'test/unit/api/api-start-segment.test.js'
                }
              ],
              enabled
            })
            end()
          })
        })
      })
    })
  )
})
