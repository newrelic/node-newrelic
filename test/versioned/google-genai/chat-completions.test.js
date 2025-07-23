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
const { assertChatCompletionMessages, assertChatCompletionSummary } = require('./common')
const GoogleGenAIMockServer = require('./mock-server')
const helper = require('../../lib/agent_helper')

const {
  AI: { GEMINI }
} = require('../../../lib/metrics/names')
// have to read and not require because @google/genai does not export the package.json
const { version: pkgVersion } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '/node_modules/@google/genai/package.json'))
)
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const responses = require('./mock-responses')
const TRACKING_METRIC = `Supportability/Nodejs/ML/Gemini/${pkgVersion}`

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  const { host, port, server } = await GoogleGenAIMockServer()
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
  const { GoogleGenAI } = require('@google/genai')

  ctx.nr.client = new GoogleGenAI({
    apiKey: 'fake-versioned-test-key',
    vertexai: false,
    httpOptions: {
      baseUrl: `http://${host}:${port}/`,
    },
    httpMethod: 'GET'
  })
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server?.close()
  removeModules('@google/genai')
})

test('should create span on successful models generateContent', (t, end) => {
  const { client, agent, host, port } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const model = 'gemini-2.0-flash'
    const result = await client.models.generateContent({
      model,
      contents: 'You are a mathematician.'
    })

    assert.equal(result.headers, undefined, 'should remove response headers from user result')
    assert.equal(result.candidates[0].content.parts[0].text, '1 plus 2 is 3.')

    const name = `External/${host}:${port}/v1beta/models/${model}:generateContent`
    assertSegments(
      tx.trace,
      tx.trace.root,
      [GEMINI.COMPLETION, [name]],
      { exact: false }
    )

    tx.end()
    assertSpanKind({
      agent,
      segments: [
        { name: GEMINI.COMPLETION, kind: 'internal' }
      ]
    })
    end()
  })
})

test('should increment tracking metric for each chat completion event', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'You are a mathematician.'
    })

    const metrics = agent.metrics.getOrCreateMetric(TRACKING_METRIC)
    assert.equal(metrics.callCount > 0, true)

    tx.end()
    end()
  })
})

test('should create chat completion message and summary for every message sent', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const model = 'gemini-2.0-flash'
    const content = 'You are a mathematician.'
    await client.models.generateContent({
      model,
      contents: [content, 'What does 1 plus 1 equal?'],
      config: {
        maxOutputTokens: 100,
        temperature: 0.5
      }
    })

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 4, 'should create a chat completion message and summary event')
    const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
    assertChatCompletionMessages({
      tx,
      chatMsgs,
      model,
      resContent: '1 plus 2 is 3.',
      reqContent: content
    })

    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    assertChatCompletionSummary({ tx, model, chatSummary, tokenUsage: true })

    tx.end()
    end()
  })
})

// Streaming tests
test('should create span on successful models generateContentStream', (t, end) => {
  const { client, agent, host, port } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    const content = 'Streamed response'
    const model = 'gemini-2.0-flash'
    const stream = await client.models.generateContentStream({
      model,
      contents: content
    })

    let chunk = {}
    let res = ''
    for await (chunk of stream) {
      assert.ok(chunk.text, 'should have text in chunk')
      res += chunk.text
    }

    assert.equal(chunk.headers, undefined, 'should remove response headers from user result')
    assert.equal(chunk.candidates[0].content.role, 'model')
    const expectedRes = responses.get(content)
    assert.equal(chunk.candidates[0].content.parts[0].text, expectedRes.body.candidates[0].content.parts[0].text)
    assert.equal(chunk.candidates[0].content.parts[0].text, res)

    const name = `External/${host}:${port}/v1beta/models/${model}:streamGenerateContent`
    assertSegments(
      tx.trace,
      tx.trace.root,
      [GEMINI.COMPLETION, [name]],
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
    const model = 'gemini-2.0-flash'
    const stream = await client.models.generateContentStream({
      config: {
        maxOutputTokens: 100,
        temperature: 0.5
      },
      model,
      contents: [content, 'What does 1 plus 1 equal?']
    })

    let res = ''
    for await (const chunk of stream) {
      assert.ok(chunk.text, 'should have text in chunk')
      res += chunk.text
    }

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 4, 'should create a chat completion message and summary event')
    const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
    assertChatCompletionMessages({
      tx,
      chatMsgs,
      id: '0e7e48f05cf962e1692113a49b276e8bb1bc',
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
  const expectedModel = 'gemini-2.0-flash'
  const api = helper.getAgentApi()
  let cbCalled = false
  function cb(model, content) {
    assert.equal(model, expectedModel)
    cbCalled = true
    if (content === promptContent || content === promptContent2) {
      return 53
    } else if (content === res) {
      return 11
    }
  }
  api.setLlmTokenCountCallback(cb)

  helper.runInTransaction(agent, async (tx) => {
    const stream = await client.models.generateContentStream({
      config: {
        maxOutputTokens: 100,
        temperature: 0.5
      },
      model: expectedModel,
      contents: [promptContent, promptContent2]
    })

    for await (const chunk of stream) {
      assert.ok(chunk.text, 'should have text in chunk')
      res += chunk.text
    }

    assert.equal(cbCalled, true, 'should call the token count callback')
    const events = agent.customEventAggregator.events.toArray()
    const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
    assertChatCompletionMessages({
      tokenUsage: true,
      tx,
      chatMsgs,
      id: '"0e7e48f05cf962e1692113a49b276e8bb1bc"',
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
    const model = 'gemini-2.0-flash'

    try {
      const stream = await client.models.generateContentStream({
        model,
        contents: [content, content, content],
        config: {
          maxOutputTokens: 100,
          temperature: 0.5
        }
      })

      for await (const chunk of stream) {
        // No-op to trigger the error
        assert.ok(chunk)
      }
    } catch {
      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 4)
      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      assertChatCompletionSummary({ tx, model, chatSummary, error: true })
      assert.equal(tx.exceptions.length, 1)
      // only asserting message and completion_id as the rest of the attrs
      // are asserted in other tests
      match(tx.exceptions[0], {
        customAttributes: {
          'error.message': /.*bad stream.*/,
          completion_id: /\w{32}/
        }
      })

      tx.end()
      end()
    }
  })
})

// Other tests
test('should not create llm events when ai_monitoring.streaming.enabled is false', (t, end) => {
  const { client, agent } = t.nr
  agent.config.ai_monitoring.streaming.enabled = false
  helper.runInTransaction(agent, async (tx) => {
    const content = 'Streamed response'
    const model = 'gemini-2.0-flash'
    const stream = await client.models.generateContentStream({
      config: {
        maxOutputTokens: 100,
        temperature: 0.5
      },
      model,
      contents: content
    })

    let res = ''
    let chunk = {}

    for await (chunk of stream) {
      assert.ok(chunk.text, 'should have text in chunk')
      res += chunk.text
    }
    const expectedRes = responses.get(content)
    assert.equal(res, expectedRes.body.candidates[0].content.parts[0].text)

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not llm events when streaming is disabled')
    const streamingDisabled = agent.metrics.getOrCreateMetric(
      'Supportability/Nodejs/ML/Streaming/Disabled'
    )
    assert.equal(streamingDisabled.callCount > 0, true)

    tx.end()
    end()
  })
})

test('should not create llm events when not in a transaction', async (t) => {
  const { client, agent } = t.nr
  await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: 'You are a mathematician.'
  })

  const events = agent.customEventAggregator.events.toArray()
  assert.equal(events.length, 0, 'should not create llm events')
})

test('auth errors should be tracked', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    try {
      await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: 'Invalid API key.'
      })
    } catch {}

    assert.equal(tx.exceptions.length, 1)
    match(tx.exceptions[0], {
      error: {
        message: /.*API key not valid. Please pass a valid API key.*/
      },
      customAttributes: {
        'http.statusCode': 400,
        'error.message': /.*API key not valid. Please pass a valid API key..*/,
        'error.code': 400,
        'error.param': undefined,
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

test('should add llm attribute to transaction', (t, end) => {
  const { client, agent } = t.nr
  helper.runInTransaction(agent, async (tx) => {
    await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'You are a mathematician.'
    })

    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true)

    tx.end()
    end()
  })
})

test('should record LLM custom events with attributes', (t, end) => {
  const { client, agent } = t.nr
  const api = helper.getAgentApi()

  helper.runInTransaction(agent, () => {
    api.withLlmCustomAttributes({ 'llm.shared': true, 'llm.path': 'root/' }, async () => {
      await api.withLlmCustomAttributes(
        { 'llm.path': 'root/branch1', 'llm.attr1': true },
        async () => {
          agent.config.ai_monitoring.streaming.enabled = true
          const model = 'gemini-2.0-flash'
          const content = 'You are a mathematician.'
          await client.models.generateContent({
            config: {
              max_tokens: 100,
              temperature: 0.5
            },
            model,
            contents: [content, 'What does 1 plus 1 equal?']
          })
        }
      )

      await api.withLlmCustomAttributes(
        { 'llm.path': 'root/branch2', 'llm.attr2': true },
        async () => {
          agent.config.ai_monitoring.streaming.enabled = true
          const model = 'gemini-2.0-flash'
          const content = 'You are a mathematician.'
          await client.models.generateContent({
            config: {
              max_tokens: 100,
              temperature: 0.5
            },
            model,
            contents: [content, 'What does 1 plus 2 equal?']
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
