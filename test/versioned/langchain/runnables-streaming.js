/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')

const { assertPackageMetrics, assertSegments, assertSpanKind } = require('../../lib/custom-assertions')
const { findSegment } = require('../../lib/metrics_helper')
const {
  assertLangChainChatCompletionMessages,
  assertLangChainChatCompletionSummary,
  filterLangchainEvents,
  filterLangchainEventsByType
} = require('./common')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const helper = require('../../lib/agent_helper')

function consumeStreamChunk() {
  // A no-op function used to consume chunks of a stream.
}

/**
 * Runs the common runnables-streaming tests for streaming enabled
 * @param {object} config Configuration for the test suite
 * @param {object} config.inputData The input data to pass to stream calls
 * @param {string} [config.expectedInput] Expected input string for assertions
 * @param {Function} [config.expectedContent] Function to get expected content (optional)
 * @param {object} [config.chunkContentAccess] How to access content from chunks without parser (e.g., 'chunk?.content')
 * @param {object} [config.errorFromInputAssertion] Custom assertion for error from input test
 * @param {object} [config.errorFromStreamAssertion] Custom assertion for error from stream test
 * @param {number} [config.errorFromStreamEventCount] Expected event count for error from stream test
 * @param {number} [config.errorFromStreamLangchainEventCount] Expected langchain event count for error from stream test
 * @param {Array} [config.errorPromptTemplate] The prompt template to trigger errors
 */
function runStreamingEnabledTests(config) {
  const {
    inputData,
    expectedInput,
    expectedContent,
    chunkContentAccess = (chunk) => chunk?.content,
    errorFromInputAssertion,
    errorFromStreamAssertion,
    errorFromStreamEventCount = 6,
    errorFromStreamLangchainEventCount = 3,
    errorPromptTemplate
  } = config

  return async (t) => {
    await t.test('should log tracking metrics', function(t, end) {
      t.plan(5)
      const { agent, langchainCoreVersion, prompt, model } = t.nr
      helper.runInTransaction(agent, async () => {
        await prompt.pipe(model).stream(inputData)
        assertPackageMetrics({
          agent,
          pkg: '@langchain/core',
          version: langchainCoreVersion,
          subscriberType: true
        }, { assert: t.assert })
        end()
      })
    })

    await t.test('should create langchain events for every stream call', (t, end) => {
      const { agent, prompt, outputParser, model } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        const input = inputData

        const chain = prompt.pipe(model).pipe(outputParser)
        const stream = await chain.stream(input)
        let content = ''
        for await (const chunk of stream) {
          content += chunk
        }

        if (expectedContent) {
          const expected = expectedContent()
          assert.equal(content, expected)
        }

        const events = agent.customEventAggregator.events.toArray()
        assert.equal(events.length, 6, 'should create 6 events')

        const langchainEvents = events.filter((event) => {
          const [, chainEvent] = event
          return chainEvent.vendor === 'langchain'
        })
        assert.equal(langchainEvents.length, 3, 'should create 3 langchain events')

        const requestMsg = langchainEvents.filter((msg) => msg[1].is_response === false)[0]
        assert.equal(requestMsg[0].timestamp, requestMsg[1].timestamp, 'time added to event aggregator should equal `timestamp` property')

        const chatSummary = langchainEvents.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
        assert.equal(chatSummary[0].timestamp, chatSummary[1].timestamp, 'time added to event aggregator should equal `timestamp` property')

        tx.end()
        end()
      })
    })

    await t.test(
      'should increment tracking metric for each langchain chat prompt event',
      (t, end) => {
        const { agent, prompt, outputParser, model, langchainCoreVersion } = t.nr

        helper.runInTransaction(agent, async (tx) => {
          const input = inputData

          const chain = prompt.pipe(model).pipe(outputParser)
          const stream = await chain.stream(input)
          for await (const chunk of stream) {
            consumeStreamChunk(chunk)
          }

          const metrics = agent.metrics.getOrCreateMetric(
            `Supportability/Nodejs/ML/LangChain/${langchainCoreVersion}`
          )
          assert.equal(metrics.callCount, 1)

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
          const input = inputData
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

          const messageAssertions = {
            tx,
            chatMsgs: langChainMessageEvents,
            chatSummary: langChainSummaryEvents[0][1],
            output: content
          }

          if (expectedInput) {
            messageAssertions.input = expectedInput
          }

          assertLangChainChatCompletionMessages(messageAssertions)

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
          const input = inputData
          const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

          const chain = prompt.pipe(model)
          const stream = await chain.stream(input, options)
          let content = ''
          for await (const chunk of stream) {
            content += chunkContentAccess(chunk)
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

          const messageAssertions = {
            tx,
            chatMsgs: langChainMessageEvents,
            chatSummary: langChainSummaryEvents[0][1],
            output: content
          }

          if (expectedInput) {
            messageAssertions.input = expectedInput
          }

          assertLangChainChatCompletionMessages(messageAssertions)

          tx.end()
          end()
        })
      }
    )

    await t.test(
      'should create langchain events for every stream call with parser that returns an array as output',
      (t, end) => {
        const { agent, prompt, model, CommaSeparatedListOutputParser } = t.nr

        helper.runInTransaction(agent, async (tx) => {
          const parser = new CommaSeparatedListOutputParser()

          const input = inputData
          const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

          const chain = prompt.pipe(model).pipe(parser)
          const stream = await chain.stream(input, options)
          let content = ''
          for await (const chunk of stream) {
            content += chunk?.[0]
          }
          assert(content.length > 0, 'there should be content in the response')

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

          const messageAssertions = {
            tx,
            chatMsgs: langChainMessageEvents,
            chatSummary: langChainSummaryEvents[0][1],
            output: content
          }

          if (expectedInput) {
            messageAssertions.input = expectedInput
          }

          assertLangChainChatCompletionMessages(messageAssertions)

          tx.end()
          end()
        })
      }
    )

    await t.test('should add runId when a callback handler exists', (t, end) => {
      const { BaseCallbackHandler } = t.nr
      let runId
      const cbHandler = BaseCallbackHandler.fromMethods({
        handleChainStart(...args) {
          runId = args?.[2]
        }
      })

      const { agent, prompt, outputParser, model } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        const input = inputData
        const options = {
          metadata: { key: 'value', hello: 'world' },
          callbacks: [cbHandler],
          tags: ['tag1', 'tag2']
        }

        const chain = prompt.pipe(model).pipe(outputParser)
        const stream = await chain.stream(input, options)
        for await (const chunk of stream) {
          consumeStreamChunk(chunk)
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
        const { BaseCallbackHandler } = t.nr
        const cbHandler = BaseCallbackHandler.fromMethods({
          handleChainStart() {}
        })

        const { agent, prompt, outputParser, model } = t.nr

        helper.runInTransaction(agent, async (tx) => {
          const input = inputData
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

          if (expectedContent) {
            const expected = expectedContent()
            assert.equal(content, expected)
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

          const messageAssertions = {
            tx,
            chatMsgs: langChainMessageEvents,
            chatSummary: langChainSummaryEvents[0][1],
            withCallback: cbHandler,
            output: content
          }

          if (expectedInput) {
            messageAssertions.input = expectedInput
          }

          assertLangChainChatCompletionMessages(messageAssertions)

          tx.end()
          end()
        })
      }
    )

    await t.test('should not create langchain events when not in a transaction', async (t) => {
      const { agent, prompt, outputParser, model } = t.nr

      const input = inputData

      const chain = prompt.pipe(model).pipe(outputParser)
      const stream = await chain.stream(input)
      for await (const chunk of stream) {
        consumeStreamChunk(chunk)
      }

      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 0, 'should not create langchain events')
    })

    await t.test('should add llm attribute to transaction', (t, end) => {
      const { agent, prompt, model } = t.nr

      const input = inputData

      helper.runInTransaction(agent, async (tx) => {
        const chain = prompt.pipe(model)
        const stream = await chain.stream(input)
        for await (const chunk of stream) {
          consumeStreamChunk(chunk)
        }

        const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
        assert.equal(attributes.llm, true)

        tx.end()
        end()
      })
    })

    await t.test('should create span on successful runnables create', (t, end) => {
      const { agent, prompt, model } = t.nr

      const input = inputData

      helper.runInTransaction(agent, async (tx) => {
        const chain = prompt.pipe(model)
        const stream = await chain.stream(input)
        for await (const chunk of stream) {
          consumeStreamChunk(chunk)
        }

        assertSegments(tx.trace, tx.trace.root, ['Llm/chain/LangChain/stream'], { exact: false })
        tx.end()
        assertSpanKind({ agent, segments: [{ name: 'Llm/chain/LangChain/stream', kind: 'internal' }] })
        end()
      })
    })

    await t.test(
      'should use empty string for content property on completion message event when invalid input is used - circular reference',
      (t, end) => {
        const { agent, prompt, outputParser, model } = t.nr

        helper.runInTransaction(agent, async (tx) => {
          const input = { ...inputData }
          input.myself = input

          const chain = prompt.pipe(model).pipe(outputParser)
          const stream = await chain.stream(input)
          for await (const chunk of stream) {
            consumeStreamChunk(chunk)
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
      const { ChatPromptTemplate } = t.nr
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

        const events = agent.customEventAggregator.events.toArray()
        assert.equal(events.length, 2, 'should create 2 events')

        const summary = events.find((e) => e[0].type === 'LlmChatCompletionSummary')?.[1]
        assert.equal(summary.error, true)

        const exceptions = tx.exceptions
        if (errorFromInputAssertion) {
          errorFromInputAssertion(exceptions)
        } else {
          for (const e of exceptions) {
            assert.ok(e.customAttributes?.['error.message'], 'error.message should be set')
          }
        }

        tx.end()
        end()
      })
    })

    await t.test('should create error events when stream fails', (t, end) => {
      const { ChatPromptTemplate } = t.nr
      const prompt = ChatPromptTemplate.fromMessages([[errorPromptTemplate[0], errorPromptTemplate[1]]])
      const { agent, model, outputParser } = t.nr

      helper.runInTransaction(agent, async (tx) => {
        const chain = prompt.pipe(model).pipe(outputParser)

        try {
          const stream = await chain.stream({ topic: 'bad' })
          for await (const chunk of stream) {
            consumeStreamChunk(chunk)
          }
        } catch (error) {
          assert.ok(error)
        }

        const events = agent.customEventAggregator.events.toArray()
        assert.equal(events.length, errorFromStreamEventCount, `should create ${errorFromStreamEventCount} events`)

        const langchainEvents = events.filter((event) => {
          const [, chainEvent] = event
          return chainEvent.vendor === 'langchain'
        })
        assert.equal(langchainEvents.length, errorFromStreamLangchainEventCount, `should create ${errorFromStreamLangchainEventCount} langchain events`)
        const summary = langchainEvents.find((e) => e[0].type === 'LlmChatCompletionSummary')?.[1]
        assert.equal(summary.error, true)

        const exceptions = tx.exceptions
        if (errorFromStreamAssertion) {
          errorFromStreamAssertion(exceptions)
        }

        tx.end()
        end()
      })
    })

    await t.test(
      'should handle metadata properly during stream processing',
      (t, end) => {
        const { agent, prompt, model, outputParser } = t.nr

        helper.runInTransaction(agent, async (tx) => {
          const input = inputData
          const options = {
            metadata: { streamKey: 'streamValue', anotherKey: 'anotherValue' },
            tags: ['stream-tag1', 'stream-tag2']
          }

          const chain = prompt.pipe(model).pipe(outputParser)
          const stream = await chain.stream(input, options)
          for await (const chunk of stream) {
            consumeStreamChunk(chunk)
          }

          const events = agent.customEventAggregator.events.toArray()
          const langchainEvents = filterLangchainEvents(events)
          const langChainSummaryEvents = filterLangchainEventsByType(
            langchainEvents,
            'LlmChatCompletionSummary'
          )

          const [[, summary]] = langChainSummaryEvents
          assert.equal(summary['metadata.streamKey'], 'streamValue')
          assert.equal(summary['metadata.anotherKey'], 'anotherValue')

          const tags = summary.tags.split(',')
          assert.ok(tags.includes('stream-tag1'))
          assert.ok(tags.includes('stream-tag2'))

          tx.end()
          end()
        })
      }
    )

    await t.test(
      'should properly extend segment duration on each stream iteration',
      (t, end) => {
        const { agent, prompt, model, outputParser } = t.nr

        helper.runInTransaction(agent, async (tx) => {
          const input = inputData

          const chain = prompt.pipe(model).pipe(outputParser)
          const stream = await chain.stream(input)

          const [segment] = tx.trace.getChildren(tx.trace.root.id)
          assert.equal(segment.name, 'Llm/chain/LangChain/stream', 'should find the Langchain stream segment')

          let chunkCount = 0
          for await (const chunk of stream) {
            consumeStreamChunk(chunk)
            chunkCount++
          }

          // Segment should have been touched multiple times during streaming
          assert.ok(chunkCount > 1, 'should have received multiple chunks')
          assert.ok(segment.timer.hrDuration)

          tx.end()
          end()
        })
      }
    )
  }
}

/**
 * Runs the streaming disabled test
 * @param {object} config Configuration for the test suite
 * @param {object} config.inputData The input data to pass to stream calls
 * @param {Function} [config.expectedContent] Function to get expected content
 * @param {string} [config.streamingDisabledMessage] Custom message for streaming disabled metric
 */
function runStreamingDisabledTest(config) {
  const {
    inputData,
    expectedContent,
    streamingDisabledMessage = 'should increment streaming disabled'
  } = config

  return async (t) => {
    await t.test(
      'should not create llm events when `ai_monitoring.streaming.enabled` is false',
      (t, end) => {
        const { agent, prompt, outputParser, model, langchainCoreVersion } = t.nr

        helper.runInTransaction(agent, async (tx) => {
          const input = inputData

          const chain = prompt.pipe(model).pipe(outputParser)
          const stream = await chain.stream(input)
          let content = ''
          for await (const chunk of stream) {
            content += chunk
          }

          if (expectedContent) {
            const expected = expectedContent()
            assert.equal(content, expected)
          }

          const events = agent.customEventAggregator.events.toArray()
          assert.equal(events.length, 0, 'should not create llm events when streaming is disabled')
          const metrics = agent.metrics.getOrCreateMetric(
            `Supportability/Nodejs/ML/LangChain/${langchainCoreVersion}`
          )
          assert.equal(metrics.callCount, 1)
          const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
          assert.equal(attributes.llm, true)
          const streamingDisabled = agent.metrics.getOrCreateMetric(
            'Supportability/Nodejs/ML/Streaming/Disabled'
          )
          assert.equal(
            streamingDisabled.callCount,
            2,
            streamingDisabledMessage
          )

          tx.end()
          end()
        })
      }
    )

    await t.test(
      'should still create segment when `ai_monitoring.streaming.enabled` is false',
      (t, end) => {
        const { agent, prompt, outputParser, model } = t.nr
        agent.config.ai_monitoring.streaming.enabled = false

        helper.runInTransaction(agent, async (tx) => {
          const input = inputData

          const chain = prompt.pipe(model).pipe(outputParser)
          const stream = await chain.stream(input)
          for await (const chunk of stream) {
            consumeStreamChunk(chunk)
          }

          const segment = findSegment(tx.trace, tx.trace.root, 'Llm/chain/LangChain/stream')
          assert.ok(segment, 'should still create Llm/chain/LangChain/stream segment when ai_monitoring.streaming is disabled')

          tx.end()
          end()
        })
      }
    )
  }
}

/**
 * Runs the ai_monitoring disabled tests
 * @param {object} config Configuration for the test suite
 * @param {object} config.inputData The input data to pass to stream calls
 * @param {Function} [config.expectedContent] Function to get expected content
 */
function runAiMonitoringDisabledTests(config) {
  const { inputData, expectedContent } = config

  function consumeStreamChunk() {
    // A no-op function used to consume chunks of a stream.
  }

  return async (t) => {
    await t.test(
      'should not create llm events when `ai_monitoring.enabled` is false',
      (t, end) => {
        const { agent, prompt, outputParser, model } = t.nr
        agent.config.ai_monitoring.enabled = false

        helper.runInTransaction(agent, async (tx) => {
          const input = inputData

          const chain = prompt.pipe(model).pipe(outputParser)
          const stream = await chain.stream(input)
          let content = ''
          for await (const chunk of stream) {
            content += chunk
          }

          if (expectedContent) {
            const expected = expectedContent()
            assert.equal(content, expected)
          }

          const events = agent.customEventAggregator.events.toArray()
          assert.equal(events.length, 0, 'should not create llm events when ai_monitoring is disabled')

          tx.end()
          end()
        })
      }
    )

    await t.test(
      'should not create segment when `ai_monitoring.enabled` is false',
      (t, end) => {
        const { agent, prompt, outputParser, model } = t.nr
        agent.config.ai_monitoring.enabled = false

        helper.runInTransaction(agent, async (tx) => {
          const input = inputData

          const chain = prompt.pipe(model).pipe(outputParser)
          const stream = await chain.stream(input)
          for await (const chunk of stream) {
            consumeStreamChunk(chunk)
          }

          const segment = findSegment(tx.trace, tx.trace.root, 'Llm/chain/LangChain/stream')
          assert.equal(segment, undefined, 'should not create Llm/chain/LangChain/stream segment when ai_monitoring is disabled')

          tx.end()
          end()
        })
      }
    )
  }
}

module.exports = {
  runStreamingEnabledTests,
  runStreamingDisabledTest,
  runAiMonitoringDisabledTests
}
