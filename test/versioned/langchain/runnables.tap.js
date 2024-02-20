/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
// load the assertSegments assertion
require('../../lib/metrics_helper')
const { filterLangchainEvents, filterLangchainMessages } = require('./common')
const { version: pkgVersion } = require('@langchain/core/package.json')
const { beforeHook, afterEachHook, afterHook } = require('../openai/common')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

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

  t.test('should increment tracking metric for each langchain chat prompt event', (test) => {
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

        test.langchainSummary({
          tx,
          chatSummary: langChainSummaryEvents[0]
        })

        test.langchainMessages({
          tx,
          chatMsgs: langChainMessageEvents,
          chatSummary: langChainSummaryEvents[0][1]
        })

        tx.end()
        test.end()
      })
    }
  )

  t.test('should create langchain events for every invoke call on chat prompt + model', (test) => {
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

      test.langchainSummary({
        tx,
        chatSummary: langChainSummaryEvents[0]
      })

      test.langchainMessages({
        tx,
        chatMsgs: langChainMessageEvents,
        chatSummary: langChainSummaryEvents[0][1]
      })

      tx.end()
      test.end()
    })
  })

  t.test(
    'should create langchain events for every invoke call with parser that returns an array as output',
    (test) => {
      const { CommaSeparatedListOutputParser } = require('@langchain/core/output_parsers')
      const { agent, prompt, model } = t.context

      helper.runInTransaction(agent, async (tx) => {
        const parser = new CommaSeparatedListOutputParser()

        const input = { topic: 'scientist' }
        const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

        const chain = prompt.pipe(model).pipe(parser)
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

        test.langchainSummary({
          tx,
          chatSummary: langChainSummaryEvents[0]
        })

        test.langchainMessages({
          tx,
          chatMsgs: langChainMessageEvents,
          chatSummary: langChainSummaryEvents[0][1]
        })

        tx.end()
        test.end()
      })
    }
  )

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

  t.test(
    'should create langchain events for every invoke call on chat prompt + model + parser with callback',
    (test) => {
      const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
      const cbHandler = BaseCallbackHandler.fromMethods({
        handleChainStart() {}
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
        const langChainMessageEvents = filterLangchainMessages(
          langchainEvents,
          'LlmChatCompletionMessage'
        )
        const langChainSummaryEvents = filterLangchainMessages(
          langchainEvents,
          'LlmChatCompletionSummary'
        )

        test.langchainSummary({
          tx,
          chatSummary: langChainSummaryEvents[0],
          withCallback: cbHandler
        })

        test.langchainMessages({
          tx,
          chatMsgs: langChainMessageEvents,
          chatSummary: langChainSummaryEvents[0][1],
          withCallback: cbHandler
        })

        tx.end()
        test.end()
      })
    }
  )

  t.test('should not create langchain events when not in a transaction', async (test) => {
    const { agent, prompt, outputParser, model } = t.context

    const input = { topic: 'scientist' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    const chain = prompt.pipe(model).pipe(outputParser)
    await chain.invoke(input, options)

    const events = agent.customEventAggregator.events.toArray()
    test.equal(events.length, 0, 'should not create langchain events')
    test.end()
  })

  t.test('should add llm attribute to transaction', (test) => {
    const { agent, prompt, model } = t.context

    const input = { topic: 'scientist' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    helper.runInTransaction(agent, async (tx) => {
      const chain = prompt.pipe(model)
      await chain.invoke(input, options)

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attributes.llm, true)

      tx.end()
      test.end()
    })
  })

  t.test('should create span on successful runnables create', (test) => {
    const { agent, prompt, model } = t.context

    const input = { topic: 'scientist' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    helper.runInTransaction(agent, async (tx) => {
      const chain = prompt.pipe(model)
      const result = await chain.invoke(input, options)

      t.ok(result)
      t.assertSegments(tx.trace.root, ['Llm/agent/Langchain/invoke'], { exact: false })

      tx.end()
      test.end()
    })
  })
})
