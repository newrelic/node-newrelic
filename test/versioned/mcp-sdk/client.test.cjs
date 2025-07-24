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
  ctx.nr.agent = helper.instrumentMockedAgent({})

  const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')

  ctx.nr.transport = new StdioClientTransport({
    command: 'node',
    args: ['mock-server.cjs']
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

test('should create span for callTool', (t, end) => {
  const { agent, client } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    let result
    try {
      result = await client.callTool({
        name: 'echo',
        arguments: {
          message: 'example message'
        }
      })
    } catch (e) {
      assert.fail(`Tool call failed: ${e.message}`)
    }

    assert.ok(result, 'should return a result from the tool call')

    const name = `${MCP.TOOL}/callTool/echo`
    assertSegments(tx.trace, tx.trace.root, [name], { exact: false })

    tx.end()
    assertSpanKind({
      agent,
      segments: [
        { name, kind: 'internal' }
      ]
    })
    end()
  })
})

test('should create span for readResource', (t, end) => {
  const { agent, client } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    let resource
    try {
      resource = await client.readResource({
        uri: 'echo://hello-world',
      })
    } catch (e) {
      assert.fail(`readResource failed: ${e.message}`)
    }

    assert.ok(resource, 'should return a resource from readResource')

    const name = `${MCP.RESOURCE}/readResource/echo://hello-world`
    assertSegments(tx.trace, tx.trace.root, [name], { exact: false })

    tx.end()
    assertSpanKind({
      agent,
      segments: [
        { name, kind: 'internal' }
      ]
    })
    end()
  })
})

test('should create span for getPrompt', (t, end) => {
  const { agent, client } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    let prompt
    try {
      prompt = await client.getPrompt({
        name: 'echo',
        arguments: {
          message: 'example message'
        }
      })
    } catch (e) {
      assert.fail(`getPrompt failed: ${e.message}`)
    }

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
    end()
  })
})
