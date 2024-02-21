/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
// load the assertSegments assertion
require('../../lib/metrics_helper')
const { filterLangchainEvents } = require('./common')
const { version: pkgVersion } = require('@langchain/core/package.json')
const createOpenAIMockServer = require('../openai/mock-server')
const config = {
  ai_monitoring: {
    enabled: true
  },
  feature_flag: {
    langchain_instrumentation: true
  }
}

const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

tap.test('Langchain instrumentation - runnable sequence', (t) => {
  t.autoend()

  t.beforeEach(async (t) => {
    const { host, port, server } = await createOpenAIMockServer()
    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent(config)
    const { ChatPromptTemplate } = require('@langchain/core/prompts')
    const { StringOutputParser } = require('@langchain/core/output_parsers')
    const { ChatOpenAI } = require('@langchain/openai')

    t.context.prompt = ChatPromptTemplate.fromMessages([['assistant', 'You are a {topic}.']])
    t.context.model = new ChatOpenAI({
      openAIApiKey: 'fake-key',
      configuration: {
        baseURL: `http://${host}:${port}`
      }
    })
    t.context.outputParser = new StringOutputParser()
  })

  t.afterEach(async (t) => {
    t.context?.server?.close()
    helper.unloadAgent(t.context.agent)
    // bust the require-cache so it can re-instrument
    Object.keys(require.cache).forEach((key) => {
      if (key.includes('@langchain/core') || key.includes('openai')) {
        delete require.cache[key]
      }
    })
  })

  t.test('should create langchain events for every invoke call', (t) => {
    const { agent, prompt, outputParser, model } = t.context

    helper.runInTransaction(agent, async (tx) => {
      const input = { topic: 'scientist' }
      const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

      const chain = prompt.pipe(model).pipe(outputParser)
      await chain.invoke(input, options)

      const events = agent.customEventAggregator.events.toArray()
      t.equal(events.length, 3, 'should create 3 langchain events')

      tx.end()
      t.end()
    })
  })

  t.test('should increment tracking metric for each langchain chat prompt event', (t) => {
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
      t.end()
    })
  })

  t.test(
    'should create langchain events for every invoke call on chat prompt + model + parser',
    (t) => {
      const { agent, prompt, outputParser, model } = t.context

      helper.runInTransaction(agent, async (tx) => {
        const input = { topic: 'scientist' }
        const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

        const chain = prompt.pipe(model).pipe(outputParser)
        await chain.invoke(input, options)

        const events = agent.customEventAggregator.events.toArray()

        const langChainMessageEvents = filterLangchainEvents(events, 'LlmChatCompletionMessage')
        const langChainSummaryEvents = filterLangchainEvents(events, 'LlmChatCompletionSummary')

        t.langchainSummary({
          tx,
          chatSummary: langChainSummaryEvents[0]
        })

        t.langchainMessages({
          tx,
          chatMsgs: langChainMessageEvents,
          chatSummary: langChainSummaryEvents[0][1]
        })

        tx.end()
        t.end()
      })
    }
  )

  t.test('should create langchain events for every invoke call on chat prompt + model', (t) => {
    const { agent, prompt, model } = t.context

    helper.runInTransaction(agent, async (tx) => {
      const input = { topic: 'scientist' }
      const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

      const chain = prompt.pipe(model)
      await chain.invoke(input, options)

      const events = agent.customEventAggregator.events.toArray()
      const langChainMessageEvents = filterLangchainEvents(events, 'LlmChatCompletionMessage')
      const langChainSummaryEvents = filterLangchainEvents(events, 'LlmChatCompletionSummary')

      t.langchainSummary({
        tx,
        chatSummary: langChainSummaryEvents[0]
      })

      t.langchainMessages({
        tx,
        chatMsgs: langChainMessageEvents,
        chatSummary: langChainSummaryEvents[0][1]
      })

      tx.end()
      t.end()
    })
  })

  t.test(
    'should create langchain events for every invoke call with parser that returns an array as output',
    (t) => {
      const { CommaSeparatedListOutputParser } = require('@langchain/core/output_parsers')
      const { agent, prompt, model } = t.context

      helper.runInTransaction(agent, async (tx) => {
        const parser = new CommaSeparatedListOutputParser()

        const input = { topic: 'scientist' }
        const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

        const chain = prompt.pipe(model).pipe(parser)
        await chain.invoke(input, options)

        const events = agent.customEventAggregator.events.toArray()

        const langChainMessageEvents = filterLangchainEvents(events, 'LlmChatCompletionMessage')
        const langChainSummaryEvents = filterLangchainEvents(events, 'LlmChatCompletionSummary')

        t.langchainSummary({
          tx,
          chatSummary: langChainSummaryEvents[0]
        })

        t.langchainMessages({
          tx,
          chatMsgs: langChainMessageEvents,
          chatSummary: langChainSummaryEvents[0][1]
        })

        tx.end()
        t.end()
      })
    }
  )

  t.test('should add runId when a callback handler exists', (t) => {
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
      t.equal(events[0][1].request_id, runId)

      tx.end()
      t.end()
    })
  })

  t.test(
    'should create langchain events for every invoke call on chat prompt + model + parser with callback',
    (t) => {
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

        const langChainMessageEvents = filterLangchainEvents(events, 'LlmChatCompletionMessage')
        const langChainSummaryEvents = filterLangchainEvents(events, 'LlmChatCompletionSummary')

        t.langchainSummary({
          tx,
          chatSummary: langChainSummaryEvents[0],
          withCallback: cbHandler
        })

        t.langchainMessages({
          tx,
          chatMsgs: langChainMessageEvents,
          chatSummary: langChainSummaryEvents[0][1],
          withCallback: cbHandler
        })

        tx.end()
        t.end()
      })
    }
  )

  t.test('should not create langchain events when not in a transaction', async (t) => {
    const { agent, prompt, outputParser, model } = t.context

    const input = { topic: 'scientist' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    const chain = prompt.pipe(model).pipe(outputParser)
    await chain.invoke(input, options)

    const events = agent.customEventAggregator.events.toArray()
    t.equal(events.length, 0, 'should not create langchain events')
    t.end()
  })

  t.test('should add llm attribute to transaction', (t) => {
    const { agent, prompt, model } = t.context

    const input = { topic: 'scientist' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    helper.runInTransaction(agent, async (tx) => {
      const chain = prompt.pipe(model)
      await chain.invoke(input, options)

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attributes.llm, true)

      tx.end()
      t.end()
    })
  })

  t.test('should create span on successful runnables create', (t) => {
    const { agent, prompt, model } = t.context

    const input = { topic: 'scientist' }
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    helper.runInTransaction(agent, async (tx) => {
      const chain = prompt.pipe(model)
      const result = await chain.invoke(input, options)

      t.ok(result)
      t.assertSegments(tx.trace.root, ['Llm/agent/Langchain/invoke'], { exact: false })

      tx.end()
      t.end()
    })
  })
})
