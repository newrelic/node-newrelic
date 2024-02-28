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

const config = {
  ai_monitoring: {
    enabled: true
  },
  feature_flag: {
    langchain_instrumentation: true
  }
}

tap.test('Langchain instrumentation - vectorstore', (t) => {
  t.autoend()

  t.beforeEach(async (t) => {
    const { host, port, server } = await createOpenAIMockServer()
    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent(config)
    const { OpenAIEmbeddings } = require('@langchain/openai')
    const { MemoryVectorStore } = require('langchain/vectorstores/memory')

    t.context.embedding = new OpenAIEmbeddings({
      openAIApiKey: 'fake-key',
      configuration: {
        baseURL: `http://${host}:${port}`
      }
    })

    t.context.vs = await MemoryVectorStore.fromTexts(
      ['This is an embedding test.'],
      [{ id: 2 }],
      t.context.embedding
    )
  })

  t.afterEach(async (t) => {
    t.context?.server?.close()
    helper.unloadAgent(t.context.agent)
    // bust the require-cache so it can re-instrument
    Object.keys(require.cache).forEach((key) => {
      if (key.includes('@langchain/core') || key.includes('openai') || key.includes('langchain')) {
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

        t.langchainVectorSearch({ tx, vectorSearch: vectorSearchEvents[0] })
        t.langchainVectorSearchResult({ tx, vectorSearchResult: vectorSearchResultEvents })

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

  t.test('test redis', (t) => {
    const { agent, vs, embedding } = t.context

    const params = require('../../lib/params')
    const urltils = require('../../../lib/util/urltils')

    const redis = require('redis')
    const { RedisVectorStore } = require('@langchain/community/vectorstores/redis')
    const { Document } = require('@langchain/core/documents')
    // Indicates unique database in Redis. 0-15 supported.
    const port = 6380

    helper.runInNamedTransaction(agent, async (tx) => {
      const client = redis.createClient({
        socket: { port, host: params.redis_host }
      })

      await client.connect()
      await client.flushAll()

      const METRIC_HOST_NAME = urltils.isLocalhost(params.redis_host)
        ? agent.config.getHostnameSafe()
        : params.redis_host
      const HOST_ID = METRIC_HOST_NAME + '/' + port 

      const docs = [
        new Document({
          metadata: { foo: 'bar' },
          pageContent: 'This is an embedding test.'
        })
      ]

      const vectorStore = await RedisVectorStore.fromDocuments(docs, embedding, {
        redisClient: client,
        indexName: 'docs' 
      })

      debugger
      await vectorStore.similaritySearch('This is an embedding test.', 1)

      const events = agent.customEventAggregator.events.toArray()

      await client.disconnect()
      tx.end()
      t.end()
    })
  })
})
