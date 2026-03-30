/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { removeModules } = require('../../lib/cache-buster')
const { assertPackageMetrics, assertSegments, assertSpanKind, match } = require('../../lib/custom-assertions')
const { assertChatCompletionMessages, assertChatCompletionSummary } = require('./common')
const AnthropicMockServer = require('./mock-server')
const helper = require('../../lib/agent_helper')

const {
  AI: { ANTHROPIC }
} = require('../../../lib/metrics/names')
const pkgVersion = helper.readPackageVersion(__dirname, '@anthropic-ai/sdk')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const TRACKING_METRIC = `Supportability/Nodejs/ML/Anthropic/${pkgVersion}`

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { host, port, server } = await AnthropicMockServer()
  ctx.nr.host = host
  ctx.nr.port = port
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent({
    ai_monitoring: {
      enabled: true,
      streaming: {
        enabled: true
      }
    }
  })
  const Anthropic = require('@anthropic-ai/sdk')

  ctx.nr.client = new Anthropic({
    apiKey: 'fake-versioned-test-key',
    baseURL: `http://${host}:${port}`
  })
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server?.close()
  removeModules('@anthropic-ai/sdk')
})

test('should log tracking metrics', (t, end) => {
  const { agent, client } = t.nr
  helper.runInTransaction(agent, async () => {
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'You are a mathematician.' }]
    })
    assertPackageMetrics(
      { agent, pkg: '@anthropic-ai/sdk', version: pkgVersion, subscriberType: true },
      { assert: t.assert }
    )
    end()
  })
})

test('should create span on successful messages.create', (t, end) => {
  const { client, agent, host, port } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const model = 'claude-sonnet-4-20250514'
    const result = await client.messages.create({
      model,
      max_tokens: 100,
      messages: [{ role: 'user', content: 'You are a mathematician.' }]
    })

    assert.equal(result.content[0].text, '1 plus 2 is 3.')

    const name = `External/${host}:${port}/v1/messages`
    assertSegments(
      tx.trace,
      tx.trace.root,
      [ANTHROPIC.COMPLETION, [name]],
      { exact: false }
    )

    tx.end()
    assertSpanKind({
      agent,
      segments: [
        { name: ANTHROPIC.COMPLETION, kind: 'internal' }
      ]
    })
    end()
  })
})

test('should increment tracking metric for each chat completion event', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'You are a mathematician.' }]
    })

    const metrics = agent.metrics.getOrCreateMetric(TRACKING_METRIC)
    assert.equal(metrics.callCount > 0, true)

    tx.end()
    end()
  })
})

test('should create chat completion message and summary for every message sent', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const model = 'claude-sonnet-4-20250514'
    const content = 'You are a mathematician.'
    await client.messages.create({
      model,
      max_tokens: 100,
      temperature: 0.5,
      messages: [
        { role: 'user', content },
        { role: 'user', content: 'What does 1 plus 1 equal?' }
      ]
    })

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 4, 'should create a chat completion message and summary event')
    const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
    assertChatCompletionMessages({
      tx,
      chatMsgs,
      model,
      resContent: '1 plus 2 is 3.',
      reqContent: content
    })
    const requestMsg = chatMsgs.filter((msg) => msg[1].is_response !== true)[0]
    assert.equal(requestMsg[0].timestamp, requestMsg[1].timestamp, 'time added to event aggregator should equal `timestamp` property')

    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    assertChatCompletionSummary({ tx, model, chatSummary })
    assert.equal(chatSummary[0].timestamp, chatSummary[1].timestamp, 'time added to event aggregator should equal `timestamp` property')

    tx.end()
    end()
  })
})

// Streaming via create({ stream: true })
test('should create chat completion message and summary for streaming via create', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const content = 'Streamed response'
    const model = 'claude-sonnet-4-20250514'
    const stream = await client.messages.create({
      model,
      max_tokens: 100,
      temperature: 0.5,
      stream: true,
      messages: [
        { role: 'user', content },
        { role: 'user', content: 'What does 1 plus 1 equal?' }
      ]
    })

    let res = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res += event.delta.text
      }
    }
    assert.ok(res, 'should have received streamed content')

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 4, 'should create a chat completion message and summary event')
    const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
    assertChatCompletionMessages({
      tx,
      chatMsgs,
      model,
      resContent: res,
      reqContent: content
    })

    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    assertChatCompletionSummary({ tx, model, chatSummary })

    tx.end()
    end()
  })
})

// Streaming via messages.stream()
test('should create chat completion events for messages.stream', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const content = 'Streamed response'
    const model = 'claude-sonnet-4-20250514'
    const stream = client.messages.stream({
      model,
      max_tokens: 100,
      temperature: 0.5,
      messages: [
        { role: 'user', content },
        { role: 'user', content: 'What does 1 plus 1 equal?' }
      ]
    })

    let res = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res += event.delta.text
      }
    }
    assert.ok(res, 'should have received streamed content')

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 4, 'should create a chat completion message and summary event')
    const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
    assertChatCompletionMessages({
      tx,
      chatMsgs,
      model,
      resContent: res,
      reqContent: content
    })

    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    assertChatCompletionSummary({ tx, model, chatSummary })

    tx.end()
    end()
  })
})

test('should set time_to_first_token on llm chat completion summary for streaming', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const content = 'Streamed response'
    const model = 'claude-sonnet-4-20250514'
    const stream = await client.messages.create({
      model,
      max_tokens: 100,
      temperature: 0.5,
      stream: true,
      messages: [
        { role: 'user', content },
        { role: 'user', content: 'What does 1 plus 1 equal?' }
      ]
    })

    let res = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res += event.delta.text
      }
    }
    assert.ok(res)

    const events = agent.customEventAggregator.events.toArray()
    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    assert.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
    const timeToFirstToken = chatSummary?.[1]?.['time_to_first_token']
    assert.ok(timeToFirstToken, 'time_to_first_token should exist')
    assert.equal(typeof timeToFirstToken, 'number', 'time_to_first_token should be a number')
    assert.ok(timeToFirstToken >= 0, 'time_to_first_token should be >= 0')

    tx.end()
    end()
  })
})

test('handles error in stream', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const content = 'bad stream'
    const model = 'claude-sonnet-4-20250514'

    try {
      const stream = await client.messages.create({
        model,
        max_tokens: 100,
        temperature: 0.5,
        stream: true,
        messages: [
          { role: 'user', content },
          { role: 'user', content },
          { role: 'user', content }
        ]
      })

      for await (const event of stream) {
        assert.ok(event)
      }
    } catch {
      const events = agent.customEventAggregator.events.toArray()
      assert.ok(events.length >= 1, 'should have at least a summary event')
      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      assert.ok(chatSummary, 'should have a summary event')
      assert.equal(chatSummary[1].error, true)
      assert.equal(tx.exceptions.length, 1)
      match(tx.exceptions[0], {
        customAttributes: {
          completion_id: /\w{32}/
        }
      })

      tx.end()
      end()
    }
  })
})

// Config tests
test('should not create llm events when ai_monitoring.enabled is false', (t, end) => {
  const { client, agent } = t.nr
  agent.config.ai_monitoring.enabled = false
  helper.runInTransaction(agent, async (tx) => {
    const result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'You are a mathematician.' }]
    })
    assert.ok(result)

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not create llm events')

    const activeSeg = agent.tracer.getSegment()
    assert.equal(activeSeg?.isRoot, true)
    const children = tx.trace.getChildren(activeSeg.id)
    assert.notEqual(children?.[0]?.name, ANTHROPIC.COMPLETION)

    tx.end()
    end()
  })
})

test('should not create llm events when ai_monitoring.streaming.enabled is false', (t, end) => {
  const { client, agent, host, port } = t.nr
  agent.config.ai_monitoring.streaming.enabled = false
  helper.runInTransaction(agent, async (tx) => {
    const content = 'Streamed response'
    const model = 'claude-sonnet-4-20250514'
    const stream = await client.messages.create({
      model,
      max_tokens: 100,
      temperature: 0.5,
      stream: true,
      messages: [{ role: 'user', content }]
    })

    let res = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res += event.delta.text
      }
    }
    assert.ok(res)

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not create llm events when streaming is disabled')
    const streamingDisabled = agent.metrics.getOrCreateMetric(
      'Supportability/Nodejs/ML/Streaming/Disabled'
    )
    assert.equal(streamingDisabled.callCount > 0, true)
    const name = `External/${host}:${port}/v1/messages`
    // Should still create the Anthropic segment since ai_monitoring is enabled
    assertSegments(
      tx.trace,
      tx.trace.root,
      [ANTHROPIC.COMPLETION, [name]],
      { exact: false }
    )

    tx.end()
    end()
  })
})

test('should not create llm events when streaming is enabled but ai_monitoring is not enabled', (t, end) => {
  const { client, agent } = t.nr
  agent.config.ai_monitoring.streaming.enabled = true
  agent.config.ai_monitoring.enabled = false
  helper.runInTransaction(agent, async (tx) => {
    const content = 'Streamed response'
    const model = 'claude-sonnet-4-20250514'
    const stream = await client.messages.create({
      model,
      max_tokens: 100,
      temperature: 0.5,
      stream: true,
      messages: [{ role: 'user', content }]
    })

    let res = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res += event.delta.text
      }
    }
    assert.ok(res)

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not create llm events when ai_monitoring is disabled')

    const activeSeg = agent.tracer.getSegment()
    assert.equal(activeSeg?.isRoot, true)
    const children = tx.trace.getChildren(activeSeg.id)
    assert.notEqual(children?.[0]?.name, ANTHROPIC.COMPLETION)

    tx.end()
    end()
  })
})

test('should not create llm events when not in a transaction', async (t) => {
  const { client, agent } = t.nr
  await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'You are a mathematician.' }]
  })

  const events = agent.customEventAggregator.events.toArray()
  assert.equal(events.length, 0, 'should not create llm events')
})

test('auth errors should be tracked', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    try {
      await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Invalid API key.' }]
      })
    } catch {}

    assert.equal(tx.exceptions.length, 1)
    match(tx.exceptions[0], {
      customAttributes: {
        'error.message': /.*invalid x-api-key.*/,
        completion_id: /\w{32}/
      },
      agentAttributes: {
        spanId: /\w+/
      }
    })

    const summary = agent.customEventAggregator.events.toArray().find((e) => e[0].type === 'LlmChatCompletionSummary')
    assert.ok(summary)
    assert.equal(summary[1].error, true)

    tx.end()
    end()
  })
})

test('should add llm attribute to transaction', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'You are a mathematician.' }]
    })

    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true)

    tx.end()
    end()
  })
})

test('should record LLM custom events with attributes', (t, end) => {
  const { client, agent } = t.nr
  const api = helper.getAgentApi()

  helper.runInTransaction(agent, () => {
    api.withLlmCustomAttributes({ 'llm.shared': true, 'llm.path': 'root/' }, async () => {
      await api.withLlmCustomAttributes(
        { 'llm.path': 'root/branch1', 'llm.attr1': true },
        async () => {
          const model = 'claude-sonnet-4-20250514'
          const content = 'You are a mathematician.'
          await client.messages.create({
            model,
            max_tokens: 100,
            temperature: 0.5,
            messages: [
              { role: 'user', content },
              { role: 'user', content: 'What does 1 plus 1 equal?' }
            ]
          })
        }
      )

      await api.withLlmCustomAttributes(
        { 'llm.path': 'root/branch2', 'llm.attr2': true },
        async () => {
          const model = 'claude-sonnet-4-20250514'
          const content = 'You are a mathematician.'
          await client.messages.create({
            model,
            max_tokens: 100,
            temperature: 0.5,
            messages: [
              { role: 'user', content },
              { role: 'user', content: 'What does 1 plus 2 equal?' }
            ]
          })
        }
      )

      const events = agent.customEventAggregator.events.toArray().map((event) => event[1])

      events.forEach((event) => {
        assert.ok(event['llm.shared'])
        if (event['llm.path'] === 'root/branch1') {
          assert.ok(event['llm.attr1'])
          assert.equal(event['llm.attr2'], undefined)
        } else {
          assert.ok(event['llm.attr2'])
          assert.equal(event['llm.attr1'], undefined)
        }
      })

      end()
    })
  })
})
