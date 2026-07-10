/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { findSegment } = require('../../lib/metrics_helper')
const { runVectorstoreTests } = require('../langchain/vectorstore')
const { Document } = require('@langchain/core/documents')
const createOpenAIMockServer = require('../openai/mock-server')
const helper = require('../../lib/agent_helper')

const config = {
  ai_monitoring: {
    enabled: true
  }
}

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { host, port, server } = await createOpenAIMockServer()
  ctx.nr.server = server
  ctx.nr.host = host
  ctx.nr.port = port
  ctx.nr.agent = helper.instrumentMockedAgent(config)

  const { VectorStore } = require('@langchain/core/vectorstores')
  // must pass in VectorStore to ensure it's the same version as the test
  // and not whatever is installed in `test/versioned/langchain/`
  const CustomVectorStore = require('../langchain/custom-vector-store')(VectorStore)
  const { OpenAIEmbeddings } = require('@langchain/openai')
  ctx.nr.langchainCoreVersion = require('@langchain/core/package.json').version

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
  const vectorStore = new CustomVectorStore(ctx.nr.embedding)
  await vectorStore.addDocuments(docs)
  ctx.nr.vs = vectorStore
})

test.afterEach(async (ctx) => {
  ctx.nr?.server?.close()
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core', 'openai'])
})

runVectorstoreTests({
  searchQuery: 'This is an embedding test.',
  errorAssertion: (exceptions) => {
    for (const e of exceptions) {
      const str = Object.prototype.toString.call(e.customAttributes)
      assert.equal(str, '[object LlmErrorMessage]')
    }
  }
})

test('should create segment and llm events when ai_monitoring is disabled at instrumentation but enabled before the call', async (t) => {
  const { host, port } = t.nr
  // tear down the enabled agent/module set up in `beforeEach`
  helper.unloadAgent(t.nr.agent)
  removeModules(['@langchain/core', 'openai'])

  // set up the agent instance with ai_monitoring disabled
  const agent = helper.instrumentMockedAgent({ ai_monitoring: { enabled: false } })
  t.nr.agent = agent

  const { VectorStore } = require('@langchain/core/vectorstores')
  const CustomVectorStore = require('../langchain/custom-vector-store')(VectorStore)
  const { OpenAIEmbeddings } = require('@langchain/openai')
  const embedding = new OpenAIEmbeddings({
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
  const vs = new CustomVectorStore(embedding)
  await vs.addDocuments(docs)
  t.nr.vs = vs

  // enable ai_monitoring before making the call
  agent.config.ai_monitoring.enabled = true
  await new Promise((resolve) => {
    helper.runInTransaction(agent, async (tx) => {
      const result = await vs.similaritySearch('This is an embedding test.', 1)
      assert.ok(result)

      const events = agent.customEventAggregator.events.toArray()
      assert.ok(events.length > 0, 'should create llm events when ai_monitoring is enabled before the call')

      const langchainEvents = events.filter((event) => {
        const [, chainEvent] = event
        return chainEvent.vendor === 'langchain'
      })
      assert.ok(langchainEvents.length > 0, 'should create langchain events when ai_monitoring is enabled before the call')

      assert.ok(findSegment(tx.trace, tx.trace.root, 'Llm/vectorstore/LangChain/similaritySearch'), 'should create the similaritySearch segment')

      tx.end()
      resolve()
    })
  })
})
