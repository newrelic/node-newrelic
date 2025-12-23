/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const path = require('node:path')

const { removeModules } = require('../../lib/cache-buster')
const { runVectorstoreTests } = require('../langchain/vectorstore')
const { Document } = require('@langchain/core/documents')
const { FAKE_CREDENTIALS, getAiResponseServer } = require('../../lib/aws-server-stubs')
const params = require('../../lib/params')
const helper = require('../../lib/agent_helper')

const config = {
  ai_monitoring: {
    enabled: true
  }
}
const createAiResponseServer = getAiResponseServer(path.join(__dirname, './'))

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { server, baseUrl } = await createAiResponseServer()
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent(config)

  const { BedrockEmbeddings } = require('@langchain/aws')
  const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime')
  ctx.nr.langchainCoreVersion = require('@langchain/core/package.json').version

  const { Client } = require('@elastic/elasticsearch')
  const clientArgs = {
    client: new Client({
      node: `http://${params.elastic_host}:${params.elastic_port}`
    }),
    indexName: 'test_langchain_aws_vectorstore'
  }
  const { ElasticVectorSearch } = require('@langchain/community/vectorstores/elasticsearch')

  // Create the BedrockRuntimeClient with our mock endpoint
  const bedrockClient = new BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl,
    maxAttempts: 1
  })

  ctx.nr.embedding = new BedrockEmbeddings({
    model: 'amazon.titan-embed-text-v1',
    region: 'us-east-1',
    client: bedrockClient,
    maxRetries: 0
  })
  const docs = [
    new Document({
      metadata: { id: '2' },
      pageContent: 'embed text amazon token count callback response'
    })
  ]
  const vectorStore = new ElasticVectorSearch(ctx.nr.embedding, clientArgs)
  await vectorStore.deleteIfExists()
  await vectorStore.addDocuments(docs)
  ctx.nr.vs = vectorStore
})

test.afterEach(async (ctx) => {
  await ctx.nr?.vs?.deleteIfExists()
  ctx.nr?.server?.destroy()
  helper.unloadAgent(ctx.nr.agent)
  // bust the require-cache so it can re-instrument
  removeModules(['@langchain/core', '@langchain/aws', '@aws-sdk', '@elastic', '@langchain/community'])
})

runVectorstoreTests({
  searchQuery: 'embed text amazon token count callback response',
  expectedQuery: 'embed text amazon token count callback response',
  expectedPageContent: 'embed text amazon token count callback response'
})
