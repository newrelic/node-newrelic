/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const loggerMock = require('../mocks/logger')()

const helper = require('#testlib/agent_helper.js')
const API = proxyquire('../../../api', {
  './lib/logger': {
    child: sinon.stub().callsFake(() => loggerMock)
  }
})
const NAMES = require('#agentlib/metrics/names.js')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')

const scenarios = [
  { method: 'setApolloOperationAttributesCallback', property: 'operationCallback' },
  { method: 'setApolloResolverAttributesCallback', property: 'resolverCallback' },
]

for (const scenario of scenarios) {
  const { method, property } = scenario
  test(`${method} tests`, async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      loggerMock.warn.reset()
      const agent = helper.loadMockedAgent()
      ctx.nr.api = new API(agent)
      ctx.nr.agent = agent
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test(`should have a ${method} method`, (t, end) => {
      const { api } = t.nr
      assert.ok(api[method])
      assert.equal(typeof api[method], 'function')
      end()
    })

    await t.test('should attach callback function when a function', (t, end) => {
      const { api, agent } = t.nr
      assert.ok(!agent.customCallbacks.apollo[property])
      const expectedAttrs = { key: 'value' }
      const callback = function myTestCallback() {
        return expectedAttrs
      }
      api[method](callback)

      assert.equal(loggerMock.warn.callCount, 0, 'should not log warnings when successful')
      assert.ok(
        agent.customCallbacks.apollo[property],
        'should attach the callback on the apollo agent property'
      )

      helper.runInTransaction(agent, (tx) => {
        helper.runInSegment(agent, 'test-segment', (segment) => {
          agent.customCallbacks.apollo[property]({ test: 'value' })
          assert.equal(
            api.agent.metrics.getOrCreateMetric(`${NAMES.SUPPORTABILITY.API}/${method}`)
              .callCount,
            1,
            'should increment the API tracking metric'
          )
          const spanContext = segment.getSpanContext()
          const attrs = spanContext.customAttributes.get(DESTINATIONS.SPAN_EVENT)
          assert.deepEqual(attrs, expectedAttrs)
          end()
        })
      })
    })

    await t.test('should not attach the callback when not a function', (t, end) => {
      const { api } = t.nr
      const callback = 'test-string'
      api[method](callback)

      assert.equal(loggerMock.warn.callCount, 1, 'should log warning when failed')
      assert.ok(
        !api.agent.customCallbacks.apollo[method],
        'should not attach the callback on apollo key'
      )
      assert.equal(
        api.agent.metrics.getOrCreateMetric(`${NAMES.SUPPORTABILITY.API}/${method}`)
          .callCount,
        1,
        'should increment the API tracking metric'
      )
      end()
    })

    await t.test('should not attach the callback when async function', (t, end) => {
      const { api } = t.nr
      async function callback() {
        return await new Promise((resolve) => {
          setTimeout(() => {
            resolve()
          }, 200)
        }).then(() => { return { key: 'value' } })
      }
      api[method](callback)

      assert.equal(loggerMock.warn.callCount, 1, 'should log warning when failed')
      assert.ok(
        !api.agent.customCallbacks.apollo[property],
        'should not attach the callback when callback is async'
      )
      assert.equal(
        api.agent.metrics.getOrCreateMetric(`${NAMES.SUPPORTABILITY.API}/${method}`)
          .callCount,
        1,
        'should increment the API tracking metric'
      )
      end()
    })
  })
}
