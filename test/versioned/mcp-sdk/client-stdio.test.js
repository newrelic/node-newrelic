/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const { assertPackageMetrics, assertSegments, assertSpanKind } = require('../../lib/custom-assertions')
const {
  MCP
} = require('../../../lib/metrics/names')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

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
    args: [path.join(__dirname, 'stdio-server.js')]
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
  await ctx.nr.client.close()
  await ctx.nr.transport.close()
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['@modelcontextprotocol/sdk/client/index.js', '@modelcontextprotocol/sdk/client/stdio.js'])
})

test('should log tracking metrics', function(t, end) {
  t.plan(5)
  const { agent, client } = t.nr
  const pkgVersion = helper.readPackageVersion(__dirname, '@modelcontextprotocol/sdk')
  helper.runInTransaction(agent, async () => {
    await client.callTool({
      name: 'echo',
      arguments: { message: 'example message' }
    })
    assertPackageMetrics(
      { agent, pkg: '@modelcontextprotocol/sdk', version: pkgVersion, subscriberType: true },
      { assert: t.assert }
    )
    end()
  })
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

    const name = `${MCP.TOOL}/callTool/echo`
    const root = tx?.trace?.segments?.root
    assert.ok(root)
    function assertNoMcpSegment(node) {
      assert.notEqual(node?.segment?.name, name, 'should not create MCP segment')
      for (const child of node?.children) {
        assertNoMcpSegment(child)
      }
    }
    assertNoMcpSegment(root)

    tx.end()
  })
})

test('should add subcomponent attribute to segment', async (t) => {
  t.plan(3)
  const { agent, client } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    await client.callTool({
      name: 'echo',
      arguments: {
        message: 'example message'
      }
    })

    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    const attributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
    t.assert.ok(attributes.subcomponent, 'subcomponent attribute should exist')

    const attr = JSON.parse(attributes.subcomponent)
    t.assert.equal(attr.type, 'APM-AI_TOOL', 'subcomponent type should be APM-AI_TOOL')
    t.assert.equal(attr.name, 'echo', 'subcomponent name should match tool name')

    tx.end()
  })
})

test('should not add subcomponent attribute for non-callTool operations', async (t) => {
  t.plan(1)
  const { agent, client } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    await client.getPrompt({
      name: 'echo',
      arguments: {
        message: 'example message'
      }
    })

    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    const attributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
    t.assert.equal(attributes.subcomponent, undefined, 'subcomponent attribute should not exist for getPrompt')

    tx.end()
  })
})

test('should not add subcomponent attribute for readResource operations', async (t) => {
  t.plan(1)
  const { agent, client } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    await client.readResource({
      uri: 'echo://hello-world'
    })

    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    const attributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
    t.assert.equal(attributes.subcomponent, undefined, 'subcomponent attribute should not exist for readResource')

    tx.end()
  })
})
