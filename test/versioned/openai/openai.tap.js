/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const createOpenAIMockServer = require('../../lib/openai-mock-server')
const { assertSegments } = require('../../lib/metrics_helper')

const config = {
  ai_monitoring: {
    enabled: true
  }
}

tap.test('OpenAI instrumentation', (t) => {
  t.autoend()

  t.before(async () => {
    const { host, port, server } = await createOpenAIMockServer()
    t.context.host = host
    t.context.port = port
    t.context.server = server
    t.context.agent = helper.instrumentMockedAgent(config)
    const OpenAI = require('openai')
    t.context.client = new OpenAI({
      apiKey: 'fake-versioned-test-key',
      baseURL: `http://${host}:${port}`
    })
  })

  t.afterEach(() => {
    t.context.agent.customEventAggregator.clear()
  })

  t.teardown(() => {
    t.context?.server?.close()
    t.context.agent && helper.unloadAgent(t.context.agent)
  })

  t.test('should create chat completion span on successful chat completion create', (test) => {
    const { client, agent, host, port } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const results = await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      test.notOk(results.headers, 'should remove response headers from user result')
      test.notOk(results.api_key, 'should remove api_key from user result')
      test.equal(results.choices[0].message.content, '1 plus 2 is 3.')

      test.doesNotThrow(() => {
        assertSegments(
          tx.trace.root,
          ['AI/OpenAI/Chat/Completions/Create', [`External/${host}:${port}/chat/completions`]],
          { exact: false }
        )
      }, 'should have expected segments')
      tx.end()
      test.end()
    })
  })

  t.test('should create chat completion message and summary for every message sent', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      await client.chat.completions.create({
        max_tokens: 100,
        temperature: 0.5,
        model: 'gpt-3.5-turbo-0613',
        messages: [
          { role: 'user', content: 'You are a mathematician.' },
          { role: 'user', content: 'What does 1 plus 1 equal?' }
        ]
      })

      const events = agent.customEventAggregator.events.toArray()
      test.equal(events.length, 4, 'should create a chat completion message and summary event')
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      const baseMsg = {
        'appName': 'New Relic for Node.js tests',
        'request_id': '49dbbffbd3c3f4612aa48def69059aad',
        'trace_id': tx.traceId,
        'span_id': tx.trace.root.children[0].id,
        'transaction_id': tx.id,
        'response.model': 'gpt-3.5-turbo-0613',
        'vendor': 'openAI',
        'ingest_source': 'Node',
        'role': 'user',
        'is_response': false,
        'completion_id': /[a-f0-9]{36}/
      }

      chatMsgs.forEach((msg) => {
        const expectedChatMsg = { ...baseMsg }
        if (msg[1].sequence === 0) {
          expectedChatMsg.sequence = 0
          expectedChatMsg.id = 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat-0'
          expectedChatMsg.content = 'You are a mathematician.'
        } else if (msg[1].sequence === 1) {
          expectedChatMsg.sequence = 1
          expectedChatMsg.id = 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat-1'
          expectedChatMsg.content = 'What does 1 plus 1 equal?'
        } else {
          expectedChatMsg.sequence = 2
          expectedChatMsg.role = 'assistant'
          expectedChatMsg.id = 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat-2'
          expectedChatMsg.content = '1 plus 2 is 3.'
          expectedChatMsg.is_response = true
        }

        test.equal(msg[0].type, 'LlmChatCompletionMessage')
        test.match(msg[1], expectedChatMsg, 'should match chat completion message')
      })

      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      test.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
      const expectedChatSummary = {
        'id': /[a-f0-9]{36}/,
        'appName': 'New Relic for Node.js tests',
        'request_id': '49dbbffbd3c3f4612aa48def69059aad',
        'trace_id': tx.traceId,
        'span_id': tx.trace.root.children[0].id,
        'transaction_id': tx.id,
        'response.model': 'gpt-3.5-turbo-0613',
        'vendor': 'openAI',
        'ingest_source': 'Node',
        'request.model': 'gpt-3.5-turbo-0613',
        'duration': tx.trace.root.children[0].getExclusiveDurationInMillis(),
        'api_key_last_four_digits': 'sk--key',
        'response.organization': 'new-relic-nkmd8b',
        'response.usage.total_tokens': 64,
        'response.usage.prompt_tokens': 53,
        'response.headers.llmVersion': '2020-10-01',
        'response.headers.ratelimitLimitRequests': '200',
        'response.headers.ratelimitLimitTokens': '40000',
        'response.headers.ratelimitResetTokens': '90ms',
        'response.headers.ratelimitRemainingTokens': '39940',
        'response.headers.ratelimitRemainingRequests': '199',
        'response.number_of_messages': 3,
        'response.usage.completion_tokens': 11,
        'response.choices.finish_reason': 'stop',
        'error': false
      }
      test.match(chatSummary[1], expectedChatSummary, 'should match chat summary message')
      tx.end()
      test.end()
    })
  })

  t.test(
    'chat completion creation - should spread metadata across events if present on agent.llm.metadata',
    (test) => {
      const { client, agent } = t.context
      const api = helper.getAgentApi()
      helper.runInTransaction(agent, async (tx) => {
        const meta = { key: 'value', extended: true, vendor: 'overwriteMe', id: 'bogus' }
        api.setLlmMetadata(meta)

        await client.chat.completions.create({
          messages: [{ role: 'user', content: 'You are a mathematician.' }]
        })

        const events = agent.customEventAggregator.events.toArray()
        events.forEach(([, testEvent]) => {
          test.equal(testEvent.key, 'value')
          test.equal(testEvent.extended, true)
          test.equal(
            testEvent.vendor,
            'openAI',
            'should not override properties of message with metadata'
          )
          test.not(testEvent.id, 'bogus', 'should not override properties of message with metadata')
        })
        tx.end()
        test.end()
      })
    }
  )

  t.test('should not create llm events when not in a transaction', async (test) => {
    const { client, agent } = t.context
    await client.chat.completions.create({
      messages: [{ role: 'user', content: 'You are a mathematician.' }]
    })

    const events = agent.customEventAggregator.events.toArray()
    test.equal(events.length, 0, 'should not create llm events')
  })

  t.test('should make tracked ids available', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const results = await client.chat.completions.create({
        messages: [
          { role: 'user', content: 'You are a mathematician.' },
          { role: 'system', content: 'You are a test.' }
        ]
      })

      const api = helper.getAgentApi()
      const trackedIds = api.getLlmMessageIds({ responseId: results.id })
      t.same(trackedIds, {
        conversation_id: '',
        request_id: '49dbbffbd3c3f4612aa48def69059aad',
        message_ids: [
          'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat-0',
          'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat-1',
          'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat-2'
        ]
      })
      tx.end()
      test.end()
    })
  })

  t.test('can send feedback events', (test) => {
    const { client, agent } = t.context
    const api = helper.getAgentApi()
    helper.runInTransaction(agent, async (tx) => {
      const results = await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      const trackedIds = api.getLlmMessageIds({ responseId: results.id })
      api.recordLlmFeedbackEvent({
        conversationId: trackedIds.conversation_id,
        requestId: trackedIds.request_id,
        messageId: trackedIds.message_ids[0],
        category: 'test-event',
        rating: '5 star',
        message: 'You are a mathematician.',
        metadata: { foo: 'foo' }
      })

      const recordedEvents = agent.customEventAggregator.getEvents()
      test.equal(
        true,
        recordedEvents.some((ele) => {
          const [info, data] = ele
          if (info.type !== 'LlmFeedbackMessage') {
            return false
          }
          return test.match(data, {
            id: /[\w\d]{32}/,
            conversation_id: '',
            request_id: '49dbbffbd3c3f4612aa48def69059aad',
            message_id: 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat-0',
            category: 'test-event',
            rating: '5 star',
            message: 'You are a mathematician.',
            ingest_source: 'Node',
            foo: 'foo'
          })
        })
      )
      tx.end()
      test.end()
    })
  })

  t.test('should create embedding span on successful embedding create', (test) => {
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

  t.test('should create embedding message for an embedding', (test) => {
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
        'duration': tx.trace.root.children[0].getExclusiveDurationInMillis(),
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
        'input': 'This is an embedding test.',
        'error': false
      }

      test.equal(embedding[0].type, 'LlmEmbedding')
      test.match(embedding[1], expectedEmbedding, 'should match embedding message')
      tx.end()
      test.end()
    })
  })

  t.test(
    'embedding - should spread metadata across events if present on agent.llm.metadata',
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

  t.test('chat completion auth errors should be tracked', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.chat.completions.create({
          messages: [{ role: 'user', content: 'Invalid API key.' }]
        })
      } catch {}

      t.equal(tx.exceptions.length, 1)
      t.match(tx.exceptions[0], {
        error: {
          status: 401,
          code: 'invalid_api_key',
          param: 'null'
        },
        customAttributes: {
          'http.statusCode': 401,
          'error.message': /Incorrect API key provided:/,
          'error.code': 'invalid_api_key',
          'error.param': 'null',
          'completion_id': /[\w\d]{32}/
        },
        agentAttributes: {
          spanId: /[\w\d]+/
        }
      })

      const summary = agent.customEventAggregator.events.toArray().find((e) => {
        return e[0].type === 'LlmChatCompletionSummary'
      })
      t.ok(summary)
      t.equal(summary[1].error, true)

      tx.end()
      test.end()
    })
  })

  t.test('chat completion invalid payload errors should be tracked', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.chat.completions.create({
          messages: [{ role: 'bad-role', content: 'Invalid role.' }]
        })
      } catch {}

      t.equal(tx.exceptions.length, 1)
      t.match(tx.exceptions[0], {
        error: {
          status: 400,
          code: null,
          param: null
        },
        customAttributes: {
          'http.statusCode': 400,
          'error.message': /'bad-role' is not one of/,
          'error.code': null,
          'error.param': null,
          'completion_id': /\w{32}/
        },
        agentAttributes: {
          spanId: /\w+/
        }
      })

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

      t.equal(tx.exceptions.length, 1)
      t.match(tx.exceptions[0], {
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
      t.equal(embedding.error, true)

      tx.end()
      test.end()
    })
  })
})
