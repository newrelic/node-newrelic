/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const { assertMetrics, assertSegments, assertSpanKind } = require('../../lib/custom-assertions')
const semver = require('semver')
const { readFile } = require('node:fs/promises')
const path = require('node:path')

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
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js')
  const pkg = await readFile(path.join(__dirname, '/node_modules/@modelcontextprotocol/sdk/package.json'))
  const { version: pkgVersion } = JSON.parse(pkg.toString())
  ctx.nr.pkgVersion = pkgVersion

  // Set up server
  const McpTestServer = require('./streaming-server')
  ctx.nr.mcpServer = new McpTestServer()
  await ctx.nr.mcpServer.start()

  // Set up client
  ctx.nr.transport = new StreamableHTTPClientTransport(
    new URL('http://localhost:3000/mcp')
  )
  ctx.nr.client = new Client(
    {
      name: 'test-client',
      version: '1.0.0'
    }
  )
  await ctx.nr.client.connect(ctx.nr.transport)
})

test.afterEach(async (ctx) => {
  await ctx.nr.mcpServer.stop()
  helper.unloadAgent(ctx.nr.agent)
  removeModules([
    '@modelcontextprotocol/sdk/client/index.js',
    '@modelcontextprotocol/sdk/client/streamableHttp.js',
    './streaming-server.js'
  ])
})

test('should create span for callTool', (t, end) => {
  const { agent, client, pkgVersion } = t.nr
  helper.runInTransaction(agent, async (tx) => {
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
    const agentMetrics = agent.metrics
    const expectedPkgMetrics = [
      [{ name: 'Supportability/Features/Instrumentation/OnRequire/@modelcontextprotocol/sdk' }],
      [{ name: `Supportability/Features/Instrumentation/OnRequire/@modelcontextprotocol/sdk/Version/${semver.major(pkgVersion)}` }]
    ]
    assertMetrics(agentMetrics, expectedPkgMetrics, false, false)

    end()
  })
})

test('should create span for readResource', (t, end) => {
  const { agent, client, pkgVersion } = t.nr
  helper.runInTransaction(agent, async (tx) => {
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

    const agentMetrics = agent.metrics
    const expectedPkgMetrics = [
      [{ name: 'Supportability/Features/Instrumentation/OnRequire/@modelcontextprotocol/sdk' }],
      [{ name: `Supportability/Features/Instrumentation/OnRequire/@modelcontextprotocol/sdk/Version/${semver.major(pkgVersion)}` }]
    ]
    assertMetrics(agentMetrics, expectedPkgMetrics, false, false)

    end()
  })
})

test('should create span for getPrompt', (t, end) => {
  const { agent, client, pkgVersion } = t.nr
  helper.runInTransaction(agent, async (tx) => {
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

    const agentMetrics = agent.metrics
    const expectedPkgMetrics = [
      [{ name: 'Supportability/Features/Instrumentation/OnRequire/@modelcontextprotocol/sdk' }],
      [{ name: `Supportability/Features/Instrumentation/OnRequire/@modelcontextprotocol/sdk/Version/${semver.major(pkgVersion)}` }]
    ]
    assertMetrics(agentMetrics, expectedPkgMetrics, false, false)

    end()
  })
})

test('should not instrument if ai_monitoring is disabled', (t, end) => {
  const { agent, client } = t.nr

  helper.runInTransaction(agent, async (tx) => {
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
    end()
  })
})
