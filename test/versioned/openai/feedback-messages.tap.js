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
const { beforeHook, afterEachHook, afterHook } = require('./common')

tap.test('OpenAI instrumentation - feedback messages', (t) => {
  t.autoend()

  t.before(beforeHook.bind(null, t))

  t.afterEach(afterEachHook.bind(null, t))

  t.teardown(afterHook.bind(null, t))

  t.test(
    'should store conversation_id, request_id and message_ids on transaction by response_id',
    (test) => {
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
        test.same(trackedIds, {
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
    }
  )

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
})
