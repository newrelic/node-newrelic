/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { assertSegments, match } = require('../../lib/custom-assertions')
const createOpenAIMockServer = require('../openai/mock-server')
const helper = require('../../lib/agent_helper')

const config = {
  ai_monitoring: {
    enabled: true,
    streaming: {
      enabled: true
    }
  }
}

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { host, port, server } = await createOpenAIMockServer()
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent(config)

  const { createReactAgent } = require('@langchain/langgraph/prebuilt')
  const { ChatOpenAI } = require('@langchain/openai')

  // Create LLM using mock server
  const mockLLM = new ChatOpenAI({
    modelName: 'gpt-4',
    temperature: 0,
    apiKey: 'fake-key',
    maxRetries: 0,
    configuration: {
      baseURL: `http://${host}:${port}`
    }
  })

  // Create a simple LangGraph agent.
  // Ignore the deprecation warning; LangGraph just wants
  // us to require from "langgraph" directly, but
  // the function works the same.
  ctx.nr.langgraphAgent = createReactAgent({
    llm: mockLLM,
    // must define tools even if empty
    tools: [],
    name: 'LangGraphReactAgent'
  })
})

test.afterEach((ctx) => {
  ctx.nr?.server?.close()
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['@langchain/langgraph', '@langchain/core', '@langchain/openai'])
})

test('should log tracking metrics', function(t, end) {
  const { agent, langgraphAgent } = t.nr
  const { version } = require('@langchain/langgraph/package.json')
  const { assertPackageMetrics } = require('../../lib/custom-assertions')

  helper.runInTransaction(agent, async () => {
    await langgraphAgent.invoke(
      { messages: [{ role: 'user', content: 'You are a scientist.' }] }
    )
    assertPackageMetrics({
      agent,
      pkg: '@langchain/langgraph',
      version,
      subscriberType: true
    }, { assert: t.assert })
    end()
  })
})

test('should create span on successful CompiledStateGraph.invoke', async (t) => {
  const { agent, langgraphAgent } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    const result = await langgraphAgent.invoke(
      { messages: [{ role: 'user', content: 'You are a scientist.' }] }
    )
    const content = result?.messages?.[1]?.content
    assert.equal(content, '212 degrees Fahrenheit is equal to 100 degrees Celsius.', 'should output correct content')
    assertSegments(tx.trace, tx.trace.root, ['Llm/agent/LangGraph/stream/LangGraphReactAgent'], {
      exact: false
    })

    tx.end()
  })
})

test('should create LlmAgent event for CompiledStateGraph.invoke', async (t) => {
  const { agent, langgraphAgent } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    const result = await langgraphAgent.invoke(
      { messages: [{ role: 'user', content: 'You are a scientist.' }] }
    )
    const content = result?.messages?.[1]?.content
    assert.ok(content)
    // Check for LlmAgent event
    const events = agent.customEventAggregator.events.toArray()
    const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
    assert.ok(agentEvents.length > 0)

    const [[{ type }, agentEvent]] = agentEvents
    assert.equal(type, 'LlmAgent')
    const [segment] = tx.trace.getChildren(tx.trace.root.id)

    match(agentEvent, {
      id: /[a-f0-9]{32}/,
      name: 'LangGraphReactAgent',
      span_id: segment.id,
      trace_id: tx.traceId,
      ingest_source: 'Node',
      vendor: 'langgraph'
    })

    tx.end()
  })
})

test('should not create segment or events when ai_monitoring.enabled is false', async (t) => {
  const { agent, langgraphAgent } = t.nr

  // Disable ai_monitoring
  agent.config.ai_monitoring.enabled = false

  await helper.runInTransaction(agent, async (tx) => {
    try {
      await langgraphAgent.invoke(
        { messages: [{ role: 'user', content: 'You are a scientist.' }] }
      )
    } catch (err) {
      assert.fail(err)
    }

    // Should not create LangGraph segment
    const segments = tx.trace.getChildren(tx.trace.root.id)
    const langgraphSegments = segments.filter((s) => s.name.includes('Llm/agent/LangGraph'))
    assert.equal(langgraphSegments.length, 0, 'should not create LangGraph segments')

    // Should not create LlmAgent events
    const events = agent.customEventAggregator.events.toArray()
    const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
    assert.equal(agentEvents.length, 0, 'should not create LlmAgent events')

    tx.end()
  })
})
