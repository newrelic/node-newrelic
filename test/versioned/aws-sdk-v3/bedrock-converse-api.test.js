/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const {
  afterEach,
  assertChatCompletionMessages,
  assertChatCompletionSummary,
  getAiResponseServer
} = require('./common')
const helper = require('../../lib/agent_helper')
const { FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const { assertPackageMetrics, assertSegments, match } = require('../../lib/custom-assertions')
const promiseResolvers = require('../../lib/promise-resolvers')
const responseConstants = require('../../lib/aws-server-stubs/ai-server/responses/constants')
const createAiResponseServer = getAiResponseServer()

// We'll test with only one model because the
// request and response structure is the same
// for all models within Converse API.
const modelId = 'anthropic.claude-instant-v1'

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    ai_monitoring: {
      enabled: true
    }
  })
  const bedrock = require('@aws-sdk/client-bedrock-runtime')
  ctx.nr.bedrock = bedrock

  const { server, baseUrl, responses, host, port } = await createAiResponseServer()
  ctx.nr.server = server
  ctx.nr.baseUrl = baseUrl
  ctx.nr.responses = responses
  ctx.nr.expectedExternalPath = (modelId, method = 'converse') => `External/${host}:${port}/model/${encodeURIComponent(modelId)}/${method}`

  const client = new bedrock.BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl,
    maxAttempts: 1
  })
  ctx.nr.client = client
})

test.afterEach(afterEach)

test('should log tracking metrics', function(t) {
  const { agent } = t.nr
  const { version } = require('@smithy/smithy-client/package.json')
  assertPackageMetrics({ agent, pkg: '@smithy/smithy-client', version })
})

test('should properly create completion segment', async (t) => {
  const { bedrock, client, agent, expectedExternalPath } = t.nr
  const prompt = 'text converse ultimate question'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
  }

  const command = new bedrock.ConverseCommand(input)

  const expected = { headers: { 'x-amzn-requestid': responseConstants.reqId } }
  await helper.runInTransaction(agent, async (tx) => {
    const response = await client.send(command)
    assert.ok(response?.output?.message?.content?.[0]?.text)
    assert.equal(response?.$metadata?.requestId, expected?.headers['x-amzn-requestid'])
    assertSegments(
      tx.trace,
      tx.trace.root,
      ['Llm/completion/Bedrock/ConverseCommand', [expectedExternalPath(modelId)]],
      { exact: false }
    )
    tx.end()
  })
})

test('properly create the LlmChatCompletionMessage(s) and LlmChatCompletionSummary events', async (t) => {
  const { bedrock, client, agent } = t.nr
  const prompt = 'text converse ultimate question'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
    inferenceConfig: {
      maxTokens: 100,
      temperature: 0.5
    },
  }
  const command = new bedrock.ConverseCommand(input)

  const api = helper.getAgentApi()
  await helper.runInTransaction(agent, async (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')
    await client.send(command)
    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 3)
    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')

    assertChatCompletionMessages({
      modelId,
      prompt,
      tx,
      expectedId: null,
      chatMsgs,
      resContent: 'This is a test.'
    })

    assertChatCompletionSummary({ tx, modelId, chatSummary })

    tx.end()
  })
})

test('supports custom attributes on LlmChatCompletionMessage(s) and LlmChatCompletionSummary events', async (t) => {
  const { bedrock, client, agent } = t.nr
  const { promise, resolve } = promiseResolvers()
  const prompt = 'text converse ultimate question'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
  }
  const command = new bedrock.ConverseCommand(input)

  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')
    api.withLlmCustomAttributes({ 'llm.contextAttribute': 'someValue' }, async () => {
      await client.send(command)
      const events = agent.customEventAggregator.events.toArray()

      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      const [, message] = chatSummary
      assert.equal(message['llm.contextAttribute'], 'someValue')

      tx.end()
      resolve()
    })
  })
  await promise
})

test('should record feedback message accordingly', async (t) => {
  const { bedrock, client, agent } = t.nr
  const prompt = 'text converse ultimate question'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
  }
  const command = new bedrock.ConverseCommand(input)

  const api = helper.getAgentApi()
  await helper.runInTransaction(agent, async (tx) => {
    await client.send(command)
    const { traceId } = api.getTraceMetadata()
    api.recordLlmFeedbackEvent({
      traceId,
      category: 'test-event',
      rating: '5 star',
      message: 'You are a mathematician.',
      metadata: { foo: 'foo' }
    })
    const recordedEvents = agent.customEventAggregator.getEvents()
    const [[, feedback]] = recordedEvents.filter(([{ type }]) => type === 'LlmFeedbackMessage')

    match(feedback, {
      id: /\w{32}/,
      trace_id: traceId,
      category: 'test-event',
      rating: '5 star',
      message: 'You are a mathematician.',
      ingest_source: 'Node',
      foo: 'foo'
    })

    tx.end()
  })
})

test('should increment tracking metric for each chat completion event', async (t) => {
  const { bedrock, client, agent } = t.nr
  const prompt = 'text converse ultimate question'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
  }
  const command = new bedrock.ConverseCommand(input)
  await helper.runInTransaction(agent, async (tx) => {
    await client.send(command)
    const metrics = getPrefixedMetric({
      agent,
      metricPrefix: 'Supportability/Nodejs/ML/Bedrock'
    })
    assert.equal(metrics.callCount > 0, true)
    tx.end()
  })
})

test('should properly create errors on create completion', async (t) => {
  const { bedrock, client, agent, expectedExternalPath } = t.nr
  const prompt = 'text converse ultimate question error'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
    inferenceConfig: {
      maxTokens: 100,
      temperature: 0.5
    },
  }

  const command = new bedrock.ConverseCommand(input)
  const expectedMsg =
        'Malformed input request: 2 schema violations found, please reformat your input and try again.'
  const expectedType = 'ValidationException'

  const api = helper.getAgentApi()
  await helper.runInTransaction(agent, async (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')
    try {
      await client.send(command)
    } catch (err) {
      assert.equal(err.message, expectedMsg)
      assert.equal(err.name, expectedType)
    }

    assert.equal(tx.exceptions.length, 1)
    match(tx.exceptions[0], {
      error: {
        name: expectedType,
        message: expectedMsg
      },
      customAttributes: {
        'http.statusCode': 400,
        'error.message': expectedMsg,
        'error.code': expectedType,
        completion_id: /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/
      },
      agentAttributes: {
        spanId: /\w+/
      }
    })

    assertSegments(
      tx.trace,
      tx.trace.root,
      ['Llm/completion/Bedrock/ConverseCommand', [expectedExternalPath(modelId)]],
      { exact: false }
    )

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 2)
    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')

    assertChatCompletionMessages({
      modelId,
      prompt,
      tx,
      chatMsgs
    })

    assertChatCompletionSummary({ tx, modelId, chatSummary, error: true })
    tx.end()
  })
})

test('should add llm attribute to transaction', async (t) => {
  const { bedrock, client, agent } = t.nr
  const prompt = 'text converse ultimate question'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
  }
  const command = new bedrock.ConverseCommand(input)

  await helper.runInTransaction(agent, async (tx) => {
    await client.send(command)
    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true)

    tx.end()
  })
})

test('should decorate messages with custom attrs', async (t) => {
  const { bedrock, client, agent } = t.nr
  const prompt = 'text converse ultimate question'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
  }
  const command = new bedrock.ConverseCommand(input)

  await helper.runInTransaction(agent, async (tx) => {
    const api = helper.getAgentApi()
    api.addCustomAttribute('llm.foo', 'bar')

    await client.send(command)

    const events = tx.agent.customEventAggregator.events.toArray()
    const summary = events
      .filter((e) => e[0].type === 'LlmChatCompletionSummary')
      .map((e) => e[1])
      .pop()
    const completion = events
      .filter((e) => e[0].type === 'LlmChatCompletionMessage')
      .map((e) => e[1])
      .pop()

    assert.equal(summary['llm.foo'], 'bar')
    assert.equal(completion['llm.foo'], 'bar')

    tx.end()
  })
})

test('should instrument text stream', async (t) => {
  const { bedrock, client, agent } = t.nr
  const prompt = 'text converse ultimate question streamed'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
    inferenceConfig: {
      maxTokens: 100,
      temperature: 0.5
    },
  }
  const command = new bedrock.ConverseStreamCommand(input)

  const api = helper.getAgentApi()
  await helper.runInTransaction(agent, async (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')
    const response = await client.send(command)
    for await (const event of response?.output?.message?.content) {
      // no-op iteration over the stream in order to exercise the instrumentation
      consumeStreamChunk(event)
    }

    const events = agent.customEventAggregator.events.toArray()
    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
    assert.equal(events.length > 2, true)

    assertChatCompletionMessages({
      modelId,
      prompt,
      expectedId: null,
      resContent: 'This is a test.',
      tx,
      chatMsgs
    })

    assertChatCompletionSummary({ tx, modelId, chatSummary, numMsgs: events.length - 1 })

    tx.end()
  })
})

test('should not instrument stream when disabled', async (t) => {
  const { bedrock, client, agent } = t.nr
  agent.config.ai_monitoring.streaming.enabled = false
  const prompt = 'text converse ultimate question streamed'
  const input = {
    modelId,
    messages: [
      { role: 'user', content: [{ text: prompt }] }
    ],
  }
  const command = new bedrock.ConverseStreamCommand(input)

  await helper.runInTransaction(agent, async (tx) => {
    const response = await client.send(command)
    for await (const event of response?.stream?.options?.messageStream?.options?.inputStream) {
      // no-op iteration over the stream in order to exercise the instrumentation
      consumeStreamChunk(event)
    }

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not create Llm events when streaming is disabled')
    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true, 'should assign llm attribute to transaction trace')
    const metrics = getPrefixedMetric({
      agent,
      metricPrefix: 'Supportability/Nodejs/ML/Bedrock'
    })
    assert.equal(metrics.callCount > 0, true, 'should set framework metric')
    const supportabilityMetrics = agent.metrics.getOrCreateMetric(
      'Supportability/Nodejs/ML/Streaming/Disabled'
    )
    assert.equal(
      supportabilityMetrics.callCount > 0,
      true,
      'should increment streaming disabled metric'
    )

    tx.end()
  })
})

function getPrefixedMetric({ agent, metricPrefix }) {
  for (const [key, value] of Object.entries(agent.metrics._metrics.unscoped)) {
    if (key.startsWith(metricPrefix) === false) {
      continue
    }
    return value
  }
}

function consumeStreamChunk() {
  // A no-op function used to consume chunks of a stream.
}
