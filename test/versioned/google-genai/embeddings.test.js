/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const { removeModules } = require('../../lib/cache-buster')
const { assertSegments, assertSpanKind, match } = require('../../lib/custom-assertions')
const GoogleGenAIMockServer = require('./mock-server')
const helper = require('../../lib/agent_helper')

const {
  AI: { GEMINI }
} = require('../../../lib/metrics/names')
// have to read and not require because @google/genai does not export the package.json
const { version: pkgVersion } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '/node_modules/@google/genai/package.json'))
)
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { host, port, server } = await GoogleGenAIMockServer()
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
  const { GoogleGenAI } = require('@google/genai')
  ctx.nr.client = new GoogleGenAI({
    apiKey: 'fake-versioned-test-key',
    vertexai: false,
    httpOptions: {
      baseUrl: `http://${host}:${port}/`,
    },
    httpMethod: 'GET'
  })
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server?.close()
  removeModules('@google/genai')
})

test('should create span on successful embedding create', (t, end) => {
  const { client, agent, host, port } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const model = 'text-embedding-004'
    const results = await client.models.embedContent({
      contents: 'This is an embedding test.',
      model
    })

    assert.equal(results.headers, undefined, 'should remove response headers from user result')

    const name = `External/${host}:${port}/v1beta/models/${model}:batchEmbedContents`
    assertSegments(
      tx.trace,
      tx.trace.root,
      [GEMINI.EMBEDDING, [name]],
      {
        exact: false
      }
    )
    tx.end()
    assertSpanKind({
      agent,
      segments: [
        { name: GEMINI.EMBEDDING, kind: 'internal' }
      ]
    })
    end()
  })
})

test('should increment tracking metric for each embedding event', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await client.models.embedContent({
      contents: 'This is an embedding test.',
      model: 'text-embedding-004'
    })

    const metrics = agent.metrics.getOrCreateMetric(`Supportability/Nodejs/ML/Gemini/${pkgVersion}`)
    assert.equal(metrics.callCount > 0, true)

    tx.end()
    end()
  })
})

test('should create an embedding message', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await client.models.embedContent({
      contents: 'This is an embedding test.',
      model: 'text-embedding-004'
    })
    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 1, 'should create a chat completion message and summary event')
    const [embedding] = events
    const [segment] = tx.trace.getChildren(tx.trace.root.id)
    const expectedEmbedding = {
      appName: 'New Relic for Node.js tests',
      duration: segment.getDurationInMillis(),
      error: false,
      id: /[a-f0-9]{36}/,
      ingest_source: 'Node',
      input: 'This is an embedding test.',
      'request.model': 'text-embedding-004',
      'response.model': undefined,
      token_count: undefined,
      span_id: segment.id,
      trace_id: tx.traceId,
      vendor: 'gemini',
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
      await client.models.embedContent({
        model: 'gemini-2.0-flash',
        contents: 'Embedding not allowed.'
      })
    } catch {}

    assert.equal(tx.exceptions.length, 1)
    match(tx.exceptions[0], {
      error: {
        message: /.*models\/gemini-2\.0-flash is not found for API version v1beta, or is not supported for embedContent\..*/,
      },
      customAttributes: {
        'http.statusCode': 404,
        'error.message': /.*models\/gemini-2\.0-flash is not found for API version v1beta, or is not supported for embedContent\..*/,
        'error.code': 404,
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
    await client.models.embedContent({
      contents: 'This is an embedding test.',
      model: 'text-embedding-004'
    })

    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true)

    tx.end()
    end()
  })
})
