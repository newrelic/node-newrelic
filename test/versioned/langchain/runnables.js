/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
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

/**
 * Runs the common runnables test suite
 * @param {object} config Configuration for the test suite
 * @param {object} config.inputData The input data to pass to invoke calls
 * @param {string} [config.expectedInput] Expected input string for assertions
 * @param {string} [config.expectedOutput] Expected output string for assertions
 * @param {string} [config.errorPromptTemplate] The prompt template to trigger errors
 * @param {number} [config.errorEventCount] Expected event count during errors
 * @param {object} [config.errorAssertion] Custom error assertion function
 * @param {object} [config.arrayParserOutput] Expected output for array parser test
 */
function runRunnablesTests(config) {
  const {
    inputData,
    expectedInput,
    expectedOutput,
    errorPromptTemplate,
    errorEventCount = 6,
    errorAssertion,
    arrayParserOutput
  } = config

  test('should log tracking metrics', function(t) {
    const { agent, langchainCoreVersion } = t.nr
    assertPackageMetrics({ agent, pkg: '@langchain/core', version: langchainCoreVersion })
  })

  test('should create langchain events for every invoke call', (t, end) => {
    const { agent, prompt, outputParser, model } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const input = inputData
      const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

      const chain = prompt.pipe(model).pipe(outputParser)
      const result = await chain.invoke(input, options)
      assert.ok(result)

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
    const { agent, prompt, outputParser, model, langchainCoreVersion } = t.nr

    helper.runInTransaction(agent, async (tx) => {
      const input = inputData
      const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

      const chain = prompt.pipe(model).pipe(outputParser)
      await chain.invoke(input, options)

      const metrics = agent.metrics.getOrCreateMetric(
        `Supportability/Nodejs/ML/Langchain/${langchainCoreVersion}`
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
        const input = inputData
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
      const input = inputData
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

      const messageAssertions = {
        tx,
        chatMsgs: langChainMessageEvents,
        chatSummary: langChainSummaryEvents[0][1]
      }

      if (expectedInput) {
        messageAssertions.input = expectedInput
      }

      if (expectedOutput) {
        messageAssertions.output = expectedOutput
      }

      assertLangChainChatCompletionMessages(messageAssertions)

      tx.end()
      end()
    })
  })

  test('should create langchain events for every invoke call on chat prompt + model', (t, end) => {
    const { agent, prompt, model } = t.nr

    helper.runInTransaction(agent, async (tx) => {
      const input = inputData
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

      const messageAssertions = {
        tx,
        chatMsgs: langChainMessageEvents,
        chatSummary: langChainSummaryEvents[0][1]
      }

      if (expectedInput) {
        messageAssertions.input = expectedInput
      }

      if (expectedOutput) {
        messageAssertions.output = expectedOutput
      }

      assertLangChainChatCompletionMessages(messageAssertions)

      tx.end()
      end()
    })
  })

  test('should create langchain events for every invoke call with parser that returns an array as output', (t, end) => {
    const { agent, prompt, model, CommaSeparatedListOutputParser } = t.nr

    helper.runInTransaction(agent, async (tx) => {
      const parser = new CommaSeparatedListOutputParser()

      const input = inputData
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

      const messageAssertions = {
        tx,
        chatMsgs: langChainMessageEvents,
        chatSummary: langChainSummaryEvents[0][1]
      }

      if (expectedInput) {
        messageAssertions.input = expectedInput
      }

      if (arrayParserOutput) {
        messageAssertions.output = arrayParserOutput
      }

      assertLangChainChatCompletionMessages(messageAssertions)

      tx.end()
      end()
    })
  })

  test('should add runId when a callback handler exists', (t, end) => {
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
      await chain.invoke(input, options)

      const events = agent.customEventAggregator.events.toArray()

      const langchainEvents = filterLangchainEvents(events)
      assert.equal(langchainEvents[0][1].request_id, runId)

      tx.end()
      end()
    })
  })

  test('should create langchain events for every invoke call on chat prompt + model + parser with callback', (t, end) => {
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

      const messageAssertions = {
        tx,
        chatMsgs: langChainMessageEvents,
        chatSummary: langChainSummaryEvents[0][1],
        withCallback: cbHandler
      }

      if (expectedInput) {
        messageAssertions.input = expectedInput
      }

      if (expectedOutput) {
        messageAssertions.output = expectedOutput
      }

      assertLangChainChatCompletionMessages(messageAssertions)

      tx.end()
      end()
    })
  })

  test('should not create langchain events when not in a transaction', async (t) => {
    const { agent, prompt, outputParser, model } = t.nr

    const input = inputData
    const options = { metadata: { key: 'value', hello: 'world' }, tags: ['tag1', 'tag2'] }

    const chain = prompt.pipe(model).pipe(outputParser)
    await chain.invoke(input, options)

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not create langchain events')
  })

  test('should add llm attribute to transaction', (t, end) => {
    const { agent, prompt, model } = t.nr

    const input = inputData
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

    const input = inputData
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

  test('should use empty string for content property on completion message event when invalid input is used - circular reference', (t, end) => {
    const { agent, prompt, outputParser, model } = t.nr

    helper.runInTransaction(agent, async (tx) => {
      const input = { ...inputData }
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
    const { ChatPromptTemplate, agent, outputParser, model } = t.nr
    const prompt = ChatPromptTemplate.fromMessages([[errorPromptTemplate[0], errorPromptTemplate[1]]])

    helper.runInTransaction(agent, async (tx) => {
      const chain = prompt.pipe(model).pipe(outputParser)

      try {
        await chain.invoke('')
      } catch (error) {
        assert.ok(error)
      }

      // We should still get events as in the success case:
      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, errorEventCount, `should create ${errorEventCount} events`)

      const langchainEvents = events.filter((event) => {
        const [, chainEvent] = event
        return chainEvent.vendor === 'langchain'
      })
      assert.equal(langchainEvents.length, 3, 'should create 3 langchain events')
      const summary = langchainEvents.find((e) => e[0].type === 'LlmChatCompletionSummary')?.[1]
      assert.equal(summary.error, true)

      // But, we should also get error events: 1xLLM and 1xLangChain
      const exceptions = tx.exceptions
      if (errorAssertion) {
        errorAssertion(exceptions)
      } else {
        for (const e of exceptions) {
          assert.ok(e?.customAttributes?.['error.message'])
        }
      }

      tx.end()
      end()
    })
  })

  test('should not create llm runnable events when ai_monitoring is disabled', (t, end) => {
    const { agent, prompt, model } = t.nr
    agent.config.ai_monitoring.enabled = false

    helper.runInTransaction(agent, async (tx) => {
      const input = inputData
      const chain = prompt.pipe(model)
      await chain.invoke(input)

      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 0, 'should not create llm events when ai_monitoring is disabled')

      tx.end()
      end()
    })
  })

  test('should not create segment when ai_monitoring is disabled', (t, end) => {
    const { agent, prompt, model } = t.nr
    agent.config.ai_monitoring.enabled = false

    helper.runInTransaction(agent, async (tx) => {
      const input = inputData
      const chain = prompt.pipe(model)
      const result = await chain.invoke(input)
      assert.ok(result, 'should not mess up result')

      const segment = findSegment(tx.trace, tx.trace.root, 'Llm/chain/Langchain/stream')
      assert.equal(segment, undefined, 'should not create Llm/chain/Langchain/stream segment when ai_monitoring is disabled')

      tx.end()
      end()
    })
  })

  test('should handle metadata and tags properly', (t, end) => {
    const { agent, prompt, model } = t.nr

    helper.runInTransaction(agent, async (tx) => {
      const input = inputData
      const options = {
        metadata: { customKey: 'customValue', anotherKey: 'anotherValue' },
        tags: ['custom-tag1', 'custom-tag2', 'custom-tag3']
      }

      const chain = prompt.pipe(model)
      await chain.invoke(input, options)

      const events = agent.customEventAggregator.events.toArray()
      const langchainEvents = filterLangchainEvents(events)
      const langChainSummaryEvents = filterLangchainEventsByType(
        langchainEvents,
        'LlmChatCompletionSummary'
      )

      const [[, summary]] = langChainSummaryEvents
      assert.equal(summary['metadata.customKey'], 'customValue')
      assert.equal(summary['metadata.anotherKey'], 'anotherValue')

      const tags = summary.tags.split(',')
      assert.ok(tags.includes('custom-tag1'))
      assert.ok(tags.includes('custom-tag2'))
      assert.ok(tags.includes('custom-tag3'))

      tx.end()
      end()
    })
  })
}

module.exports = {
  runRunnablesTests
}
