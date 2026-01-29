/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { tspl } = require('@matteo.collina/tspl')

const { removeModules } = require('../../lib/cache-buster')
const { assertSegments, match } = require('../../lib/custom-assertions')
const createOpenAIMockServer = require('../openai/mock-server')
const helper = require('../../lib/agent_helper')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

const config = {
  ai_monitoring: {
    enabled: true,
    streaming: {
      enabled: true
    }
  }
}

function consumeChunk(chunk) {
  // intentional no-op
  return chunk
}

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { host, port, server } = await createOpenAIMockServer()
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent(config)

  const { createReactAgent } = require('@langchain/langgraph/prebuilt')
  const { ChatOpenAI } = require('@langchain/openai')
  const { tool } = require('@langchain/core/tools')
  const { z } = require('zod')

  // Create a simple calculator tool
  const calculatorTool = tool(
    async ({ a, b, operation }) => {
      if (operation === 'add') {
        return `${a + b}`
      }
      return 'Unknown operation'
    },
    {
      name: 'calculator',
      description: 'Performs basic arithmetic operations',
      schema: z.object({
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
        operation: z.string().describe('Operation to perform')
      })
    }
  )

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
  // Ignore the deprecation warning; LangGraph just
  // wants us to require from "langchain" directly,
  // but the function is still valid.
  ctx.nr.langgraphAgent = createReactAgent({
    llm: mockLLM,
    // must define tools even if empty
    tools: [],
    name: 'LangGraphReactAgent'
  })

  // Create agent with tools for tool call test
  ctx.nr.langgraphAgentWithTools = createReactAgent({
    llm: mockLLM,
    tools: [calculatorTool],
    name: 'LangGraphReactAgent'
  })

  const { version } = require('@langchain/langgraph/package.json')
  ctx.nr.langgraphVersion = version
})

test.afterEach((ctx) => {
  ctx.nr?.server?.close()
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['@langchain/langgraph', '@langchain/core', '@langchain/openai'])
})

test('should log tracking metrics', function(t, end) {
  const { agent, langgraphAgent, langgraphVersion } = t.nr
  const { assertPackageMetrics } = require('../../lib/custom-assertions')

  helper.runInTransaction(agent, async () => {
    await langgraphAgent.stream(
      { messages: [{ role: 'user', content: 'You are a scientist.' }] }
    )
    assertPackageMetrics({
      agent,
      pkg: '@langchain/langgraph',
      version: langgraphVersion,
      subscriberType: true
    }, { assert: t.assert })
    end()
  })
})

test('should create span on successful CompiledStateGraph.stream', async (t) => {
  const { agent, langgraphAgent } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    let content = ''
    try {
      const stream = await langgraphAgent.stream(
        { messages: [{ role: 'user', content: 'You are a scientist.' }] }
      )
      for await (const chunk of stream) {
        content += chunk?.agent?.messages?.[0]?.content ?? ''
      }
    } catch (err) {
      assert.fail(err)
    }
    assert.equal(content, '212 degrees Fahrenheit is equal to 100 degrees Celsius.', 'should output correct content')
    assertSegments(tx.trace, tx.trace.root, ['Llm/agent/LangGraph/stream/LangGraphReactAgent'], {
      exact: false
    })

    tx.end()
  })
})

test('should create LlmAgent event for CompiledStateGraph.stream', async (t) => {
  const { agent, langgraphAgent } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    const stream = await langgraphAgent.stream(
      { messages: [{ role: 'user', content: 'You are a scientist.' }] }
    )
    for await (const chunk of stream) {
      consumeChunk(chunk)
    }

    // Check for LlmAgent event
    const events = agent.customEventAggregator.events.toArray()
    const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
    assert.ok(agentEvents.length > 0)

    const [[{ type }, agentEvent]] = agentEvents
    assert.equal(type, 'LlmAgent')
    const [segment] = tx.trace.getChildren(tx.trace.root.id)

    match(agentEvent, {
      id: /[a-f0-9]{36}/,
      name: 'LangGraphReactAgent',
      span_id: segment.id,
      trace_id: tx.traceId,
      ingest_source: 'Node',
      vendor: 'langgraph'
    })

    tx.end()
  })
})

test('should record LLM custom events with attributes', async(t) => {
  const { agent, langgraphAgent } = t.nr
  const api = helper.getAgentApi()

  await helper.runInTransaction(agent, async (tx) => {
    await api.withLlmCustomAttributes({ 'llm.foo': 'bar' }, async () => {
      const stream = await langgraphAgent.stream(
        { messages: [{ role: 'user', content: 'You are a scientist.' }] }
      )
      for await (const chunk of stream) {
        consumeChunk(chunk)
      }
    })

    const events = agent.customEventAggregator.events.toArray()
    const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
    assert.ok(agentEvents.length > 0)

    const [[{ type }, agentEvent]] = agentEvents
    assert.equal(type, 'LlmAgent')
    assert.equal(agentEvent?.['llm.foo'], 'bar')

    tx.end()
  })
})

test('should have LlmChatCompletion events from LangChain and OpenAI instrumentation', async(t) => {
  const { agent, langgraphAgent } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    const stream = await langgraphAgent.stream(
      { messages: [{ role: 'user', content: 'You are a scientist.' }] }
    )
    for await (const chunk of stream) {
      consumeChunk(chunk)
    }

    // Check for LlmChatCompletion events
    const events = agent.customEventAggregator.events.toArray()
    const allChatEvents = events.filter((e) => e[0].type.includes('LlmChatCompletion'))
    const langchainChatEvents = allChatEvents.filter((e) => e[1].vendor === 'langchain')
    const openaiChatEvents = allChatEvents.filter((e) => e[1].vendor === 'openai')

    // we won't assert specifics, just make sure they still exist
    assert.equal(openaiChatEvents.length, 3, 'should be 2 messages and 1 summary from OpenAI')

    // There are 12 langchain events because chat events are created
    // for each call of `RunnableSequence` invoke (called 3 times)
    // and stream (called once)
    assert.equal(langchainChatEvents.length, 12)

    // Make sure content was properly assigned
    const messageEvents = langchainChatEvents.filter((e) => e[0].type === 'LlmChatCompletionMessage')
    messageEvents.forEach((e) => {
      assert.ok(e[1]?.content?.length > 0, 'message content should exist')
    })

    tx.end()
  })
})

test('should have LlmTool events from LangChain instrumentation', async (t) => {
  const { agent, langgraphAgentWithTools } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    const stream = await langgraphAgentWithTools.stream(
      { messages: [{ role: 'user', content: 'What is 2 + 2?' }] }
    )
    for await (const chunk of stream) {
      consumeChunk(chunk)
    }

    // Check for LlmTool event
    const events = agent.customEventAggregator.events.toArray()
    const toolEvents = events.filter((e) => e[0].type === 'LlmTool')
    assert.equal(toolEvents.length, 1, 'should have exactly 1 tool event')

    const [[{ type }, toolEvent]] = toolEvents
    assert.equal(type, 'LlmTool')
    assert.equal(toolEvent.name, 'calculator', 'tool name should be calculator')
    assert.equal(toolEvent.vendor, 'langchain', 'vendor should be langchain')
    assert.equal(toolEvent.output, '4', 'tool output should be 4')

    // Should have 2 LlmChatCompletionMessages with role='tool'
    const chatEvents = events.filter((e) => e[0].type === 'LlmChatCompletionMessage' && e[1].role === 'tool')
    assert.equal(chatEvents.length, 2, 'should have one tool message for openai and another for langchain')

    tx.end()
  })
})

test('should add llm attribute to transaction', async (t) => {
  const { agent, langgraphAgent } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    const stream = await langgraphAgent.stream(
      { messages: [{ role: 'user', content: 'You are a scientist.' }] }
    )
    for await (const chunk of stream) {
      consumeChunk(chunk)
    }

    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true)

    tx.end()
  })
})

test('should add subcomponent attribute to span', async (t) => {
  const { agent, langgraphAgent } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    const stream = await langgraphAgent.stream(
      { messages: [{ role: 'user', content: 'You are a scientist.' }] }
    )
    for await (const chunk of stream) {
      consumeChunk(chunk)
    }

    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    const attribute = segment?.attributes?.attributes?.subcomponent
    assert.equal(attribute?.value, '{"type": "APM-AI_AGENT", "name": LangGraphReactAgent}')

    tx.end()
  })
})

test('should create LlmError event when given bad input', async (t) => {
  const { agent, langgraphAgent } = t.nr
  const plan = tspl(t, { plan: 8 })

  await helper.runInTransaction(agent, async (tx) => {
    try {
      const stream = await langgraphAgent.stream(
        { messages: [{ role: 'bad-role', content: 'Invalid role.' }] }
      )
      for await (const chunk of stream) {
        consumeChunk(chunk)
      }
    } catch (error) {
      plan.ok(error, 'should catch an error')
    }

    // Check for LlmAgent event with error flag
    const events = agent.customEventAggregator.events.toArray()
    const agentEvent = events.find((e) => e[0].type === 'LlmAgent')?.[1]
    plan.ok(agentEvent, 'should have LlmAgent event')
    plan.equal(agentEvent.error, true, 'should set LlmAgent event `error` to true')

    // Check for LlmError in transaction exceptions.
    // 2 will be created, first one for LangChain RunnableSequence.stream
    // failure, second one for LangGraph agent failure
    const exceptions = tx.exceptions
    plan.equal(exceptions.length, 2)
    const lgException = exceptions[1]
    const str = Object.prototype.toString.call(lgException.customAttributes)
    plan.equal(str, '[object LlmErrorMessage]', 'should be a LlmErrorMessage')
    plan.equal(lgException.customAttributes.agent_id, agentEvent.id, 'ai agent_id should match')
    plan.equal(lgException.customAttributes['error.code'], lgException.error['lc_error_code'], 'error codes should match')
    plan.equal(lgException.customAttributes['error.message'], lgException.error['message'], 'error messages should match')

    tx.end()
    await plan.completed
  })
})

test('should create LlmError event when stream fails in the middle', async (t) => {
  const { agent, langgraphAgent } = t.nr
  const plan = tspl(t, { plan: 8 })

  await helper.runInTransaction(agent, async (tx) => {
    try {
      // Starts off with a valid request...
      const stream = await langgraphAgent.stream(
        { messages: [{ role: 'user', content: 'You are a scientist.' }] }
      )
      for await (const chunk of stream) {
        consumeChunk(chunk)
        // then abruptly abort the stream
        stream.cancel('abort')
      }
    } catch (error) {
      plan.ok(error, 'should catch an error')
    }

    // Check for LlmAgent event with error flag
    const events = agent.customEventAggregator.events.toArray()
    const agentEvent = events.find((e) => e[0].type === 'LlmAgent')?.[1]
    plan.ok(agentEvent, 'should have LlmAgent event')
    plan.equal(agentEvent.error, true, 'should set LlmAgent event `error` to true')

    // Check for LlmError in transaction exceptions.
    // 2 will be created, first one for LangChain RunnableSequence.stream
    // failure, second one for LangGraph agent failure
    const exceptions = tx.exceptions
    plan.equal(exceptions.length, 2)
    const lgException = exceptions[1]
    const str = Object.prototype.toString.call(lgException.customAttributes)
    plan.equal(str, '[object LlmErrorMessage]', 'should be a LlmErrorMessage')
    plan.equal(lgException.customAttributes.agent_id, agentEvent.id, 'ai agent_id should match')
    plan.equal(lgException.customAttributes['error.code'], lgException.error['code'], 'error codes should match')
    plan.equal(lgException.customAttributes['error.message'], lgException.error['message'], 'error messages should match')

    tx.end()
    await plan.completed
  })
})

test('should not create llm events when not in a transaction', async (t) => {
  const { agent, langgraphAgent } = t.nr
  const stream = await langgraphAgent.stream(
    { messages: [{ role: 'user', content: 'You are a scientist.' }] }
  )
  for await (const chunk of stream) {
    consumeChunk(chunk)
  }

  // Should not create LlmAgent events
  const events = agent.customEventAggregator.events.toArray()
  const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
  assert.equal(agentEvents.length, 0, 'should not create LlmAgent events')
})

test('should not create segment or events when ai_monitoring.enabled is false', async (t) => {
  const { agent, langgraphAgent } = t.nr

  // Disable ai_monitoring
  agent.config.ai_monitoring.enabled = false

  await helper.runInTransaction(agent, async (tx) => {
    try {
      const stream = await langgraphAgent.stream(
        { messages: [{ role: 'user', content: 'You are a scientist.' }] }
      )
      for await (const chunk of stream) {
        consumeChunk(chunk)
      }
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

test('should not create events when ai_monitoring.streaming.enabled is false', async (t) => {
  const { agent, langgraphAgent, langgraphVersion } = t.nr

  // Disable streaming instrumentation specifically
  agent.config.ai_monitoring.streaming.enabled = false

  await helper.runInTransaction(agent, async (tx) => {
    try {
      const stream = await langgraphAgent.stream(
        { messages: [{ role: 'user', content: 'You are a scientist.' }] }
      )
      for await (const chunk of stream) {
        consumeChunk(chunk)
      }
    } catch (err) {
      assert.fail(err)
    }

    // Should still create LangGraph segment
    const segments = tx.trace.getChildren(tx.trace.root.id)
    const langgraphSegments = segments.filter((s) => s.name.includes('Llm/agent/LangGraph'))
    assert.equal(langgraphSegments.length, 1, 'should still create LangGraph segments')

    // Should not create LlmAgent events
    const events = agent.customEventAggregator.events.toArray()
    const agentEvents = events.filter((e) => e[0].type === 'LlmAgent')
    assert.equal(agentEvents.length, 0, 'should not create LlmAgent events')

    // Check metrics
    const metrics = agent.metrics.getOrCreateMetric(
      `Supportability/Nodejs/ML/LangGraph/${langgraphVersion}`
    )
    assert.equal(metrics.callCount, 1)
    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true, 'should still add llm attribute')
    const streamingDisabled = agent.metrics.getOrCreateMetric(
      'Supportability/Nodejs/ML/Streaming/Disabled'
    )
    assert.equal(streamingDisabled.callCount, 2, 'should increment streaming disabled metric')

    tx.end()
  })
})
