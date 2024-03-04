/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
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

tap.test('Agent API = set Error Group callback', (t) => {
  t.autoend()
  let agent = null
  let api

  t.beforeEach(() => {
    loggerMock.warn.reset()
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: true
      }
    })
    api = new API(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should have a setErrorGroupCallback method', (t) => {
    t.ok(api.setErrorGroupCallback)
    t.equal(typeof api.setErrorGroupCallback, 'function')
    t.end()
  })

  t.test('should attach callback function when a function', (t) => {
    const callback = function myTestCallback() {
      return 'test-error-group-1'
    }
    api.setErrorGroupCallback(callback)

    t.equal(loggerMock.warn.callCount, 0, 'should not log warnings when successful')
    t.equal(
      api.agent.errors.errorGroupCallback,
      callback,
      'should attach the callback on the error collector'
    )
    t.equal(api.agent.errors.errorGroupCallback(), 'test-error-group-1')
    t.equal(
      api.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/setErrorGroupCallback')
        .callCount,
      1,
      'should increment the API tracking metric'
    )
    t.end()
  })

  t.test('should not attach the callback when not a function', (t) => {
    const callback = 'test-error-group-2'
    api.setErrorGroupCallback(callback)

    t.equal(loggerMock.warn.callCount, 1, 'should log warning when failed')
    t.notOk(
      api.agent.errors.errorGroupCallback,
      'should not attach the callback on the error collector'
    )
    t.equal(
      api.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/setErrorGroupCallback')
        .callCount,
      1,
      'should increment the API tracking metric'
    )
    t.end()
  })

  t.test('should not attach the callback when async function', (t) => {
    async function callback() {
      return await new Promise((resolve) => {
        setTimeout(() => {
          resolve()
        }, 200)
      }).then(() => 'error-group')
    }
    api.setErrorGroupCallback(callback())

    t.equal(loggerMock.warn.callCount, 1, 'should log warning when failed')
    t.notOk(
      api.agent.errors.errorGroupCallback,
      'should not attach the callback on the error collector'
    )
    t.equal(
      api.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/setErrorGroupCallback')
        .callCount,
      1,
      'should increment the API tracking metric'
    )
    t.end()
  })
})
