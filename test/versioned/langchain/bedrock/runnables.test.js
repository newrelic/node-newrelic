/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')

const { removeModules } = require('../../../lib/cache-buster')
const { assertPackageMetrics, assertSegments, assertSpanKind } = require('../../../lib/custom-assertions')
const {
  assertLangChainChatCompletionMessages,
  assertLangChainChatCompletionSummary,
  filterLangchainEvents,
  filterLangchainEventsByType
} = require('../common')
const { version: pkgVersion } = require('@langchain/core/package.json')
const { FAKE_CREDENTIALS, getAiResponseServer } = require('../../../lib/aws-server-stubs')
const helper = require('../../../lib/agent_helper')

const config = {
  ai_monitoring: {
    enabled: true
  }
}
const { DESTINATIONS } = require('../../../../lib/config/attribute-filter')
const createAiResponseServer = getAiResponseServer(path.join(__dirname, '../'))

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { server, baseUrl } = await createAiResponseServer()
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent(config)
  const { ChatPromptTemplate } = require('@langchain/core/prompts')
  const { StringOutputParser } = require('@langchain/core/output_parsers')
  const { ChatBedrockConverse } = require('@langchain/aws')
  const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime')

  // Create the BedrockRuntimeClient with our mock endpoint
  const bedrockClient = new BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl,
    maxAttempts: 1
  })

  ctx.nr.prompt = ChatPromptTemplate.fromMessages([['assistant', 'text converse ultimate {topic}']])
  ctx.nr.model = new ChatBedrockConverse({
    model: 'anthropic.claude-3-haiku-20240307-v1:0',
    region: 'us-east-1',
    client: bedrockClient
  })
  ctx.nr.outputParser = new StringOutputParser()
})

test.afterEach(async (ctx) => {
  ctx.nr?.server?.destroy()
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core', '@langchain/aws', '@aws-sdk'])
})

test('should log tracking metrics', function(t) {
  const { agent } = t.nr
  const { version } = require('@langchain/core/package.json')
  assertPackageMetrics({ agent, pkg: '@langchain/core', version })
})

test('should create langchain events for every invoke call', (t, end) => {
  const { agent, prompt, outputParser, model } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const input = { topic: 'question' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    const chain = prompt.pipe(model).pipe(outputParser)
    await chain.invoke(input, options)

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 6, 'should create 6 events')

    const langchainEvents = events.filter((event) => {
      const [, chainEvent] = event
      return chainEvent.vendor === 'langchain'
    })

    assert.equal(langchainEvents.length, 3, 'should create 3 langchain events')

    tx.end()
    end()
  })
})

test('should increment tracking metric for each langchain chat prompt event', (t, end) => {
  const { agent, prompt, outputParser, model } = t.nr

  helper.runInTransaction(agent, async (tx) => {
    const input = { topic: 'question' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    const chain = prompt.pipe(model).pipe(outputParser)
    await chain.invoke(input, options)

    const metrics = agent.metrics.getOrCreateMetric(
      `Supportability/Nodejs/ML/Langchain/${pkgVersion}`
    )
    assert.equal(metrics.callCount > 0, true)

    tx.end()
    end()
  })
})

test('should support custom attributes on the LLM events', (t, end) => {
  const { agent, prompt, outputParser, model } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, async (tx) => {
    api.withLlmCustomAttributes({ 'llm.contextAttribute': 'someValue' }, async () => {
      const input = { topic: 'question' }
      const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

      const chain = prompt.pipe(model).pipe(outputParser)
      await chain.invoke(input, options)
      const events = agent.customEventAggregator.events.toArray()

      const [[, message]] = events
      assert.equal(message['llm.contextAttribute'], 'someValue')

      tx.end()
      end()
    })
  })
})

test('should create langchain events for every invoke call on chat prompt + model + parser', (t, end) => {
  const { agent, prompt, outputParser, model } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const input = { topic: 'question' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    const chain = prompt.pipe(model).pipe(outputParser)
    await chain.invoke(input, options)

    const events = agent.customEventAggregator.events.toArray()

    const langchainEvents = filterLangchainEvents(events)
    const langChainMessageEvents = filterLangchainEventsByType(
      langchainEvents,
      'LlmChatCompletionMessage'
    )
    const langChainSummaryEvents = filterLangchainEventsByType(
      langchainEvents,
      'LlmChatCompletionSummary'
    )

    assertLangChainChatCompletionSummary({
      tx,
      chatSummary: langChainSummaryEvents[0]
    })

    assertLangChainChatCompletionMessages({
      tx,
      chatMsgs: langChainMessageEvents,
      chatSummary: langChainSummaryEvents[0][1],
      input: '{"topic":"question"}',
      output: 'This is a test.'
    })

    tx.end()
    end()
  })
})

test('should create langchain events for every invoke call on chat prompt + model', (t, end) => {
  const { agent, prompt, model } = t.nr

  helper.runInTransaction(agent, async (tx) => {
    const input = { topic: 'question' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    const chain = prompt.pipe(model)
    await chain.invoke(input, options)

    const events = agent.customEventAggregator.events.toArray()

    const langchainEvents = filterLangchainEvents(events)
    const langChainMessageEvents = filterLangchainEventsByType(
      langchainEvents,
      'LlmChatCompletionMessage'
    )
    const langChainSummaryEvents = filterLangchainEventsByType(
      langchainEvents,
      'LlmChatCompletionSummary'
    )

    assertLangChainChatCompletionSummary({
      tx,
      chatSummary: langChainSummaryEvents[0]
    })

    assertLangChainChatCompletionMessages({
      tx,
      chatMsgs: langChainMessageEvents,
      chatSummary: langChainSummaryEvents[0][1],
      input: '{"topic":"question"}',
      output: 'This is a test.'
    })

    tx.end()
    end()
  })
})

test('should create langchain events for every invoke call with parser that returns an array as output', (t, end) => {
  const { CommaSeparatedListOutputParser } = require('@langchain/core/output_parsers')
  const { agent, prompt, model } = t.nr

  helper.runInTransaction(agent, async (tx) => {
    const parser = new CommaSeparatedListOutputParser()

    const input = { topic: 'question' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    const chain = prompt.pipe(model).pipe(parser)
    await chain.invoke(input, options)

    const events = agent.customEventAggregator.events.toArray()

    const langchainEvents = filterLangchainEvents(events)
    const langChainMessageEvents = filterLangchainEventsByType(
      langchainEvents,
      'LlmChatCompletionMessage'
    )
    const langChainSummaryEvents = filterLangchainEventsByType(
      langchainEvents,
      'LlmChatCompletionSummary'
    )

    assertLangChainChatCompletionSummary({
      tx,
      chatSummary: langChainSummaryEvents[0]
    })

    assertLangChainChatCompletionMessages({
      tx,
      chatMsgs: langChainMessageEvents,
      chatSummary: langChainSummaryEvents[0][1],
      input: '{"topic":"question"}',
      output: '["This is a test."]'
    })

    tx.end()
    end()
  })
})

test('should add runId when a callback handler exists', (t, end) => {
  const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
  let runId
  const cbHandler = BaseCallbackHandler.fromMethods({
    handleChainStart(...args) {
      runId = args?.[2]
    }
  })

  const { agent, prompt, outputParser, model } = t.nr

  helper.runInTransaction(agent, async (tx) => {
    const input = { topic: 'question' }
    const options = {
      metadata: { key: 'value', hello: 'world' },
      callbacks: [cbHandler],
      tags: ['tag1', 'tag2']
    }

    const chain = prompt.pipe(model).pipe(outputParser)
    await chain.invoke(input, options)

    const events = agent.customEventAggregator.events.toArray()

    const langchainEvents = filterLangchainEvents(events)
    assert.equal(langchainEvents[0][1].request_id, runId)

    tx.end()
    end()
  })
})

test('should create langchain events for every invoke call on chat prompt + model + parser with callback', (t, end) => {
  const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
  const cbHandler = BaseCallbackHandler.fromMethods({
    handleChainStart() {}
  })

  const { agent, prompt, outputParser, model } = t.nr

  helper.runInTransaction(agent, async (tx) => {
    const input = { topic: 'question' }
    const options = {
      metadata: { key: 'value', hello: 'world' },
      callbacks: [cbHandler],
      tags: ['tag1', 'tag2']
    }

    const chain = prompt.pipe(model).pipe(outputParser)
    await chain.invoke(input, options)

    const events = agent.customEventAggregator.events.toArray()

    const langchainEvents = filterLangchainEvents(events)
    const langChainMessageEvents = filterLangchainEventsByType(
      langchainEvents,
      'LlmChatCompletionMessage'
    )
    const langChainSummaryEvents = filterLangchainEventsByType(
      langchainEvents,
      'LlmChatCompletionSummary'
    )
    assertLangChainChatCompletionSummary({
      tx,
      chatSummary: langChainSummaryEvents[0],
      withCallback: cbHandler
    })

    assertLangChainChatCompletionMessages({
      tx,
      chatMsgs: langChainMessageEvents,
      chatSummary: langChainSummaryEvents[0][1],
      withCallback: cbHandler,
      input: '{"topic":"question"}',
      output: 'This is a test.'
    })

    tx.end()
    end()
  })
})

test('should not create langchain events when not in a transaction', async (t) => {
  const { agent, prompt, outputParser, model } = t.nr

  const input = { topic: 'question' }
  const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

  const chain = prompt.pipe(model).pipe(outputParser)
  await chain.invoke(input, options)

  const events = agent.customEventAggregator.events.toArray()
  assert.equal(events.length, 0, 'should not create langchain events')
})

test('should add llm attribute to transaction', (t, end) => {
  const { agent, prompt, model } = t.nr

  const input = { topic: 'question' }
  const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

  helper.runInTransaction(agent, async (tx) => {
    const chain = prompt.pipe(model)
    await chain.invoke(input, options)

    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true)

    tx.end()
    end()
  })
})

test('should create span on successful runnables create', (t, end) => {
  const { agent, prompt, model } = t.nr

  const input = { topic: 'question' }
  const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

  helper.runInTransaction(agent, async (tx) => {
    const chain = prompt.pipe(model)
    const result = await chain.invoke(input, options)

    assert.ok(result)
    assertSegments(tx.trace, tx.trace.root, ['Llm/chain/Langchain/invoke'], { exact: false })
    tx.end()
    assertSpanKind({ agent, segments: [{ name: 'Llm/chain/Langchain/invoke', kind: 'internal' }] })
    end()
  })
})

// testing JSON.stringify on request (input) during creation of LangChainCompletionMessage event
test('should use empty string for content property on completion message event when invalid input is used - circular reference', (t, end) => {
  const { agent, prompt, outputParser, model } = t.nr

  helper.runInTransaction(agent, async (tx) => {
    const input = { topic: 'question' }
    input.myself = input
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    const chain = prompt.pipe(model).pipe(outputParser)
    await chain.invoke(input, options)

    const events = agent.customEventAggregator.events.toArray()

    const langchainEvents = filterLangchainEvents(events)
    const langChainMessageEvents = filterLangchainEventsByType(
      langchainEvents,
      'LlmChatCompletionMessage'
    )

    const msgEventEmptyContent = langChainMessageEvents.filter((event) => event[1].content === '')

    assert.equal(msgEventEmptyContent.length, 1, 'should have 1 event with empty content property')

    tx.end()
    end()
  })
})

test('should create error events', (t, end) => {
  const { ChatPromptTemplate } = require('@langchain/core/prompts')
  const prompt = ChatPromptTemplate.fromMessages([['assistant', 'text converse ultimate question error']])
  const { agent, outputParser, model } = t.nr

  helper.runInTransaction(agent, async (tx) => {
    const chain = prompt.pipe(model).pipe(outputParser)

    try {
      await chain.invoke('')
    } catch (error) {
      assert.ok(error)
    }

    // We should still get the same 3xLangChain and 2xLLM events as in the
    // success case:
    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 5, 'should create 5 events')

    const langchainEvents = events.filter((event) => {
      const [, chainEvent] = event
      return chainEvent.vendor === 'langchain'
    })
    assert.equal(langchainEvents.length, 3, 'should create 3 langchain events')
    const summary = langchainEvents.find((e) => e[0].type === 'LlmChatCompletionSummary')?.[1]
    assert.equal(summary.error, true)

    // But, we should also get two error events: 1xLLM and 1xLangChain
    const exceptions = tx.exceptions
    assert.equal(exceptions.length, 2)
    for (const e of exceptions) {
      assert.ok(e.customAttributes?.['error.message'])
    }

    tx.end()
    end()
  })
})
