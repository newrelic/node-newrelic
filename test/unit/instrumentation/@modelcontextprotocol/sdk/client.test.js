/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const GenericShim = require('#agentlib/shim/shim.js')
const sinon = require('sinon')

test('@modelcontextprotocol/sdk/client unit tests', async (t) => {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    const sandbox = sinon.createSandbox()
    const agent = helper.loadMockedAgent()
    agent.config.ai_monitoring = { enabled: true, streaming: { enabled: true } }
    const shim = new GenericShim(agent, '@modelcontextprotocol/sdk/client')
    sandbox.stub(shim.logger, 'debug')
    sandbox.stub(shim.logger, 'warn')

    ctx.nr.agent = agent
    ctx.nr.shim = shim
    ctx.nr.sandbox = sandbox
    ctx.nr.initialize = require('#agentlib/instrumentation/@modelcontextprotocol/sdk/client.js')
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.sandbox.restore()
  })

  function getMockModule() {
    const MCP_SDK = function () {}
    MCP_SDK.Client = function () {}
    MCP_SDK.Client.prototype.callTool = async function () {}
    MCP_SDK.Client.prototype.readResource = async function () {}
    MCP_SDK.Client.prototype.getPrompt = async function () {}
    return MCP_SDK
  }

  await t.test('should instrument @modelcontextprotocol/sdk/client/index.js', (t, end) => {
    const { shim, initialize } = t.nr
    const MockMCP = getMockModule()
    initialize(shim, MockMCP, '@modelcontextprotocol/sdk/client/index.js')
    assert.equal(shim.logger.debug.callCount, 0, 'should not log debug messages')
    const isToolWrapped = shim.isWrapped(MockMCP.Client.prototype.callTool)
    const isResourceWrapped = shim.isWrapped(MockMCP.Client.prototype.readResource)
    const isPromptWrapped = shim.isWrapped(MockMCP.Client.prototype.getPrompt)
    assert.equal(isToolWrapped, true, 'should wrap models callTool')
    assert.equal(isResourceWrapped, true, 'should wrap models readResource')
    assert.equal(isPromptWrapped, true, 'should wrap models getPrompt')
    end()
  })
})
