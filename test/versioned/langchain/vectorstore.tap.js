/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const createOpenAIMockServer = require('../openai/mock-server')

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

    t.context.embedding = new OpenAIEmbeddings({
      openAIApiKey: 'fake-key',
      configuration: {
        baseURL: `http://${host}:${port}`
      }
    })
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

  t.test('should create vectorstore events for every similarity search call', (t) => {
    const { agent, embedding } = t.context
    const { MemoryVectorStore } = require('langchain/vectorstores/memory')

    helper.runInNamedTransaction(agent, async (tx) => {
      const vs = await MemoryVectorStore.fromTexts(
        ['This is an embedding test.'],
        [{ id: 2 }, { id: 1 }, { id: 3 }],
        embedding
      )
      await vs.similaritySearch('This is an embedding test.', 1)

      const events = agent.customEventAggregator.events.toArray()
      t.equal(events.length, 4, 'should create 4 events')

      tx.end()
      t.end()
    })
  })
})
