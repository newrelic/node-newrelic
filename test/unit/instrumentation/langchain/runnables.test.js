/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const helper = require('../../../lib/agent_helper')
const GenericShim = require('../../../../lib/shim/shim')
const sinon = require('sinon')

test('langchain/core/runnables unit tests', (t) => {
  t.beforeEach(function (t) {
    const sandbox = sinon.createSandbox()
    const agent = helper.loadMockedAgent()
    agent.config.ai_monitoring = { enabled: true }
    const shim = new GenericShim(agent, 'langchain')
    shim.pkgVersion = '0.1.26'
    sandbox.stub(shim.logger, 'debug')
    sandbox.stub(shim.logger, 'warn')

    t.context.agent = agent
    t.context.shim = shim
    t.context.sandbox = sandbox
    t.context.initialize = require('../../../../lib/instrumentation/langchain/runnable')
  })

  t.afterEach(function (t) {
    helper.unloadAgent(t.context.agent)
    t.context.sandbox.restore()
  })

  function getMockModule() {
    function RunnableSequence() {}
    RunnableSequence.prototype.invoke = async function call() {}
    return { RunnableSequence }
  }

  t.test('should not register instrumentation if ai_monitoring is false', (t) => {
    const { shim, agent, initialize } = t.context
    const MockRunnable = getMockModule()
    agent.config.ai_monitoring.enabled = false

    initialize(shim, MockRunnable)
    t.equal(shim.logger.debug.callCount, 1, 'should log 1 debug messages')
    t.equal(
      shim.logger.debug.args[0][0],
      'langchain instrumentation is disabled.  To enable set `config.ai_monitoring.enabled` to true'
    )
    const isWrapped = shim.isWrapped(MockRunnable.RunnableSequence.prototype.invoke)
    t.equal(isWrapped, false, 'should not wrap runnable invoke')
    t.end()
  })

  t.end()
})
