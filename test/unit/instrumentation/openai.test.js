/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const helper = require('../../lib/agent_helper')
const GenericShim = require('../../../lib/shim/shim')
const sinon = require('sinon')

test('openai unit tests', (t) => {
  t.autoend()

  t.beforeEach(function (t) {
    const sandbox = sinon.createSandbox()
    const agent = helper.loadMockedAgent()
    agent.config.feature_flag = { openai_instrumentation: true }
    const shim = new GenericShim(agent, 'openai')
    sandbox.stub(shim, 'require')
    shim.require.returns({ version: '4.0.0' })
    sandbox.stub(shim.logger, 'debug')

    t.context.agent = agent
    t.context.shim = shim
    t.context.sandbox = sandbox
    t.context.initialize = require('../../../lib/instrumentation/openai')
  })

  t.afterEach(function (t) {
    helper.unloadAgent(t.context.agent)
    t.context.sandbox.restore()
  })

  function getMockModule() {
    function Completions() {}
    Completions.prototype.create = function () {}
    function OpenAI() {}
    OpenAI.prototype.makeRequest = function () {}
    OpenAI.Chat = { Completions }
    OpenAI.Embeddings = function () {}
    OpenAI.Embeddings.prototype.create = function () {}
    return OpenAI
  }

  t.test('should instrument openapi if >= 4.0.0', (t) => {
    const { shim, agent, initialize } = t.context
    const MockOpenAi = getMockModule()
    initialize(agent, MockOpenAi, 'openai', shim)
    t.equal(shim.logger.debug.callCount, 0, 'should not log debug messages')
    const isWrapped = shim.isWrapped(MockOpenAi.Chat.Completions.prototype.create)
    t.equal(isWrapped, true, 'should wrap chat completions create')
    t.end()
  })

  t.test('should not register instrumentation if openai is < 4.0.0', (t) => {
    const { shim, agent, initialize } = t.context
    const MockOpenAi = getMockModule()
    shim.require.returns({ version: '3.7.0' })
    initialize(agent, MockOpenAi, 'openai', shim)
    t.equal(shim.logger.debug.callCount, 1, 'should log 2 debug messages')
    t.equal(
      shim.logger.debug.args[0][0],
      'openai instrumentation support is for versions >=4.0.0. Skipping instrumentation.'
    )
    const isWrapped = shim.isWrapped(MockOpenAi.Chat.Completions.prototype.create)
    t.equal(isWrapped, false, 'should not wrap chat completions create')
    t.end()
  })

  t.test(
    'should not register instrumentation if feature_flag.openai_instrumentation is false',
    (t) => {
      const { shim, agent, initialize } = t.context
      const MockOpenAi = getMockModule()
      agent.config.feature_flag = { openai_instrumentation: false }

      initialize(agent, MockOpenAi, 'openai', shim)
      t.equal(shim.logger.debug.callCount, 2, 'should log 2 debug messages')
      t.equal(
        shim.logger.debug.args[0][0],
        'config.feature_flag.openai_instrumentation is disabled.'
      )
      t.equal(
        shim.logger.debug.args[1][0],
        'openai instrumentation support is for versions >=4.0.0. Skipping instrumentation.'
      )
      const isWrapped = shim.isWrapped(MockOpenAi.Chat.Completions.prototype.create)
      t.equal(isWrapped, false, 'should not wrap chat completions create')
      t.end()
    }
  )
})
