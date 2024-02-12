/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const helper = require('../../../lib/agent_helper')
const GenericShim = require('../../../../lib/shim/shim')
const sinon = require('sinon')

test('langchain/core/tools unit tests', (t) => {
  t.beforeEach(function (t) {
    const sandbox = sinon.createSandbox()
    const agent = helper.loadMockedAgent()
    agent.config.ai_monitoring = { enabled: true }
    agent.config.feature_flag = { langchain_instrumentation: true }
    const shim = new GenericShim(agent, 'langchain')
    shim.pkgVersion = '0.1.26'
    sandbox.stub(shim.logger, 'debug')
    sandbox.stub(shim.logger, 'warn')

    t.context.agent = agent
    t.context.shim = shim
    t.context.sandbox = sandbox
    t.context.initialize = require('../../../../lib/instrumentation/langchain/tools')
  })

  t.afterEach(function (t) {
    helper.unloadAgent(t.context.agent)
    t.context.sandbox.restore()
  })

  function getMockModule() {
    function StructuredTool() {}
    StructuredTool.prototype.call = async function call() {}
    StructuredTool.prototype._call = async function _call() {}
    return { StructuredTool }
  }

  ;[
    { aiMonitoring: false, langChain: true },
    { aiMonitoring: true, langChain: false },
    { aiMonitoring: false, langChain: false }
  ].forEach(({ aiMonitoring, langChain }) => {
    t.test(
      `should not register instrumentation if ai_monitoring is ${aiMonitoring} and langchain_instrumentation is ${langChain}`,
      (t) => {
        const { shim, agent, initialize } = t.context
        const MockTool = getMockModule()
        agent.config.ai_monitoring.enabled = aiMonitoring
        agent.config.feature_flag.langchain_instrumentation = langChain

        initialize(shim, MockTool)
        t.equal(shim.logger.debug.callCount, 1, 'should log 1 debug messages')
        t.equal(
          shim.logger.debug.args[0][0],
          'langchain instrumentation is disabled.  To enable set `config.ai_monitoring.enabled` to true'
        )
        const isWrapped = shim.isWrapped(MockTool.StructuredTool.prototype.call)
        t.equal(isWrapped, false, 'should not wrap tool create')
        t.end()
      }
    )
  })

  t.test('should only wrap _call once', async (t) => {
    const { shim, initialize } = t.context
    const MockTool = getMockModule()
    initialize(shim, MockTool)
    const tool = new MockTool.StructuredTool()
    let wrapped = shim.isWrapped(tool._call)
    t.notOk(wrapped, 'should not wrap _call until call is invoked')
    await tool.call()
    wrapped = shim.isWrapped(tool._call)
    t.ok(wrapped, '_call is wrapped since call was invoked')
    await tool.call()
    t.equal(tool._call.name, 'wrappedCall', '_call name should be named wrappedCall')
    const unwrapped = shim.unwrap(tool._call)
    t.equal(unwrapped.name, '_call', 'unwrapped _call should have a name of _call')
  })
  t.end()
})
