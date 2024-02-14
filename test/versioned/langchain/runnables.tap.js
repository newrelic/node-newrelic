/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
// load the assertSegments assertion
require('../../lib/metrics_helper')
const { version: pkgVersion } = require('@langchain/core/package.json')

const { beforeHook, afterEachHook, afterHook } = require('../openai/common')

function assertChatCompletionSummary(test, tx, chatSummary) {
  const expectedSummary = {
    'id': /[a-f0-9]{36}/,
    'appName': 'New Relic for Node.js tests',
    'span_id': tx.trace.root.children[0].id,
    'trace_id': tx.traceId,
    'transaction_id': tx.id,
    'request_id': /[a-f0-9]{36}/,
    'ingest_source': 'Node',
    'vendor': 'langchain',
    'metadata.key': 'value',
    'metadata.hello': 'world',
    'tags': 'tag1,tag2',
    'virtual_llm': true,
    ['response.number_of_messages']: 1
    // 'duration': tx.trace.root.children[0].getDurationInMillis()
  }

  test.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
  test.match(chatSummary[1], expectedSummary)
}

function assertChatCompletionMessages(test, tx, chatMsgs, chatSummary) {
  const baseMsg = {
    id: /[a-f0-9]{36}/,
    appName: 'New Relic for Node.js tests',
    span_id: tx.trace.root.children[0].id,
    trace_id: tx.traceId,
    transaction_id: tx.id,
    ingest_source: 'Node',
    vendor: 'langchain',
    completion_id: chatSummary.id,
    virtual_llm: true,
    run_id: /[a-f0-9]{36}/
  }

  chatMsgs.forEach((msg) => {
    const expectedChatMsg = { ...baseMsg }
    if (msg[1].sequence === 0) {
      expectedChatMsg.sequence = 0
      expectedChatMsg.content = '{"topic":"scientist"}'
    } else if (msg[1].sequence === 1) {
      expectedChatMsg.sequence = 1
      expectedChatMsg.content = '212 degrees Fahrenheit is equal to 100 degrees Celsius.'
    }

    test.equal(msg[0].type, 'LlmChatCompletionMessage')
    test.match(msg[1], expectedChatMsg)
  })
}

function filterLangchainEvents(events) {
  return events.filter((event) => {
    const [, chainEvent] = event
    return chainEvent.vendor === 'langchain'
  })
}

function filterLangchainMessages(events, msgType) {
  return events.filter((event) => {
    const [{ type }] = event
    return type === msgType
  })
}

tap.test('Langchain instrumentation - runnable sequence', (t) => {
  t.autoend()

  t.before(beforeHook.bind(null, t))
  t.afterEach(afterEachHook.bind(null, t))
  t.teardown(afterHook.bind(null, t))

  t.beforeEach(async () => {
    const { client } = t.context
    const { ChatPromptTemplate } = require('@langchain/core/prompts')
    const { StringOutputParser } = require('@langchain/core/output_parsers')
    const { ChatOpenAI } = require('@langchain/openai')

    t.context.prompt = ChatPromptTemplate.fromMessages([['assistant', 'You are a {topic}.']])
    t.context.model = new ChatOpenAI({
      openAIApiKey: 'fake-key',
      configuration: {
        baseURL: client.baseURL
      }
    })
    t.context.outputParser = new StringOutputParser()
  })

  t.test('should create langchain events for every invoke call', (test) => {
    const { agent, prompt, outputParser, model } = t.context

    helper.runInTransaction(agent, async (tx) => {
      const input = { topic: 'scientist' }
      const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

      const chain = prompt.pipe(model).pipe(outputParser)
      await chain.invoke(input, options)

      const events = agent.customEventAggregator.events.toArray()
      test.equal(events.length, 6, 'should create 6 events')

      const langchainEvents = events.filter((event) => {
        const [, chainEvent] = event
        return chainEvent.vendor === 'langchain'
      })

      test.equal(langchainEvents.length, 3, 'should create 3 langchain events')

      tx.end()
      test.end()
    })
  })

  t.test('should increment tracking metric for each langchain prompt event', (test) => {
    const { agent, prompt, outputParser, model } = t.context

    helper.runInTransaction(agent, async (tx) => {
      const input = { topic: 'scientist' }
      const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

      const chain = prompt.pipe(model).pipe(outputParser)
      await chain.invoke(input, options)

      const metrics = agent.metrics.getOrCreateMetric(
        `Supportability/Nodejs/ML/Langchain/${pkgVersion}`
      )
      t.equal(metrics.callCount > 0, true)

      tx.end()
      test.end()
    })
  })

  t.test(
    'should create langchain events for every invoke call on chat prompt + model + parser',
    (test) => {
      const { agent, prompt, outputParser, model } = t.context

      helper.runInTransaction(agent, async (tx) => {
        const input = { topic: 'scientist' }
        const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

        const chain = prompt.pipe(model).pipe(outputParser)
        await chain.invoke(input, options)

        const events = agent.customEventAggregator.events.toArray()

        const langchainEvents = filterLangchainEvents(events)
        const langChainMessageEvents = filterLangchainMessages(
          langchainEvents,
          'LlmChatCompletionMessage'
        )
        const langChainSummaryEvents = filterLangchainMessages(
          langchainEvents,
          'LlmChatCompletionSummary'
        )

        assertChatCompletionSummary(test, tx, langChainSummaryEvents[0])
        assertChatCompletionMessages(test, tx, langChainMessageEvents, langChainSummaryEvents[0][1])

        tx.end()
        test.end()
      })
    }
  )

  t.test('should create langchain events for every invoke call on prompt + model', (test) => {
    const { agent, prompt, model } = t.context

    helper.runInTransaction(agent, async (tx) => {
      const input = { topic: 'scientist' }
      const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

      const chain = prompt.pipe(model)
      await chain.invoke(input, options)

      const events = agent.customEventAggregator.events.toArray()

      const langchainEvents = filterLangchainEvents(events)
      const langChainMessageEvents = filterLangchainMessages(
        langchainEvents,
        'LlmChatCompletionMessage'
      )
      const langChainSummaryEvents = filterLangchainMessages(
        langchainEvents,
        'LlmChatCompletionSummary'
      )

      assertChatCompletionSummary(test, tx, langChainSummaryEvents[0])
      assertChatCompletionMessages(test, tx, langChainMessageEvents, langChainSummaryEvents[0][1])

      tx.end()
      test.end()
    })
  })

  t.test('should add runId when a callback handler exists', (test) => {
    const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
    let runId
    const cbHandler = BaseCallbackHandler.fromMethods({
      handleChainStart(...args) {
        runId = args?.[2]
      }
    })

    const { agent, prompt, outputParser, model } = t.context

    helper.runInTransaction(agent, async (tx) => {
      const input = { topic: 'scientist' }
      const options = {
        metadata: { key: 'value', hello: 'world' },
        callbacks: [cbHandler],
        tags: ['tag1', 'tag2']
      }

      const chain = prompt.pipe(model).pipe(outputParser)
      await chain.invoke(input, options)

      const events = agent.customEventAggregator.events.toArray()

      const langchainEvents = filterLangchainEvents(events)
      t.equal(langchainEvents[0][1].request_id, runId)

      tx.end()
      test.end()
    })
  })
})
