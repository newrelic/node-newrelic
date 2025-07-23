/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const semver = require('semver')

const { removeModules } = require('../../lib/cache-buster')
const { assertSegments, assertSpanKind, match } = require('../../lib/custom-assertions')
const createOpenAIMockServer = require('./mock-server')
const helper = require('../../lib/agent_helper')

const {
  AI: { OPENAI }
} = require('../../../lib/metrics/names')
// have to read and not require because openai does not export the package.json
const { version: pkgVersion } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '/node_modules/openai/package.json'))
)
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const TRACKING_METRIC = `Supportability/Nodejs/ML/OpenAI/${pkgVersion}`

const responses = require('./mock-chat-api-responses')
const { assertChatCompletionMessages, assertChatCompletionSummary } = require('./common-chat-api')

test('chat.completions.create', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const { host, port, server } = await createOpenAIMockServer(responses)
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

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.server?.close()
    removeModules('openai')
  })

  await t.test('should create span on successful chat completion create', (t, end) => {
    const { client, agent, host, port } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const results = await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      assert.equal(results.headers, undefined, 'should remove response headers from user result')
      assert.equal(results.choices[0].message.content, '1 plus 2 is 3.')

      const name = `External/${host}:${port}/chat/completions`
      assertSegments(
        tx.trace,
        tx.trace.root,
        [OPENAI.COMPLETION, [name]],
        { exact: false }
      )

      tx.end()
      assertSpanKind({
        agent,
        segments: [
          { name: OPENAI.COMPLETION, kind: 'internal' },
          { name, kind: 'client' }
        ]
      })
      end()
    })
  })

  await t.test('should increment tracking metric for each chat completion event', (t, end) => {
    const { client, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      const metrics = agent.metrics.getOrCreateMetric(TRACKING_METRIC)
      assert.equal(metrics.callCount > 0, true)

      tx.end()
      end()
    })
  })

  await t.test('should create chat completion message and summary for every message sent', (t, end) => {
    const { client, agent } = t.nr
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
      assert.equal(events.length, 4, 'should create a chat completion message and summary event')
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      assertChatCompletionMessages({
        tx,
        chatMsgs,
        model,
        id: 'chatcmpl-87sb95K4EF2nuJRcTs43Tm9ntTeat',
        resContent: '1 plus 2 is 3.',
        reqContent: content
      })

      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      assertChatCompletionSummary({ tx, model, chatSummary, tokenUsage: true })

      tx.end()
      end()
    })
  })

  if (semver.gte(pkgVersion, '4.12.2')) {
    await t.test('should create span on successful chat completion stream create', (t, end) => {
      const { client, agent, host, port } = t.nr
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
        assert.equal(chunk.headers, undefined, 'should remove response headers from user result')
        assert.equal(chunk.choices[0].message.role, 'assistant')
        const expectedRes = responses.get(content)
        assert.equal(chunk.choices[0].message.content, expectedRes.streamData)
        assert.equal(chunk.choices[0].message.content, res)

        assertSegments(
          tx.trace,
          tx.trace.root,
          [OPENAI.COMPLETION, [`External/${host}:${port}/chat/completions`]],
          { exact: false }
        )

        tx.end()
        end()
      })
    })

    test('should create chat completion message and summary for every message sent in stream', (t, end) => {
      const { client, agent } = t.nr
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
        assert.equal(events.length, 4, 'should create a chat completion message and summary event')
        const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
        assertChatCompletionMessages({
          tx,
          chatMsgs,
          id: 'chatcmpl-8MzOfSMbLxEy70lYAolSwdCzfguQZ',
          model,
          resContent: res,
          reqContent: content
        })

        const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
        assertChatCompletionSummary({ tx, model, chatSummary })

        tx.end()
        end()
      })
    })

    test('should call the tokenCountCallback in streaming', (t, end) => {
      const { client, agent } = t.nr
      const promptContent = 'Streamed response'
      const promptContent2 = 'What does 1 plus 1 equal?'
      let res = ''
      const expectedModel = 'gpt-4'
      const api = helper.getAgentApi()
      function cb(model, content) {
        assert.equal(model, expectedModel)
        if (content === promptContent || content === promptContent2) {
          return 53
        } else if (content === res) {
          return 11
        }
      }
      api.setLlmTokenCountCallback(cb)

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
        assertChatCompletionMessages({
          tokenUsage: true,
          tx,
          chatMsgs,
          id: 'chatcmpl-8MzOfSMbLxEy70lYAolSwdCzfguQZ',
          model: expectedModel,
          resContent: res,
          reqContent: promptContent
        })

        tx.end()
        end()
      })
    })

    test('handles error in stream', (t, end) => {
      const { client, agent } = t.nr
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
          assert.ok(res)
          assert.ok(err.message, 'exceeded count')
          const events = agent.customEventAggregator.events.toArray()
          assert.equal(events.length, 4)
          const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
          assertChatCompletionSummary({ tx, model, chatSummary, error: true })
          if (semver.gte(pkgVersion, '5.0.0')) {
            assert.equal(tx.exceptions.length, 2)
            // only asserting message and completion_id as the rest of the attrs
            // are asserted in other tests
            match(tx.exceptions[1], {
              customAttributes: {
                'error.message': /terminated|Premature close/,
                completion_id: /\w{32}/
              }
            })
          } else {
            assert.equal(tx.exceptions.length, 1)
            // only asserting message and completion_id as the rest of the attrs
            // are asserted in other tests
            match(tx.exceptions[0], {
              customAttributes: {
                'error.message': /terminated|Premature close/,
                completion_id: /\w{32}/
              }
            })
          }
          tx.end()
          end()
        }
      })
    })

    test('should not create llm events when ai_monitoring.streaming.enabled is false', (t, end) => {
      const { client, agent } = t.nr
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
        assert.equal(res, expectedRes.streamData)

        const events = agent.customEventAggregator.events.toArray()
        assert.equal(events.length, 0, 'should not llm events when streaming is disabled')
        const metrics = agent.metrics.getOrCreateMetric(TRACKING_METRIC)
        assert.equal(metrics.callCount > 0, true)
        const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
        assert.equal(attributes.llm, true)
        const streamingDisabled = agent.metrics.getOrCreateMetric(
          'Supportability/Nodejs/ML/Streaming/Disabled'
        )
        assert.equal(streamingDisabled.callCount > 0, true)

        tx.end()
        end()
      })
    })
  } else {
    await t.test('should not instrument streams when openai < 4.12.2', (t, end) => {
      const { client, agent, host, port } = t.nr
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

        assert.ok(res)
        const events = agent.customEventAggregator.events.toArray()
        assert.equal(events.length, 0)
        // we will still record the external segment but not the chat completion
        assertSegments(
          tx.trace,
          tx.trace.root,
          ['timers.setTimeout', `External/${host}:${port}/chat/completions`],
          { exact: false }
        )

        tx.end()
        end()
      })
    })
  }

  await t.test('should not create llm events when not in a transaction', async (t) => {
    const { client, agent } = t.nr
    await client.chat.completions.create({
      messages: [{ role: 'user', content: 'You are a mathematician.' }]
    })

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not create llm events')
  })

  await t.test('auth errors should be tracked', (t, end) => {
    const { client, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.chat.completions.create({
          messages: [{ role: 'user', content: 'Invalid API key.' }]
        })
      } catch {}

      assert.equal(tx.exceptions.length, 1)
      match(tx.exceptions[0], {
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
          completion_id: /\w{32}/
        },
        agentAttributes: {
          spanId: /\w+/
        }
      })

      const summary = agent.customEventAggregator.events.toArray().find((e) => {
        return e[0].type === 'LlmChatCompletionSummary'
      })
      assert.ok(summary)
      assert.equal(summary[1].error, true)

      tx.end()
      end()
    })
  })

  await t.test('invalid payload errors should be tracked', (t, end) => {
    const { client, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.chat.completions.create({
          messages: [{ role: 'bad-role', content: 'Invalid role.' }]
        })
      } catch {}

      assert.equal(tx.exceptions.length, 1)
      match(tx.exceptions[0], {
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
          completion_id: /\w{32}/
        },
        agentAttributes: {
          spanId: /\w+/
        }
      })

      tx.end()
      end()
    })
  })

  await t.test('should add llm attribute to transaction', (t, end) => {
    const { client, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      await client.chat.completions.create({
        messages: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      assert.equal(attributes.llm, true)

      tx.end()
      end()
    })
  })

  await t.test('should record LLM custom events with attributes', (t, end) => {
    const { client, agent } = t.nr
    const api = helper.getAgentApi()

    helper.runInTransaction(agent, () => {
      api.withLlmCustomAttributes({ 'llm.shared': true, 'llm.path': 'root/' }, async () => {
        await api.withLlmCustomAttributes(
          { 'llm.path': 'root/branch1', 'llm.attr1': true },
          async () => {
            agent.config.ai_monitoring.streaming.enabled = true
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
          }
        )

        await api.withLlmCustomAttributes(
          { 'llm.path': 'root/branch2', 'llm.attr2': true },
          async () => {
            agent.config.ai_monitoring.streaming.enabled = true
            const model = 'gpt-3.5-turbo-0613'
            const content = 'You are a mathematician.'
            await client.chat.completions.create({
              max_tokens: 100,
              temperature: 0.5,
              model,
              messages: [
                { role: 'user', content },
                { role: 'user', content: 'What does 1 plus 2 equal?' }
              ]
            })
          }
        )

        const events = agent.customEventAggregator.events.toArray().map((event) => event[1])

        events.forEach((event) => {
          assert.ok(event['llm.shared'])
          if (event['llm.path'] === 'root/branch1') {
            assert.ok(event['llm.attr1'])
            assert.equal(event['llm.attr2'], undefined)
          } else {
            assert.ok(event['llm.attr2'])
            assert.equal(event['llm.attr1'], undefined)
          }
        })

        end()
      })
    })
  })
})
