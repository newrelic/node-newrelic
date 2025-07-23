/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { assertSegments, assertSpanKind, match } = require('../../lib/custom-assertions')
const {
  assertLangChainChatCompletionMessages,
  assertLangChainChatCompletionSummary,
  filterLangchainEvents,
  filterLangchainEventsByType
} = require('./common')
const { version: pkgVersion } = require('@langchain/core/package.json')
const createOpenAIMockServer = require('../openai/mock-server')
const mockResponses = require('../openai/mock-chat-api-responses')
const helper = require('../../lib/agent_helper')

const config = {
  ai_monitoring: {
    enabled: true
  }
}
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

function consumeStreamChunk() {
  // A no-op function used to consume chunks of a stream.
}

async function beforeEach({ enabled, ctx }) {
  ctx.nr = {}
  const { host, port, server } = await createOpenAIMockServer()
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent(config)
  ctx.nr.agent.config.ai_monitoring.streaming.enabled = enabled
  const { ChatPromptTemplate } = require('@langchain/core/prompts')
  const { StringOutputParser } = require('@langchain/core/output_parsers')
  const { ChatOpenAI } = require('@langchain/openai')

  ctx.nr.prompt = ChatPromptTemplate.fromMessages([['assistant', '{topic} response']])
  ctx.nr.model = new ChatOpenAI({
    apiKey: 'fake-key',
    maxRetries: 0,
    configuration: {
      baseURL: `http://${host}:${port}`
    }
  })
  ctx.nr.outputParser = new StringOutputParser()
}

async function afterEach(ctx) {
  ctx.nr?.server?.close()
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core', 'openai'])
}

test('streaming enabled', async (t) => {
  t.beforeEach((ctx) => beforeEach({ enabled: true, ctx }))
  t.afterEach((ctx) => afterEach(ctx))

  await t.test('should create langchain events for every stream call', (t, end) => {
    const { agent, prompt, outputParser, model } = t.nr

    helper.runInTransaction(agent, async (tx) => {
      const input = { topic: 'Streamed' }

      const chain = prompt.pipe(model).pipe(outputParser)
      const stream = await chain.stream(input)
      let content = ''
      for await (const chunk of stream) {
        content += chunk
      }

      const { streamData: expectedContent } = mockResponses.get('Streamed response')
      assert.equal(content, expectedContent)
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

  await t.test(
    'should increment tracking metric for each langchain chat prompt event',
    (t, end) => {
      const { agent, prompt, outputParser, model } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        const input = { topic: 'Streamed' }

        const chain = prompt.pipe(model).pipe(outputParser)
        const stream = await chain.stream(input)
        for await (const chunk of stream) {
          consumeStreamChunk(chunk)
        }

        const metrics = agent.metrics.getOrCreateMetric(
          `Supportability/Nodejs/ML/Langchain/${pkgVersion}`
        )
        assert.equal(metrics.callCount > 0, true)

        tx.end()
        end()
      })
    }
  )

  await t.test(
    'should create langchain events for every stream call on chat prompt + model + parser',
    (t, end) => {
      const { agent, prompt, outputParser, model } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        const input = { topic: 'Streamed' }
        const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

        const chain = prompt.pipe(model).pipe(outputParser)
        const stream = await chain.stream(input, options)
        let content = ''
        for await (const chunk of stream) {
          content += chunk
        }

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
          input: '{"topic":"Streamed"}',
          output: content
        })

        tx.end()
        end()
      })
    }
  )

  await t.test(
    'should create langchain events for every stream call on chat prompt + model',
    (t, end) => {
      const { agent, prompt, model } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        const input = { topic: 'Streamed' }
        const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

        const chain = prompt.pipe(model)
        const stream = await chain.stream(input, options)
        let content = ''
        for await (const chunk of stream) {
          content += chunk
        }

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
          input: '{"topic":"Streamed"}',
          output: content
        })

        tx.end()
        end()
      })
    }
  )

  await t.test(
    'should create langchain events for every stream call with parser that returns an array as output',
    (t, end) => {
      const { CommaSeparatedListOutputParser } = require('@langchain/core/output_parsers')
      const { agent, prompt, model } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        const parser = new CommaSeparatedListOutputParser()

        const input = { topic: 'Streamed' }
        const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

        const chain = prompt.pipe(model).pipe(parser)
        const stream = await chain.stream(input, options)
        let content = ''
        for await (const chunk of stream) {
          content += chunk
        }

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
          input: '{"topic":"Streamed"}',
          output: content
        })

        tx.end()
        end()
      })
    }
  )

  await t.test('should add runId when a callback handler exists', (t, end) => {
    const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
    let runId
    const cbHandler = BaseCallbackHandler.fromMethods({
      handleChainStart(...args) {
        runId = args?.[2]
      }
    })

    const { agent, prompt, outputParser, model } = t.nr

    helper.runInTransaction(agent, async (tx) => {
      const input = { topic: 'Streamed' }
      const options = {
        metadata: { key: 'value', hello: 'world' },
        callbacks: [cbHandler],
        tags: ['tag1', 'tag2']
      }

      const chain = prompt.pipe(model).pipe(outputParser)
      const stream = await chain.stream(input, options)
      for await (const chunk of stream) {
        consumeStreamChunk(chunk)
        // no-op
      }

      const events = agent.customEventAggregator.events.toArray()

      const langchainEvents = filterLangchainEvents(events)
      assert.equal(langchainEvents[0][1].request_id, runId)

      tx.end()
      end()
    })
  })

  await t.test(
    'should create langchain events for every stream call on chat prompt + model + parser with callback',
    (t, end) => {
      const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
      const cbHandler = BaseCallbackHandler.fromMethods({
        handleChainStart() {}
      })

      const { agent, prompt, outputParser, model } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        const input = { topic: 'Streamed' }
        const options = {
          metadata: { key: 'value', hello: 'world' },
          callbacks: [cbHandler],
          tags: ['tag1', 'tag2']
        }

        const chain = prompt.pipe(model).pipe(outputParser)
        const stream = await chain.stream(input, options)

        let content = ''
        for await (const chunk of stream) {
          content += chunk
        }

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
          input: '{"topic":"Streamed"}',
          output: content
        })

        tx.end()
        end()
      })
    }
  )

  await t.test('should not create langchain events when not in a transaction', async (t) => {
    const { agent, prompt, outputParser, model } = t.nr

    const input = { topic: 'Streamed' }

    const chain = prompt.pipe(model).pipe(outputParser)
    const stream = await chain.stream(input)
    for await (const chunk of stream) {
      consumeStreamChunk(chunk)
      // no-op
    }

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not create langchain events')
  })

  await t.test('should add llm attribute to transaction', (t, end) => {
    const { agent, prompt, model } = t.nr

    const input = { topic: 'Streamed' }

    helper.runInTransaction(agent, async (tx) => {
      const chain = prompt.pipe(model)
      const stream = await chain.stream(input)
      for await (const chunk of stream) {
        consumeStreamChunk(chunk)
        // no-op
      }

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      assert.equal(attributes.llm, true)

      tx.end()
      end()
    })
  })

  await t.test('should create span on successful runnables create', (t, end) => {
    const { agent, prompt, model } = t.nr

    const input = { topic: 'Streamed' }

    helper.runInTransaction(agent, async (tx) => {
      const chain = prompt.pipe(model)
      const stream = await chain.stream(input)
      for await (const chunk of stream) {
        consumeStreamChunk(chunk)
        // no-op
      }

      assertSegments(tx.trace, tx.trace.root, ['Llm/chain/Langchain/stream'], { exact: false })
      tx.end()
      assertSpanKind({ agent, segments: [{ name: 'Llm/chain/Langchain/stream', kind: 'internal' }] })
      end()
    })
  })

  // testing JSON.stringify on request (input) during creation of LangChainCompletionMessage event
  await t.test(
    'should use empty string for content property on completion message event when invalid input is used - circular reference',
    (t, end) => {
      const { agent, prompt, outputParser, model } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        const input = { topic: 'Streamed' }
        input.myself = input

        const chain = prompt.pipe(model).pipe(outputParser)
        const stream = await chain.stream(input)
        for await (const chunk of stream) {
          consumeStreamChunk(chunk)
          // no-op
        }

        const events = agent.customEventAggregator.events.toArray()

        const langchainEvents = filterLangchainEvents(events)
        const langChainMessageEvents = filterLangchainEventsByType(
          langchainEvents,
          'LlmChatCompletionMessage'
        )

        const msgEventEmptyContent = langChainMessageEvents.filter(
          (event) => event[1].content === ''
        )

        assert.equal(
          msgEventEmptyContent.length,
          1,
          'should have 1 event with empty content property'
        )

        tx.end()
        end()
      })
    }
  )

  await t.test('should create error events from input', (t, end) => {
    const { ChatPromptTemplate } = require('@langchain/core/prompts')
    const prompt = ChatPromptTemplate.fromMessages([
      ['assistant', 'tell me short joke about {topic}']
    ])
    const { agent, outputParser, model } = t.nr

    helper.runInTransaction(agent, async (tx) => {
      const chain = prompt.pipe(model).pipe(outputParser)

      try {
        await chain.stream('')
      } catch (error) {
        assert.ok(error)
      }

      // No openai events as it errors before talking to LLM
      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 2, 'should create 2 events')

      const summary = events.find((e) => e[0].type === 'LlmChatCompletionSummary')?.[1]
      assert.equal(summary.error, true)

      // But, we should also get two error events: 1xLLM and 1xLangChain
      const exceptions = tx.exceptions
      for (const e of exceptions) {
        const str = Object.prototype.toString.call(e.customAttributes)
        assert.equal(str, '[object LlmErrorMessage]')
      }

      tx.end()
      end()
    })
  })

  await t.test('should create error events when stream fails', (t, end) => {
    const { ChatPromptTemplate } = require('@langchain/core/prompts')
    const prompt = ChatPromptTemplate.fromMessages([['assistant', '{topic} stream']])
    const { agent, model, outputParser } = t.nr

    helper.runInTransaction(agent, async (tx) => {
      const chain = prompt.pipe(model).pipe(outputParser)

      try {
        const stream = await chain.stream({ topic: 'bad' })
        for await (const chunk of stream) {
          consumeStreamChunk(chunk)
          // no-op
        }
      } catch (error) {
        assert.ok(error)
      }

      // We should still get the same 3xLangChain and 3xLLM events as in the
      // success case:
      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 6, 'should create 6 events')

      const langchainEvents = events.filter((event) => {
        const [, chainEvent] = event
        return chainEvent.vendor === 'langchain'
      })
      assert.equal(langchainEvents.length, 3, 'should create 3 langchain events')
      const summary = langchainEvents.find((e) => e[0].type === 'LlmChatCompletionSummary')?.[1]
      assert.equal(summary.error, true)

      // But, we should also get two error events: 1xLLM and 1xLangChain
      const exceptions = tx.exceptions
      for (const e of exceptions) {
        // skip the socket error as it is not related to LLM
        // this started occurring when openai used undici as the HTTP client
        if (e.error.code === 'UND_ERR_SOCKET') {
          continue
        }
        const str = Object.prototype.toString.call(e.customAttributes)
        assert.equal(str, '[object LlmErrorMessage]')
        match(e, {
          customAttributes: {
            'error.message': /(?:Premature close)|(?:terminated)/,
            completion_id: /\w{32}/
          }
        })
      }
      tx.end()
      end()
    })
  })
})

test('streaming disabled', async (t) => {
  t.beforeEach((ctx) => beforeEach({ enabled: false, ctx }))
  t.afterEach((ctx) => afterEach(ctx))

  await t.test(
    'should not create llm events when `ai_monitoring.streaming.enabled` is false',
    (t, end) => {
      const { agent, prompt, outputParser, model } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        const input = { topic: 'Streamed' }

        const chain = prompt.pipe(model).pipe(outputParser)
        const stream = await chain.stream(input)
        let content = ''
        for await (const chunk of stream) {
          content += chunk
        }

        const { streamData: expectedContent } = mockResponses.get('Streamed response')
        assert.equal(content, expectedContent)
        const events = agent.customEventAggregator.events.toArray()
        assert.equal(events.length, 0, 'should not create llm events when streaming is disabled')
        const metrics = agent.metrics.getOrCreateMetric(
          `Supportability/Nodejs/ML/Langchain/${pkgVersion}`
        )
        assert.equal(metrics.callCount > 0, true)
        const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
        assert.equal(attributes.llm, true)
        const streamingDisabled = agent.metrics.getOrCreateMetric(
          'Supportability/Nodejs/ML/Streaming/Disabled'
        )
        assert.equal(
          streamingDisabled.callCount,
          2,
          'should increment streaming disabled in both langchain and openai'
        )

        tx.end()
        end()
      })
    }
  )
})
