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
const createOpenAIMockServer = require('../openai/mock-server')
const { filterLangchainEvents, filterLangchainEventsByType } = require('./common')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const params = require('../../lib/params')
const { Document } = require('@langchain/core/documents')

const config = {
  ai_monitoring: {
    enabled: true
  }
}

tap.test('Langchain instrumentation - vectorstore', (t) => {
  t.autoend()

  t.beforeEach(async (t) => {
    const { host, port, server } = await createOpenAIMockServer()
    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent(config)
    const { OpenAIEmbeddings } = require('@langchain/openai')

    const { Client } = require('@elastic/elasticsearch')
    const clientArgs = {
      client: new Client({
        node: `http://${params.elastic_host}:${params.elastic_port}`
      })
    }
    const { ElasticVectorSearch } = require('@langchain/community/vectorstores/elasticsearch')

    t.context.embedding = new OpenAIEmbeddings({
      openAIApiKey: 'fake-key',
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
    const vectorStore = new ElasticVectorSearch(t.context.embedding, clientArgs)
    await vectorStore.deleteIfExists()
    await vectorStore.addDocuments(docs)
    t.context.vs = vectorStore
  })

  t.afterEach(async (t) => {
    t.context?.server?.close()
    helper.unloadAgent(t.context.agent)
    // bust the require-cache so it can re-instrument
    Object.keys(require.cache).forEach((key) => {
      if (
        key.includes('@langchain/core') ||
        key.includes('openai') ||
        key.includes('@elastic') ||
        key.includes('@langchain/community')
      ) {
        delete require.cache[key]
      }
    })
  })

  t.test('should create vectorstore events for every similarity search call', (t) => {
    const { agent, vs } = t.context

    helper.runInNamedTransaction(agent, async (tx) => {
      await vs.similaritySearch('This is an embedding test.', 1)

      const events = agent.customEventAggregator.events.toArray()
      t.equal(events.length, 3, 'should create 3 events')

      const langchainEvents = events.filter((event) => {
        const [, chainEvent] = event
        return chainEvent.vendor === 'langchain'
      })

      t.equal(langchainEvents.length, 2, 'should create 2 langchain events')

      tx.end()
      t.end()
    })
  })

  t.test('should create span on successful vectorstore create', (t) => {
    const { agent, vs } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const result = await vs.similaritySearch('This is an embedding test.', 1)
      t.ok(result)
      t.assertSegments(tx.trace.root, ['Llm/vectorstore/Langchain/similaritySearch'], {
        exact: false
      })
      tx.end()
      t.end()
    })
  })

  t.test('should increment tracking metric for each langchain vectorstore event', (t) => {
    const { agent, vs } = t.context

    helper.runInTransaction(agent, async (tx) => {
      await vs.similaritySearch('This is an embedding test.', 1)

      const metrics = agent.metrics.getOrCreateMetric(
        `Supportability/Nodejs/ML/Langchain/${pkgVersion}`
      )
      t.equal(metrics.callCount > 0, true)

      tx.end()
      t.end()
    })
  })

  t.test(
    'should create vectorstore events for every similarity search call with embeddings',
    (t) => {
      const { agent, vs } = t.context

      helper.runInNamedTransaction(agent, async (tx) => {
        await vs.similaritySearch('This is an embedding test.', 1)

        const events = agent.customEventAggregator.events.toArray()
        const langchainEvents = filterLangchainEvents(events)

        const vectorSearchResultEvents = filterLangchainEventsByType(
          langchainEvents,
          'LlmVectorSearchResult'
        )

        const vectorSearchEvents = filterLangchainEventsByType(langchainEvents, 'LlmVectorSearch')

        t.langchainVectorSearch({
          tx,
          vectorSearch: vectorSearchEvents[0],
          responseDocumentSize: 1
        })
        t.langchainVectorSearchResult({
          tx,
          vectorSearchResult: vectorSearchResultEvents,
          vectorSearchId: vectorSearchEvents[0][1].id
        })

        tx.end()
        t.end()
      })
    }
  )

  t.test(
    'should create only vectorstore search event for similarity search call with embeddings and invalid metadata filter',
    (t) => {
      const { agent, vs } = t.context

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
        t.equal(vectorSearchResultEvents.length, 0, 'should have 0 events')
        t.langchainVectorSearch({
          tx,
          vectorSearch: vectorSearchEvents[0],
          responseDocumentSize: 0
        })

        tx.end()
        t.end()
      })
    }
  )

  t.test('should not create vectorstore events when not in a transaction', async (t) => {
    const { agent, vs } = t.context

    await vs.similaritySearch('This is an embedding test.', 1)

    const events = agent.customEventAggregator.events.toArray()
    t.equal(events.length, 0, 'should not create vectorstore events')
    t.end()
  })

  t.test('should add llm attribute to transaction', (t) => {
    const { agent, vs } = t.context

    helper.runInTransaction(agent, async (tx) => {
      await vs.similaritySearch('This is an embedding test.', 1)

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attributes.llm, true)

      tx.end()
      t.end()
    })
  })

  t.test('should create error events', (t) => {
    const { agent, vs } = t.context

    helper.runInNamedTransaction(agent, async (tx) => {
      try {
        await vs.similaritySearch('Embedding not allowed.', 1)
      } catch (error) {
        t.ok(error)
      }

      const events = agent.customEventAggregator.events.toArray()
      // Only LlmEmbedding and LlmVectorSearch events will be created
      // LangChainVectorSearchResult event won't be created since there was an error
      t.equal(events.length, 2, 'should create 2 events')

      const langchainEvents = events.filter((event) => {
        const [, chainEvent] = event
        return chainEvent.vendor === 'langchain'
      })

      t.equal(langchainEvents.length, 1, 'should create 1 langchain vectorsearch event')
      t.equal(langchainEvents[0][1].error, true)

      // But, we should also get two error events: 1xLLM and 1xLangChain
      const exceptions = tx.exceptions
      for (const e of exceptions) {
        const str = Object.prototype.toString.call(e.customAttributes)
        t.equal(str, '[object LlmErrorMessage]')
      }

      tx.end()
      t.end()
    })
  })
})
