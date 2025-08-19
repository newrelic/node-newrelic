/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const { removeModules } = require('../../lib/cache-buster')
const { assertSegments, assertSpanKind, match } = require('../../lib/custom-assertions')
const createOpenAIMockServer = require('./mock-server')
const helper = require('../../lib/agent_helper')

const {
  AI: { OPENAI }
} = require('../../../lib/metrics/names')
const { version: pkgVersion } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '/node_modules/openai/package.json'))
)
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { host, port, server } = await createOpenAIMockServer()
  ctx.nr.host = host
  ctx.nr.port = port
  ctx.nr.server = server
  ctx.nr.agent = helper.instrumentMockedAgent({
    ai_monitoring: {
      enabled: true
    },
    streaming: {
      enabled: true
    }
  })
  const OpenAI = require('openai')
  ctx.nr.client = new OpenAI({
    apiKey: 'fake-versioned-test-key',
    baseURL: `http://${host}:${port}`
  })
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server?.close()
  removeModules('openai')
})

test('should create span on successful embedding create', (t, end) => {
  const { client, agent, host, port } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const results = await client.embeddings.create({
      input: 'This is an embedding test.',
      model: 'text-embedding-ada-002'
    })

    assert.equal(results.headers, undefined, 'should remove response headers from user result')
    assert.equal(results.model, 'text-embedding-ada-002-v2')

    const name = `External/${host}:${port}/embeddings`
    assertSegments(
      tx.trace,
      tx.trace.root,
      [OPENAI.EMBEDDING, [name]],
      {
        exact: false
      }
    )
    tx.end()
    assertSpanKind({
      agent,
      segments: [
        { name: OPENAI.EMBEDDING, kind: 'internal' },
        { name, kind: 'client' }
      ]
    })
    end()
  })
})

test('should increment tracking metric for each embedding event', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await client.embeddings.create({
      input: 'This is an embedding test.',
      model: 'text-embedding-ada-002'
    })

    const metrics = agent.metrics.getOrCreateMetric(`Supportability/Nodejs/ML/OpenAI/${pkgVersion}`)
    assert.equal(metrics.callCount > 0, true)

    tx.end()
    end()
  })
})

test('should create an embedding message', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await client.embeddings.create({
      input: 'This is an embedding test.',
      model: 'text-embedding-ada-002'
    })
    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 1, 'should create a chat completion message and summary event')
    const [embedding] = events
    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    const expectedEmbedding = {
      id: /[a-f0-9]{36}/,
      appName: 'New Relic for Node.js tests',
      request_id: 'c70828b2293314366a76a2b1dcb20688',
      trace_id: tx.traceId,
      span_id: segment.id,
      'response.model': 'text-embedding-ada-002-v2',
      vendor: 'openai',
      ingest_source: 'Node',
      'request.model': 'text-embedding-ada-002',
      duration: segment.getDurationInMillis(),
      'response.organization': 'new-relic-nkmd8b',
      token_count: undefined,
      'response.headers.llmVersion': '2020-10-01',
      'response.headers.ratelimitLimitRequests': '200',
      'response.headers.ratelimitLimitTokens': '150000',
      'response.headers.ratelimitResetTokens': '2ms',
      'response.headers.ratelimitRemainingTokens': '149994',
      'response.headers.ratelimitRemainingRequests': '197',
      input: 'This is an embedding test.',
      error: false
    }

    assert.equal(embedding[0].type, 'LlmEmbedding')
    match(embedding[1], expectedEmbedding, 'should match embedding message')

    tx.end()
    end()
  })
})

test('embedding invalid payload errors should be tracked', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    try {
      await client.embeddings.create({
        model: 'gpt-4',
        input: 'Embedding not allowed.'
      })
    } catch {}

    assert.equal(tx.exceptions.length, 1)
    match(tx.exceptions[0], {
      error: {
        status: 403,
        code: null,
        param: null
      },
      customAttributes: {
        'http.statusCode': 403,
        'error.message': /You are not allowed to generate embeddings from this model/,
        'error.code': null,
        'error.param': null,
        completion_id: undefined,
        embedding_id: /\w{32}/
      },
      agentAttributes: {
        spanId: /\w+/
      }
    })

    const embedding = agent.customEventAggregator.events.toArray().slice(0, 1)[0][1]
    assert.equal(embedding.error, true)

    tx.end()
    end()
  })
})

test('should add llm attribute to transaction', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await client.embeddings.create({
      input: 'This is an embedding test.',
      model: 'text-embedding-ada-002'
    })

    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true)

    tx.end()
    end()
  })
})
