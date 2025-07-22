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
const createOpenAIMockServer = require('./mock-server-res-api')
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

const responses = require('./mock-responses-api-responses')
const { assertChatCompletionMessages, assertChatCompletionSummary } = require('./common-responses-api')

test('responses.create', async (t) => {
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
      const results = await client.responses.create({
        input: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      assert.equal(results.headers, undefined, 'should remove response headers from user result')
      assert.equal(results.output[0].content[0].text, '1 plus 2 is 3.')

      const name = `External/${host}:${port}/responses`
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
      await client.responses.create({
        input: [{ role: 'user', content: 'You are a mathematician.' }]
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
      const model = 'gpt-4'
      const content = 'You are a mathematician.'
      await client.responses.create({
        model,
        input: [
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
        model: 'gpt-4-0613',
        id: 'resp_68420d9a5d4481a1bff5b86663299e3403b76731ee674f61',
        resContent: '1 plus 2 is 3.',
        reqContent: content
      })

      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      assertChatCompletionSummary({ tx, model, chatSummary, tokenUsage: true })

      tx.end()
      end()
    })
  })

  await t.test('should create chat completion message and summary when input is a single string', (t, end) => {
    const { client, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const model = 'gpt-4'
      const content = 'You are a mathematician.'
      await client.responses.create({
        model,
        input: content
      })

      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 3, 'should create a chat completion message and summary event')
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      assertChatCompletionMessages({
        tx,
        chatMsgs,
        model: 'gpt-4-0613',
        id: 'resp_68420d9a5d4481a1bff5b86663299e3403b76731ee674f61',
        resContent: '1 plus 2 is 3.',
        reqContent: content,
        singleInput: true
      })

      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      assertChatCompletionSummary({ tx, model, chatSummary, tokenUsage: true, singleInput: true })

      tx.end()
      end()
    })
  })

  await t.test('should not create llm events when not in a transaction', async (t) => {
    const { client, agent } = t.nr
    await client.responses.create({
      input: [{ role: 'user', content: 'You are a mathematician.' }]
    })

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not create llm events')
  })

  await t.test('auth errors should be tracked', (t, end) => {
    const { client, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.responses.create({
          input: [{ role: 'user', content: 'Invalid API key.' }]
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

  await t.test('bad input error should be tracked', (t, end) => {
    const { client, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const model = 'gpt-4'
      try {
        await client.responses.create({
          model,
          input: { badContent: 'Invalid input.' }
        })
      } catch {}

      assert.equal(tx.exceptions.length, 1)
      match(tx.exceptions[0], {
        error: {
          status: 400,
          code: 'invalid_type',
          param: 'input'
        },
        customAttributes: {
          'http.statusCode': 400,
          'error.message': /Invalid type for 'input'/,
          'error.code': 'invalid_type',
          'error.param': 'input',
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

  await t.test('invalid role error should be tracked', (t, end) => {
    const { client, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      try {
        await client.responses.create({
          input: [{ role: 'bad-role', content: 'Invalid role.' }]
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
      await client.responses.create({
        input: [{ role: 'user', content: 'You are a mathematician.' }]
      })

      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      assert.equal(attributes.llm, true)

      tx.end()
      end()
    })
  })

  await t.test('should create span on successful responses stream create', (t, end) => {
    const { client, agent, host, port } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const content = 'Streamed response'
      const stream = await client.responses.create({
        stream: true,
        input: content,
        model: 'gpt-4'
      })

      let chunk = {}
      for await (chunk of stream) {
        continue
      }
      assert.equal(chunk.headers, undefined, 'should remove response headers from user result')
      assert.equal(chunk.response.output[0].role, 'assistant')
      const expectedRes = responses.get(content)
      assert.equal(chunk.response.output[0].content[0].text, expectedRes.body.response.output[0].content[0].text)

      assertSegments(
        tx.trace,
        tx.trace.root,
        [OPENAI.COMPLETION, [`External/${host}:${port}/responses`]],
        { exact: false }
      )

      tx.end()
      end()
    })
  })

  await t.test('should create chat completion message and summary for every message sent in stream', (t, end) => {
    const { client, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const content = 'Streamed response'
      const stream = await client.responses.create({
        stream: true,
        input: [{ role: 'user', content }, { role: 'user', content: 'What does 1 plus 1 equal?' }],
        model: 'gpt-4'
      })

      let chunk = {}
      for await (chunk of stream) {
        continue
      }
      const res = chunk.response?.output?.[0]?.content?.[0]?.text
      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 4, 'should create a chat completion message and summary event')
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      assertChatCompletionMessages({
        tx,
        chatMsgs,
        id: 'resp_684886977be881928c9db234e14ae7d80f8976796514dff9',
        model: 'gpt-4-0613',
        resContent: res,
        reqContent: content
      })

      tx.end()
      end()
    })
  })

  await t.test('should call the tokenCountCallback in streaming', (t, end) => {
    const { client, agent } = t.nr
    const promptContent = 'Streamed response'
    const promptContent2 = 'What does 1 plus 1 equal?'
    const res = 'Test stream'
    const api = helper.getAgentApi()
    function cb(model, content) {
      // could be gpt-4 or gpt-4-0613
      assert.ok(model === 'gpt-4' || model === 'gpt-4-0613', 'should be gpt-4 or gpt-4-0613')
      if (content === promptContent || content === promptContent2) {
        return 53
      } else if (content === res) {
        return 11
      }
    }
    api.setLlmTokenCountCallback(cb)
    helper.runInTransaction(agent, async (tx) => {
      const stream = await client.responses.create({
        model: 'gpt-4',
        input: [
          { role: 'user', content: promptContent },
          { role: 'user', content: promptContent2 }
        ],
        stream: true
      })

      let chunk = {}
      for await (chunk of stream) {
        continue
      }
      assert.equal(res, chunk.response?.output?.[0]?.content?.[0]?.text)
      const events = agent.customEventAggregator.events.toArray()
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      assertChatCompletionMessages({
        tokenUsage: true,
        tx,
        chatMsgs,
        id: 'resp_684886977be881928c9db234e14ae7d80f8976796514dff9',
        model: 'gpt-4-0613',
        resContent: res,
        reqContent: promptContent
      })

      tx.end()
      end()
    })
  })

  await t.test('handles error in stream', (t, end) => {
    const { client, agent } = t.nr
    helper.runInTransaction(agent, async (tx) => {
      const content = 'bad stream'
      const model = 'gpt-4'

      try {
        await client.responses.create({
          model,
          input: [
            { role: 'user', content },
            { role: 'user', content: 'What does 1 plus 1 equal?' }
          ],
          stream: true
        })
      } catch (err) {
        assert.ok(err.message, '500 fetch failed')
        const events = agent.customEventAggregator.events.toArray()
        assert.equal(events.length, 4)
        const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
        assertChatCompletionSummary({ tx, model, chatSummary, error: true })
        assert.equal(tx.exceptions.length, 1)
        // only asserting message and completion_id as the rest of the attrs
        // are asserted in other tests
        match(tx.exceptions[0], {
          customAttributes: {
            'error.message': /500 fetch failed/,
            completion_id: /\w{32}/
          }
        })

        tx.end()
        end()
      }
    })
  })

  await t.test('should not create llm events when ai_monitoring.streaming.enabled is false', (t, end) => {
    const { client, agent } = t.nr
    agent.config.ai_monitoring.streaming.enabled = false
    helper.runInTransaction(agent, async (tx) => {
      const content = 'Streamed response'
      const model = 'gpt-4'
      const stream = await client.responses.create({
        model,
        input: [{ role: 'user', content }],
        stream: true
      })

      let chunk = {}
      for await (chunk of stream) {
        continue
      }
      const res = chunk.response?.output?.[0]?.content?.[0]?.text
      const expectedRes = responses.get(content)
      assert.equal(res, expectedRes.body.response.output[0].content[0].text)

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
})
