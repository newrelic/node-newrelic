/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { assertSegments, assertSpanKind } = require('../../lib/custom-assertions')
const {
  assertLangChainVectorSearch,
  assertLangChainVectorSearchResult,
  filterLangchainEvents,
  filterLangchainEventsByType
} = require('./common')
const { Document } = require('@langchain/core/documents')
const createOpenAIMockServer = require('../openai/mock-server')
const params = require('../../lib/params')
const helper = require('../../lib/agent_helper')

const config = {
  ai_monitoring: {
    enabled: true
  }
}
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const { tspl } = require('@matteo.collina/tspl')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { host, port, server } = await createOpenAIMockServer()
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent(config)
  const { OpenAIEmbeddings } = require('@langchain/openai')

  const { Client } = require('@elastic/elasticsearch')
  const clientArgs = {
    client: new Client({
      node: `http://${params.elastic_host}:${params.elastic_port}`
    })
  }
  const { ElasticVectorSearch } = require('@langchain/community/vectorstores/elasticsearch')

  ctx.nr.embedding = new OpenAIEmbeddings({
    apiKey: 'fake-key',
    configuration: {
      baseURL: `http://${host}:${port}`
    }
  })
  const docs = [
    new Document({
      metadata: { id: '2' },
      pageContent: 'This is an embedding test.'
    })
  ]
  const vectorStore = new ElasticVectorSearch(ctx.nr.embedding, clientArgs)
  await vectorStore.deleteIfExists()
  await vectorStore.addDocuments(docs)
  ctx.nr.vs = vectorStore
})

test.afterEach(async (ctx) => {
  ctx.nr?.server?.close()
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core', 'openai', '@elastic', '@langchain/community'])
})

test('should create vectorstore events for every similarity search call', (t, end) => {
  const { agent, vs } = t.nr

  helper.runInNamedTransaction(agent, async (tx) => {
    await vs.similaritySearch('This is an embedding test.', 1)

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
    const result = await vs.similaritySearch('This is an embedding test.', 1)
    assert.ok(result)
    assertSegments(tx.trace, tx.trace.root, ['Llm/vectorstore/Langchain/similaritySearch'], {
      exact: false
    })
    tx.end()
    assertSpanKind({ agent, segments: [{ name: 'Llm/vectorstore/Langchain/similaritySearch', kind: 'internal' }] })
    end()
  })
})

test('should increment tracking metric for each langchain vectorstore event', async (t) => {
  const plan = tspl(t, { plan: 1 })
  const { agent, vs } = t.nr

  await helper.runInTransaction(agent, async (tx) => {
    await vs.similaritySearch('This is an embedding test.', 1)

    // `@langchain/community` and `@langchain/openai` have diverged on the `@langchain/core`
    // version. Find the right one that has a call count

    for (const metric in agent.metrics._metrics.unscoped) {
      if (metric.startsWith('Supportability/Nodejs/ML/Langchain')) {
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
    await vs.similaritySearch('This is an embedding test.', 1)

    const events = agent.customEventAggregator.events.toArray()
    const langchainEvents = filterLangchainEvents(events)

    const vectorSearchResultEvents = filterLangchainEventsByType(
      langchainEvents,
      'LlmVectorSearchResult'
    )

    const vectorSearchEvents = filterLangchainEventsByType(langchainEvents, 'LlmVectorSearch')

    assertLangChainVectorSearch({
      tx,
      vectorSearch: vectorSearchEvents[0],
      responseDocumentSize: 1
    })
    assertLangChainVectorSearchResult({
      tx,
      vectorSearchResult: vectorSearchResultEvents,
      vectorSearchId: vectorSearchEvents[0][1].id
    })

    tx.end()
    end()
  })
})

test('should create only vectorstore search event for similarity search call with embeddings and invalid metadata filter', (t, end) => {
  const { agent, vs } = t.nr

  helper.runInNamedTransaction(agent, async (tx) => {
    // search for documents with invalid filter
    await vs.similaritySearch('This is an embedding test.', 1, {
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
    assertLangChainVectorSearch({
      tx,
      vectorSearch: vectorSearchEvents[0],
      responseDocumentSize: 0
    })

    tx.end()
    end()
  })
})

test('should not create vectorstore events when not in a transaction', async (t) => {
  const { agent, vs } = t.nr

  await vs.similaritySearch('This is an embedding test.', 1)

  const events = agent.customEventAggregator.events.toArray()
  assert.equal(events.length, 0, 'should not create vectorstore events')
})

test('should add llm attribute to transaction', (t, end) => {
  const { agent, vs } = t.nr

  helper.runInTransaction(agent, async (tx) => {
    await vs.similaritySearch('This is an embedding test.', 1)

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
    for (const e of exceptions) {
      const str = Object.prototype.toString.call(e.customAttributes)
      assert.equal(str, '[object LlmErrorMessage]')
    }

    tx.end()
    end()
  })
})
