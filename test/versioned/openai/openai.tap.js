/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const createOpenAIMockServer = require('../../lib/openai-mock-server')
// TODO: remove config once we fully release OpenAI instrumentation
const config = {
  feature_flag: {
    openai_instrumentation: true
  }
}

tap.test('OpenAI instrumentation', (t) => {
  t.autoend()

  t.before(async () => {
    const { host, port, server } = await createOpenAIMockServer()
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
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const results = await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      test.not(results.headers, 'should remove response headers from user result')
      test.not(results.api_key, 'should remove api_key from user result')
      test.equal(results.choices[0].message.content, '1 plus 2 is 3.')

      const [span] = tx.trace.root.children
      test.equal(span.name, 'AI/OpenAI/Chat/Completions/Create')
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
      test.equal(events.length, 3, 'should create a chat completion message and summary event')
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      const expectedChatMsg = {
        'appName': 'New Relic for Node.js tests',
        'request_id': '49dbbffbd3c3f4612aa48def69059aad',
        'trace_id': tx.traceId,
        'span_id': tx.trace.root.children[0].id,
        'transaction_id': tx.id,
        'response.model': 'gpt-3.5-turbo-0613',
        'vendor': 'openAI',
        'ingest_source': 'Node',
        'role': 'user',
        'completion_id': /[a-f0-9]{36}/
      }

      chatMsgs.forEach((msg) => {
        if (msg[1].sequence === 0) {
          expectedChatMsg.sequence = 0
          ;(expectedChatMsg.id = 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat-0'),
            (expectedChatMsg.content = 'You are a mathematician.')
        } else {
          expectedChatMsg.sequence = 1
          ;(expectedChatMsg.id = 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat-1'),
            (expectedChatMsg.content = 'What does 1 plus 1 equal?')
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
        'response.choices.finish_reason': 'stop'
      }
      test.match(chatSummary[1], expectedChatSummary, 'should match chat summary message')
      test.end()
    })
  })

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
    helper.runInTransaction(agent, async () => {
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
          'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat-1'
        ]
      })

      test.end()
    })
  })

  t.test('can send feedback events', (test) => {
    const { client, agent } = t.context
    const api = helper.getAgentApi()
    helper.runInTransaction(agent, async () => {
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

      test.end()
    })
  })
})
