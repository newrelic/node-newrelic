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
