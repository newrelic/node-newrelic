/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const helper = require('../../lib/agent_helper')
const NAMES = require('../../../lib/metrics/names')

tap.test('Agent API LLM methods', (t) => {
  t.autoend()
  let loggerMock
  let API

  t.before(() => {
    loggerMock = require('../mocks/logger')()
    API = proxyquire('../../../api', {
      './lib/logger': {
        child: sinon.stub().callsFake(() => loggerMock)
      }
    })
  })

  t.beforeEach((t) => {
    loggerMock.warn.reset()
    const agent = helper.loadMockedAgent()
    t.context.api = new API(agent)
  })

  t.afterEach((t) => {
    helper.unloadAgent(t.context.api.agent)
  })

  t.test('should assign llm metadata when it is an object', (t) => {
    const { api } = t.context
    const meta = { user: 'bob', env: 'prod', random: 'data' }
    api.setLlmMetadata(meta)

    t.equal(loggerMock.warn.callCount, 0, 'should not log warnings when successful')
    t.equal(
      api.agent.metrics.getOrCreateMetric(NAMES.SUPPORTABILITY.API + '/setLlmMetadata').callCount,
      1,
      'should increment the API tracking metric'
    )
    t.same(api.agent.llm.metadata, meta)
    t.end()
  })
  ;['string', 10, true, null, undefined, [1, 2, 3, 4], [{ collection: true }]].forEach((meta) => {
    t.test(`should not assign llm metadata when ${meta} is not an object`, (t) => {
      const { api } = t.context
      api.setLlmMetadata(meta)
      t.equal(loggerMock.warn.callCount, 1, 'should log warning when metadata is not an object')
      t.same(api.agent.llm, {})
      t.end()
    })
  })
})
