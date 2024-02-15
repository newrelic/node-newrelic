/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('../../lib/metrics_helper')
const { beforeHook, afterEachHook, afterHook } = require('./common')
const {
  AI: { OPENAI }
} = require('../../../lib/metrics/names')

const fs = require('fs')
// have to read and not require because openai does not export the package.json
const { version: pkgVersion } = JSON.parse(
  fs.readFileSync(`${__dirname}/node_modules/openai/package.json`)
)
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

tap.test('OpenAI instrumentation - embedding', (t) => {
  t.autoend()

  t.before(beforeHook.bind(null, t))

  t.afterEach(afterEachHook.bind(null, t))

  t.teardown(afterHook.bind(null, t))

  t.test('should create span on successful embedding create', (test) => {
    const { client, agent, host, port } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const results = await client.embeddings.create({
        input: 'This is an embedding test.',
        model: 'text-embedding-ada-002'
      })

      test.notOk(results.headers, 'should remove response headers from user result')
      test.equal(results.model, 'text-embedding-ada-002-v2')

      test.assertSegments(
        tx.trace.root,
        [OPENAI.EMBEDDING, [`External/${host}:${port}/embeddings`]],
        {
          exact: false
        }
      )
      tx.end()
      test.end()
    })
  })

  t.test('should increment tracking metric for each embedding event', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      await client.embeddings.create({
        input: 'This is an embedding test.',
        model: 'text-embedding-ada-002'
      })

      const metrics = agent.metrics.getOrCreateMetric(
        `Supportability/Nodejs/ML/OpenAI/${pkgVersion}`
      )
      test.equal(metrics.callCount > 0, true)

      tx.end()
      test.end()
    })
  })

  t.test('should create an embedding message', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      await client.embeddings.create({
        input: 'This is an embedding test.',
        model: 'text-embedding-ada-002'
      })
      const events = agent.customEventAggregator.events.toArray()
      test.equal(events.length, 1, 'should create a chat completion message and summary event')
      const [embedding] = events
      const expectedEmbedding = {
        'id': /[a-f0-9]{36}/,
        'appName': 'New Relic for Node.js tests',
        'request_id': 'c70828b2293314366a76a2b1dcb20688',
        'trace_id': tx.traceId,
        'span_id': tx.trace.root.children[0].id,
        'transaction_id': tx.id,
        'response.model': 'text-embedding-ada-002-v2',
        'vendor': 'openAI',
        'ingest_source': 'Node',
        'request.model': 'text-embedding-ada-002',
        'duration': tx.trace.root.children[0].getDurationInMillis(),
        'response.organization': 'new-relic-nkmd8b',
        'response.usage.total_tokens': 6,
        'response.usage.prompt_tokens': 6,
        'response.headers.llmVersion': '2020-10-01',
        'response.headers.ratelimitLimitRequests': '200',
        'response.headers.ratelimitLimitTokens': '150000',
        'response.headers.ratelimitResetTokens': '2ms',
        'response.headers.ratelimitRemainingTokens': '149994',
        'response.headers.ratelimitRemainingRequests': '197',
        'input': 'This is an embedding test.',
        'error': false
      }

      test.equal(embedding[0].type, 'LlmEmbedding')
      test.match(embedding[1], expectedEmbedding, 'should match embedding message')
      tx.end()
      test.end()
    })
  })

  t.test('embedding invalid payload errors should be tracked', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.embeddings.create({
          model: 'gpt-4',
          input: 'Embedding not allowed.'
        })
      } catch {}

      test.equal(tx.exceptions.length, 1)
      test.match(tx.exceptions[0], {
        error: {
          status: 403,
          code: null,
          param: null
        },
        customAttributes: {
          'http.statusCode': 403,
          'error.message': 'You are not allowed to generate embeddings from this model',
          'error.code': null,
          'error.param': null,
          'completion_id': undefined,
          'embedding_id': /\w{32}/
        },
        agentAttributes: {
          spanId: /\w+/
        }
      })

      const embedding = agent.customEventAggregator.events.toArray().slice(0, 1)[0][1]
      test.equal(embedding.error, true)

      tx.end()
      test.end()
    })
  })

  t.test('should add llm attribute to transaction', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      await client.embeddings.create({
        input: 'This is an embedding test.',
        model: 'text-embedding-ada-002'
      })

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attributes.llm, true)

      tx.end()
      test.end()
    })
  })
})
