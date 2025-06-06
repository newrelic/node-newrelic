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
const createOpenAIMockServer = require('./mock-server-v5')
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

      // TODO: why is External segment missing?
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

  await t.test('invalid payload errors should be tracked', (t, end) => {
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

  await t.test('should record LLM custom events with attributes', (t, end) => {
    const { client, agent } = t.nr
    const api = helper.getAgentApi()

    helper.runInTransaction(agent, () => {
      api.withLlmCustomAttributes({ 'llm.shared': true, 'llm.path': 'root/' }, async () => {
        await api.withLlmCustomAttributes(
          { 'llm.path': 'root/branch1', 'llm.attr1': true },
          async () => {
            agent.config.ai_monitoring.streaming.enabled = true
            const model = 'gpt-4'
            const content = 'You are a mathematician.'
            await client.responses.create({
              model,
              input: [
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
            const model = 'gpt-4'
            const content = 'You are a mathematician.'
            await client.responses.create({
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
