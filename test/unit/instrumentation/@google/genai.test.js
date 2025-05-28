/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../../lib/agent_helper')
const GenericShim = require('../../../../lib/shim/shim')
const sinon = require('sinon')

test('@google/genai unit tests', async (t) => {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    const sandbox = sinon.createSandbox()
    const agent = helper.loadMockedAgent()
    agent.config.ai_monitoring = { enabled: true, streaming: { enabled: true } }
    const shim = new GenericShim(agent, '@google/genai')
    sandbox.stub(shim.logger, 'debug')
    sandbox.stub(shim.logger, 'warn')

    ctx.nr.agent = agent
    ctx.nr.shim = shim
    ctx.nr.sandbox = sandbox
    ctx.nr.initialize = require('../../../../lib/instrumentation/@google/genai.js')
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.sandbox.restore()
  })

  function getMockModule() {
    function GoogleGenAi() {}
    GoogleGenAi.Models = function () {}
    GoogleGenAi.Models.prototype.generateContentInternal = async function () {}
    GoogleGenAi.Models.prototype.generateContentStreamInternal = async function () {}
    GoogleGenAi.Models.prototype.embedContent = async function () {}
    return GoogleGenAi
  }

  await t.test('should instrument @google/genai', (t, end) => {
    const { shim, agent, initialize } = t.nr
    const MockGoogleGenAi = getMockModule()
    initialize(agent, MockGoogleGenAi, '@google/genai', shim)
    assert.equal(shim.logger.debug.callCount, 0, 'should not log debug messages')
    const isWrapped = shim.isWrapped(MockGoogleGenAi.Models.prototype.generateContentInternal)
    const isStreamWrapped = shim.isWrapped(MockGoogleGenAi.Models.prototype.generateContentStreamInternal)
    const isEmbedWrapped = shim.isWrapped(MockGoogleGenAi.Models.prototype.embedContent)
    assert.equal(isWrapped, true, 'should wrap models generateContentInternal')
    assert.equal(isStreamWrapped, true, 'should wrap models generateContentStreamInternal')
    assert.equal(isEmbedWrapped, true, 'should wrap models embedContent')
    end()
  })

  await t.test(
    'should not instrument generate content streams if ai_monitoring.streaming.enabled is false',
    (t, end) => {
      const { shim, agent, initialize } = t.nr
      agent.config.ai_monitoring.streaming.enabled = false
      const MockGoogleGenAi = getMockModule()
      initialize(agent, MockGoogleGenAi, '@google/genai', shim)
      const models = new MockGoogleGenAi.Models()

      helper.runInTransaction(agent, async () => {
        await models.generateContentStreamInternal()
        assert.equal(
          shim.logger.warn.args[0][0],
          '`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.'
        )
        end()
      })
    }
  )

  await t.test(
    'should not register instrumentation if ai_monitoring.enabled is false',
    (t, end) => {
      const { shim, agent, initialize } = t.nr
      const MockGoogleGenAi = getMockModule()
      agent.config.ai_monitoring = { enabled: false }

      initialize(agent, MockGoogleGenAi, '@google/genai', shim)
      assert.equal(shim.logger.debug.callCount, 1, 'should log 1 debug message')
      assert.equal(shim.logger.debug.args[0][0], 'config.ai_monitoring.enabled is set to false.')
      const isWrapped = shim.isWrapped(MockGoogleGenAi.Models.prototype.generateContentInternal)
      const isStreamWrapped = shim.isWrapped(MockGoogleGenAi.Models.prototype.generateContentStreamInternal)
      const isEmbedWrapped = shim.isWrapped(MockGoogleGenAi.Models.prototype.embedContent)
      assert.equal(isWrapped, false, 'should not wrap models generateContentInternal')
      assert.equal(isStreamWrapped, false, 'should not wrap models generateContentStreamInternal')
      assert.equal(isEmbedWrapped, false, 'should not wrap models embedContent')
      end()
    }
  )
})
