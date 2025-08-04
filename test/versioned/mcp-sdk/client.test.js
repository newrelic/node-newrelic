/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const { assertSegments, assertSpanKind } = require('../../lib/custom-assertions')

const {
  MCP
} = require('../../../lib/metrics/names')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    ai_monitoring: {
      enabled: ctx.name.includes('disabled') ? false : true
    }
  })

  const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')

  ctx.nr.transport = new StdioClientTransport({
    command: 'node',
    args: ['mock-server.js']
  })
  ctx.nr.client = new Client(
    {
      name: 'test-client',
      version: '1.0.0'
    }
  )
  await ctx.nr.client.connect(ctx.nr.transport)
})

test.afterEach(async (ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['@modelcontextprotocol/sdk/client/index.js', '@modelcontextprotocol/sdk/client/stdio.js'])
})

test('should create span for callTool', async (t) => {
  const { agent, client } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const result = await client.callTool({
      name: 'echo',
      arguments: {
        message: 'example message'
      }
    })

    assert.ok(result, 'should return a result from the tool call')

    const name = `${MCP.TOOL}/callTool/echo`
    assert.equal(tx.trace.transaction.numSegments, 3, 'should have 3 segments')
    assertSegments(tx.trace, tx.trace.root, [name], { exact: false })

    tx.end()
    assertSpanKind({
      agent,
      segments: [
        { name, kind: 'internal' }
      ]
    })
  })
})

test('should create span for readResource', async (t) => {
  const { agent, client } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const resource = await client.readResource({
      uri: 'echo://hello-world',
    })

    assert.ok(resource, 'should return a resource from readResource')

    const name = `${MCP.RESOURCE}/readResource/echo`
    assertSegments(tx.trace, tx.trace.root, [name], { exact: false })

    tx.end()
    assertSpanKind({
      agent,
      segments: [
        { name, kind: 'internal' }
      ]
    })
  })
})

test('should create span for getPrompt', async (t) => {
  const { agent, client } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const prompt = await client.getPrompt({
      name: 'echo',
      arguments: {
        message: 'example message'
      }
    })

    assert.ok(prompt, 'should return a prompt from getPrompt')

    const name = `${MCP.PROMPT}/getPrompt/echo`
    assertSegments(tx.trace, tx.trace.root, [name], { exact: false })

    tx.end()
    assertSpanKind({
      agent,
      segments: [
        { name, kind: 'internal' }
      ]
    })
  })
})

test('should not instrument if ai_monitoring is disabled', async (t) => {
  const { agent, client } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    const result = await client.callTool({
      name: 'echo',
      arguments: {
        message: 'example message'
      }
    })

    assert.ok(result, 'should still return a result from the tool call')

    assert.equal(tx.trace.transaction.numSegments, 2, 'should not create MCP segment')

    tx.end()
  })
})
