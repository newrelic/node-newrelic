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

const helper = require('../../lib/agent_helper')
const API = proxyquire('../../../api', {
  './lib/logger': {
    child: sinon.stub().callsFake(() => loggerMock)
  }
})
const NAMES = require('../../../lib/metrics/names')

test('Agent API = set Error Group callback', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    loggerMock.warn.reset()
    const agent = helper.loadMockedAgent({
      attributes: {
        enabled: true
      }
    })
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should have a setErrorGroupCallback method', (t, end) => {
    const { api } = t.nr
    assert.ok(api.setErrorGroupCallback)
    assert.equal(typeof api.setErrorGroupCallback, 'function')
    end()
  })

  await t.test('should attach callback function when a function', (t, end) => {
    const { api } = t.nr
    const callback = function myTestCallback() {
      return 'test-error-group-1'
    }
    api.setErrorGroupCallback(callback)

    assert.equal(loggerMock.warn.callCount, 0, 'should not log warnings when successful')
    assert.equal(
      api.agent.errors.errorGroupCallback,
      callback,
      'should attach the callback on the error collector'
    )
    assert.equal(api.agent.errors.errorGroupCallback(), 'test-error-group-1')
    assert.equal(
      api.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/setErrorGroupCallback')
        .callCount,
      1,
      'should increment the API tracking metric'
    )
    end()
  })

  await t.test('should not attach the callback when not a function', (t, end) => {
    const { api } = t.nr
    const callback = 'test-error-group-2'
    api.setErrorGroupCallback(callback)

    assert.equal(loggerMock.warn.callCount, 1, 'should log warning when failed')
    assert.ok(
      !api.agent.errors.errorGroupCallback,
      'should not attach the callback on the error collector'
    )
    assert.equal(
      api.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/setErrorGroupCallback')
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
      }).then(() => 'error-group')
    }
    api.setErrorGroupCallback(callback())

    assert.equal(loggerMock.warn.callCount, 1, 'should log warning when failed')
    assert.ok(
      !api.agent.errors.errorGroupCallback,
      'should not attach the callback on the error collector'
    )
    assert.equal(
      api.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/setErrorGroupCallback')
        .callCount,
      1,
      'should increment the API tracking metric'
    )
    end()
  })
})
