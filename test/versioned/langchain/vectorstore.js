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
  assertLangChainVectorSearch,
  assertLangChainVectorSearchResult,
  filterLangchainEvents,
  filterLangchainEventsByType
} = require('./common')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')

/**
 * Runs the common vectorstore test suite
 * @param {object} config Configuration for the test suite
 * @param {string} config.searchQuery The query string to use for similarity search
 * @param {string} [config.expectedQuery] The expected query in assertions (defaults to searchQuery)
 * @param {string} [config.expectedPageContent] The expected page content in vector search results
 * @param {object} [config.errorAssertion] Custom error assertion function
 */
function runVectorstoreTests(config) {
  const {
    searchQuery,
    expectedQuery = searchQuery,
    expectedPageContent,
    errorAssertion
  } = config

  test('should log tracking metrics', function(t, end) {
    t.plan(5)
    const { agent, langchainCoreVersion, vs } = t.nr
    helper.runInTransaction(agent, async () => {
      await vs.similaritySearch(searchQuery, 1)
      assertPackageMetrics({
        agent,
        pkg: '@langchain/core',
        version: langchainCoreVersion,
        subscriberType: true
      }, { assert: t.assert })
      end()
    })
  })

  test('should create vectorstore events for every similarity search call', (t, end) => {
    const { agent, vs } = t.nr

    helper.runInNamedTransaction(agent, async (tx) => {
      await vs.similaritySearch(searchQuery, 1)

      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 3, 'should create 3 events')

      const langchainEvents = events.filter((event) => {
        const [, chainEvent] = event
        return chainEvent.vendor === 'langchain'
      })

      assert.equal(langchainEvents.length, 2, 'should create 2 langchain events')

      tx.end()
      end()
    })
  })

  test('should create span on successful vectorstore create', (t, end) => {
    const { agent, vs } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const result = await vs.similaritySearch(searchQuery, 1)
      assert.ok(result)
      assertSegments(tx.trace, tx.trace.root, ['Llm/vectorstore/LangChain/similaritySearch'], {
        exact: false
      })
      tx.end()
      assertSpanKind({ agent, segments: [{ name: 'Llm/vectorstore/LangChain/similaritySearch', kind: 'internal' }] })
      end()
    })
  })

  test('should increment tracking metric for each langchain vectorstore event', async (t) => {
    const plan = tspl(t, { plan: 1 })
    const { agent, vs } = t.nr

    await helper.runInTransaction(agent, async (tx) => {
      await vs.similaritySearch(searchQuery, 1)

      // `@langchain/community` and provider packages have diverged on the `@langchain/core`
      // version. Find the right one that has a call count

      for (const metric in agent.metrics._metrics.unscoped) {
        if (metric.startsWith('Supportability/Nodejs/ML/LangChain')) {
          plan.equal(agent.metrics._metrics.unscoped[metric].callCount > 0, true)
        }
      }
      tx.end()
    })
    await plan.completed
  })

  test('should create vectorstore events for every similarity search call with embeddings', (t, end) => {
    const { agent, vs } = t.nr

    helper.runInNamedTransaction(agent, async (tx) => {
      await vs.similaritySearch(searchQuery, 1)

      const events = agent.customEventAggregator.events.toArray()
      const langchainEvents = filterLangchainEvents(events)

      const vectorSearchResultEvents = filterLangchainEventsByType(
        langchainEvents,
        'LlmVectorSearchResult'
      )

      const vectorSearchEvents = filterLangchainEventsByType(langchainEvents, 'LlmVectorSearch')

      const vectorSearchAssertions = {
        tx,
        vectorSearch: vectorSearchEvents[0],
        responseDocumentSize: 1
      }

      if (expectedQuery) {
        vectorSearchAssertions.expectedQuery = expectedQuery
      }

      assertLangChainVectorSearch(vectorSearchAssertions)

      const vectorSearchResultAssertions = {
        tx,
        vectorSearchResult: vectorSearchResultEvents,
        vectorSearchId: vectorSearchEvents[0][1].id
      }

      if (expectedPageContent) {
        vectorSearchResultAssertions.expectedPageContent = expectedPageContent
      }

      assertLangChainVectorSearchResult(vectorSearchResultAssertions)

      tx.end()
      end()
    })
  })

  test('should create only vectorstore search event for similarity search call with embeddings and invalid metadata filter', (t, end) => {
    const { agent, vs } = t.nr

    helper.runInNamedTransaction(agent, async (tx) => {
      // search for documents with invalid filter
      await vs.similaritySearch(searchQuery, 1, {
        a: 'some filter'
      })

      const events = agent.customEventAggregator.events.toArray()
      const langchainEvents = filterLangchainEvents(events)

      const vectorSearchResultEvents = filterLangchainEventsByType(
        langchainEvents,
        'LlmVectorSearchResult'
      )

      const vectorSearchEvents = filterLangchainEventsByType(langchainEvents, 'LlmVectorSearch')

      // there are no documents in vector store with that filter
      assert.equal(vectorSearchResultEvents.length, 0, 'should have 0 events')

      const vectorSearchAssertions = {
        tx,
        vectorSearch: vectorSearchEvents[0],
        responseDocumentSize: 0
      }

      if (expectedQuery) {
        vectorSearchAssertions.expectedQuery = expectedQuery
      }

      assertLangChainVectorSearch(vectorSearchAssertions)

      tx.end()
      end()
    })
  })

  test('should not create vectorstore events when not in a transaction', async (t) => {
    const { agent, vs } = t.nr

    await vs.similaritySearch(searchQuery, 1)

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not create vectorstore events')
  })

  test('should add llm attribute to transaction', (t, end) => {
    const { agent, vs } = t.nr

    helper.runInTransaction(agent, async (tx) => {
      await vs.similaritySearch(searchQuery, 1)

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      assert.equal(attributes.llm, true)

      tx.end()
      end()
    })
  })

  test('should create error events', (t, end) => {
    const { agent, vs } = t.nr

    helper.runInNamedTransaction(agent, async (tx) => {
      try {
        await vs.similaritySearch('Embedding not allowed.', 1)
      } catch (error) {
        assert.ok(error)
      }

      const events = agent.customEventAggregator.events.toArray()
      // Only LlmEmbedding and LlmVectorSearch events will be created
      // LangChainVectorSearchResult event won't be created since there was an error
      assert.equal(events.length, 2, 'should create 2 events')

      const langchainEvents = events.filter((event) => {
        const [, chainEvent] = event
        return chainEvent.vendor === 'langchain'
      })

      assert.equal(langchainEvents.length, 1, 'should create 1 langchain vectorsearch event')
      assert.equal(langchainEvents[0][1].error, true)

      // But, we should also get two error events: 1xLLM and 1xLangChain
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

  test('should not create llm vectorstore events when ai_monitoring is disabled', (t, end) => {
    const { agent, vs } = t.nr
    agent.config.ai_monitoring.enabled = false

    helper.runInTransaction(agent, async (tx) => {
      await vs.similaritySearch(searchQuery, 1)

      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 0, 'should not create llm events when ai_monitoring is disabled')

      tx.end()
      end()
    })
  })

  test('should not create segment when ai_monitoring is disabled', (t, end) => {
    const { agent, vs } = t.nr
    agent.config.ai_monitoring.enabled = false

    helper.runInTransaction(agent, async (tx) => {
      await vs.similaritySearch(searchQuery, 1)

      const segment = findSegment(tx.trace, tx.trace.root, 'Llm/vectorstore/LangChain/similaritySearch')
      assert.equal(segment, undefined, 'should not create Llm/vectorstore/LangChain/similaritySearch segment when ai_monitoring is disabled')

      tx.end()
      end()
    })
  })
}

module.exports = {
  runVectorstoreTests
}
