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

  t.test('can send feedback events', (test) => {
    const { client, agent } = t.context
    const api = helper.getAgentApi()
    helper.runInTransaction(agent, async (tx) => {
      await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })
      const { traceId } = api.getTraceMetadata()

      api.recordLlmFeedbackEvent({
        traceId,
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
            trace_id: traceId,
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
