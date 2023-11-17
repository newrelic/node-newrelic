

/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { assertSegments } = require('../../lib/metrics_helper')
const { beforeHook, afterEachHook, afterHook } = require('./common')

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
      test.notOk(results.api_key, 'should remove api_key from user result')
      test.equal(results.model, 'text-embedding-ada-002-v2')

      test.doesNotThrow(() => {
        assertSegments(
          tx.trace.root,
          ['AI/OpenAI/Embeddings/Create', [`External/${host}:${port}/embeddings`]],
          { exact: false }
        )
      }, 'should have expected segments')
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
        'api_key_last_four_digits': 'sk--key',
        'response.organization': 'new-relic-nkmd8b',
        'response.usage.total_tokens': 6,
        'response.usage.prompt_tokens': 6,
        'response.headers.llmVersion': '2020-10-01',
        'response.headers.ratelimitLimitRequests': '200',
        'response.headers.ratelimitLimitTokens': '150000',
        'response.headers.ratelimitResetTokens': '2ms',
        'response.headers.ratelimitRemainingTokens': '149994',
        'response.headers.ratelimitRemainingRequests': '197',
        'input': 'This is an embedding test.'
      }

      test.equal(embedding[0].type, 'LlmEmbedding')
      test.match(embedding[1], expectedEmbedding, 'should match embedding message')
      tx.end()
      test.end()
    })
  })

  t.test(
    'should spread metadata across events if present on agent.llm.metadata',
    (test) => {
      const { client, agent } = t.context
      const api = helper.getAgentApi()
      helper.runInTransaction(agent, async (tx) => {
        const meta = { key: 'value', extended: true, vendor: 'overwriteMe', id: 'bogus' }
        api.setLlmMetadata(meta)

        await client.embeddings.create({
          input: 'This is an embedding test.',
          model: 'text-embedding-ada-002'
        })

        const events = agent.customEventAggregator.events.toArray()
        const [[, testEvent]] = events
        test.equal(testEvent.key, 'value')
        test.equal(testEvent.extended, true)
        test.equal(
          testEvent.vendor,
          'openAI',
          'should not override properties of message with metadata'
        )
        test.not(testEvent.id, 'bogus', 'should not override properties of message with metadata')
        tx.end()
        test.end()
      })
    }
  )
})
