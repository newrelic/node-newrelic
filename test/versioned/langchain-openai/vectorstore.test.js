/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { runVectorstoreTests } = require('../langchain/vectorstore')
const { Document } = require('@langchain/core/documents')
const createOpenAIMockServer = require('../openai/mock-server')
const params = require('../../lib/params')
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
  ctx.nr.agent = helper.instrumentMockedAgent(config)

  const { OpenAIEmbeddings } = require('@langchain/openai')
  ctx.nr.langchainCoreVersion = require('@langchain/core/package.json').version

  const { Client } = require('@elastic/elasticsearch')
  const clientArgs = {
    client: new Client({
      node: `http://${params.elastic_host}:${params.elastic_port}`
    }),
    indexName: 'test_langchain_openai_vectorstore'
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
  await ctx.nr?.vs?.deleteIfExists()
  ctx.nr?.server?.close()
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core', 'openai', '@elastic', '@langchain/community'])
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
