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
// load the assertSegments assertion
require('../../lib/metrics_helper')
const {
  AI: { OPENAI }
} = require('../../../lib/metrics/names')
const responses = require('./mock-responses')
const { beforeHook, afterEachHook, afterHook } = require('./common')
const semver = require('semver')
const fs = require('fs')
// have to read and not require because openai does not export the package.json
const { version: pkgVersion } = JSON.parse(
  fs.readFileSync(`${__dirname}/node_modules/openai/package.json`)
)
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const TRACKING_METRIC = `Supportability/Nodejs/ML/OpenAI/${pkgVersion}`

tap.test('OpenAI instrumentation - chat completions', (t) => {
  t.autoend()

  t.before(beforeHook.bind(null, t))

  t.afterEach(afterEachHook.bind(null, t))

  t.teardown(afterHook.bind(null, t))

  t.test('should create span on successful chat completion create', (test) => {
    const { client, agent, host, port } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const results = await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      test.notOk(results.headers, 'should remove response headers from user result')
      test.equal(results.choices[0].message.content, '1 plus 2 is 3.')

      test.assertSegments(
        tx.trace.root,
        [OPENAI.COMPLETION, [`External/${host}:${port}/chat/completions`]],
        { exact: false }
      )
      tx.end()
      test.end()
    })
  })

  t.test('should increment tracking metric for each chat completion event', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      const metrics = agent.metrics.getOrCreateMetric(TRACKING_METRIC)
      t.equal(metrics.callCount > 0, true)

      tx.end()
      test.end()
    })
  })

  t.test('should create chat completion message and summary for every message sent', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      const model = 'gpt-3.5-turbo-0613'
      const content = 'You are a mathematician.'
      await client.chat.completions.create({
        max_tokens: 100,
        temperature: 0.5,
        model,
        messages: [
          { role: 'user', content },
          { role: 'user', content: 'What does 1 plus 1 equal?' }
        ]
      })

      const events = agent.customEventAggregator.events.toArray()
      test.equal(events.length, 4, 'should create a chat completion message and summary event')
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      test.llmMessages({
        tx,
        chatMsgs,
        model,
        id: 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat',
        resContent: '1 plus 2 is 3.',
        reqContent: content
      })

      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      test.llmSummary({ tx, model, chatSummary, tokenUsage: true })
      tx.end()
      test.end()
    })
  })

  if (semver.gte(pkgVersion, '4.12.2')) {
    t.test('should create span on successful chat completion stream create', (test) => {
      const { client, agent, host, port } = t.context
      helper.runInTransaction(agent, async (tx) => {
        const content = 'Streamed response'
        const stream = await client.chat.completions.create({
          stream: true,
          messages: [{ role: 'user', content }]
        })

        let chunk = {}
        let res = ''
        for await (chunk of stream) {
          res += chunk.choices[0]?.delta?.content
        }
        test.notOk(chunk.headers, 'should remove response headers from user result')
        test.equal(chunk.choices[0].message.role, 'assistant')
        const expectedRes = responses.get(content)
        test.equal(chunk.choices[0].message.content, expectedRes.streamData)
        test.equal(chunk.choices[0].message.content, res)

        test.assertSegments(
          tx.trace.root,
          [OPENAI.COMPLETION, [`External/${host}:${port}/chat/completions`]],
          { exact: false }
        )
        tx.end()
        test.end()
      })
    })

    t.test(
      'should create chat completion message and summary for every message sent in stream',
      (test) => {
        const { client, agent } = t.context
        helper.runInTransaction(agent, async (tx) => {
          const content = 'Streamed response'
          const model = 'gpt-4'
          const stream = await client.chat.completions.create({
            max_tokens: 100,
            temperature: 0.5,
            model,
            messages: [
              { role: 'user', content },
              { role: 'user', content: 'What does 1 plus 1 equal?' }
            ],
            stream: true
          })

          let res = ''

          let i = 0
          for await (const chunk of stream) {
            res += chunk.choices[0]?.delta?.content

            // I tried to doing stream.controller.abort like their docs say
            // but this didn't break
            if (i === 10) {
              break
            }
            i++
          }

          const events = agent.customEventAggregator.events.toArray()
          test.equal(events.length, 4, 'should create a chat completion message and summary event')
          const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
          test.llmMessages({
            tx,
            chatMsgs,
            id: 'chatcmpl-8MzOfSMbLxEy70lYAolSwdCzfguQZ',
            model,
            resContent: res,
            reqContent: content
          })

          const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
          test.llmSummary({ tx, model, chatSummary })
          tx.end()
          test.end()
        })
      }
    )

    t.test('should call the tokenCountCallback in streaming', (test) => {
      const { client, agent } = t.context
      const promptContent = 'Streamed response'
      const promptContent2 = 'What does 1 plus 1 equal?'
      let res = ''
      const expectedModel = 'gpt-4'
      const api = helper.getAgentApi()
      function cb(model, content) {
        t.equal(model, expectedModel)
        if (content === promptContent || content === promptContent2) {
          return 53
        } else if (content === res) {
          return 11
        }
      }
      api.setLlmTokenCountCallback(cb)
      test.teardown(() => {
        delete agent.llm.tokenCountCallback
      })
      helper.runInTransaction(agent, async (tx) => {
        const stream = await client.chat.completions.create({
          max_tokens: 100,
          temperature: 0.5,
          model: expectedModel,
          messages: [
            { role: 'user', content: promptContent },
            { role: 'user', content: promptContent2 }
          ],
          stream: true
        })

        for await (const chunk of stream) {
          res += chunk.choices[0]?.delta?.content
        }

        const events = agent.customEventAggregator.events.toArray()
        const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
        test.llmMessages({
          tokenUsage: true,
          tx,
          chatMsgs,
          id: 'chatcmpl-8MzOfSMbLxEy70lYAolSwdCzfguQZ',
          model: expectedModel,
          resContent: res,
          reqContent: promptContent
        })

        tx.end()
        test.end()
      })
    })

    t.test('handles error in stream', (test) => {
      const { client, agent } = t.context
      helper.runInTransaction(agent, async (tx) => {
        const content = 'bad stream'
        const model = 'gpt-4'
        const stream = await client.chat.completions.create({
          max_tokens: 100,
          temperature: 0.5,
          model,
          messages: [
            { role: 'user', content },
            { role: 'user', content: 'What does 1 plus 1 equal?' }
          ],
          stream: true
        })

        let res = ''

        try {
          for await (const chunk of stream) {
            res += chunk.choices[0]?.delta?.content
          }
        } catch (err) {
          test.ok(res)
          test.ok(err.message, 'exceeded count')
          const events = agent.customEventAggregator.events.toArray()
          test.equal(events.length, 4)
          const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
          test.llmSummary({ tx, model, chatSummary, error: true })
          test.equal(tx.exceptions.length, 1)
          // only asserting message and completion_id as the rest of the attrs
          // are asserted in other tests
          test.match(tx.exceptions[0], {
            customAttributes: {
              'error.message': 'Premature close',
              'completion_id': /\w{32}/
            }
          })
          tx.end()
          test.end()
        }
      })
    })

    t.test('should not create llm events when ai_monitoring.streaming.enabled is false', (test) => {
      const { client, agent } = t.context
      agent.config.ai_monitoring.streaming.enabled = false
      helper.runInTransaction(agent, async (tx) => {
        const content = 'Streamed response'
        const model = 'gpt-4'
        const stream = await client.chat.completions.create({
          max_tokens: 100,
          temperature: 0.5,
          model,
          messages: [{ role: 'user', content }],
          stream: true
        })

        let res = ''
        let chunk = {}

        for await (chunk of stream) {
          res += chunk.choices[0]?.delta?.content
        }
        const expectedRes = responses.get(content)
        test.equal(res, expectedRes.streamData)

        const events = agent.customEventAggregator.events.toArray()
        test.equal(events.length, 0, 'should not llm events when streaming is disabled')
        const metrics = agent.metrics.getOrCreateMetric(TRACKING_METRIC)
        test.equal(metrics.callCount > 0, true)
        const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
        test.equal(attributes.llm, true)
        const streamingDisabled = agent.metrics.getOrCreateMetric(
          'Supportability/Nodejs/ML/Streaming/Disabled'
        )
        test.equal(streamingDisabled.callCount > 0, true)
        tx.end()
        test.end()
      })
    })
  } else {
    t.test('should not instrument streams when openai < 4.12.2', (test) => {
      const { client, agent, host, port } = t.context
      helper.runInTransaction(agent, async (tx) => {
        const content = 'Streamed response'
        const stream = await client.chat.completions.create({
          stream: true,
          messages: [{ role: 'user', content }]
        })

        let chunk = {}
        let res = ''
        for await (chunk of stream) {
          res += chunk.choices[0]?.delta?.content
        }

        test.ok(res)
        const events = agent.customEventAggregator.events.toArray()
        test.equal(events.length, 0)
        // we will still record the external segment but not the chat completion
        test.assertSegments(tx.trace.root, [
          'timers.setTimeout',
          `External/${host}:${port}/chat/completions`
        ])
        tx.end()
        test.end()
      })
    })
  }

  t.test('should not create llm events when not in a transaction', async (test) => {
    const { client, agent } = t.context
    await client.chat.completions.create({
      messages: [{ role: 'user', content: 'You are a mathematician.' }]
    })

    const events = agent.customEventAggregator.events.toArray()
    test.equal(events.length, 0, 'should not create llm events')
  })

  t.test('auth errors should be tracked', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.chat.completions.create({
          messages: [{ role: 'user', content: 'Invalid API key.' }]
        })
      } catch {}

      test.equal(tx.exceptions.length, 1)
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
      test.ok(summary)
      test.equal(summary[1].error, true)

      tx.end()
      test.end()
    })
  })

  t.test('invalid payload errors should be tracked', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.chat.completions.create({
          messages: [{ role: 'bad-role', content: 'Invalid role.' }]
        })
      } catch {}

      test.equal(tx.exceptions.length, 1)
      test.match(tx.exceptions[0], {
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

  t.test('should add llm attribute to transaction', (test) => {
    const { client, agent } = t.context
    helper.runInTransaction(agent, async (tx) => {
      await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attributes.llm, true)

      tx.end()
      test.end()
    })
  })
})
