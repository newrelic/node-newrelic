/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const {
  afterEach,
  assertChatCompletionMessages,
  assertChatCompletionSummary,
  assertChatCompletionMessage,
  getAiResponseServer
} = require('./common')
const helper = require('../../lib/agent_helper')
const { FAKE_CREDENTIALS } = require('../../lib/aws-server-stubs')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const { assertSegments, match } = require('../../lib/custom-assertions')
const promiseResolvers = require('../../lib/promise-resolvers')
const { tspl } = require('@matteo.collina/tspl')
const createAiResponseServer = getAiResponseServer()

function consumeStreamChunk() {
  // A no-op function used to consume chunks of a stream.
}

const requests = {
  amazon: (prompt, modelId) => {
    return {
      body: JSON.stringify({
        inputText: prompt,
        textGenerationConfig: { temperature: 0.5, maxTokenCount: 100 }
      }),
      modelId
    }
  },
  claude: (prompt, modelId) => {
    return {
      body: JSON.stringify({ prompt, temperature: 0.5, max_tokens_to_sample: 100 }),
      modelId
    }
  },
  claude3: (prompt, modelId) => {
    return {
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 100,
        temperature: 0.5,
        system: 'Please respond in the style of Christopher Walken',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      modelId
    }
  },
  claude3Chunked: (chunks, modelId) => {
    return {
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 100,
        temperature: 0.5,
        system: 'Please respond in the style of Christopher Walken',
        messages: chunks
      }),
      modelId
    }
  },
  cohere: (prompt, modelId) => {
    return {
      body: JSON.stringify({ prompt, temperature: 0.5, max_tokens: 100 }),
      modelId
    }
  },
  llama: (prompt, modelId) => {
    return {
      body: JSON.stringify({ prompt, max_gen_length: 100, temperature: 0.5 }),
      modelId
    }
  }
}

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    ai_monitoring: {
      enabled: true
    }
  })
  const bedrock = require('@aws-sdk/client-bedrock-runtime')
  ctx.nr.bedrock = bedrock

  const { server, baseUrl, responses, host, port } = await createAiResponseServer()
  ctx.nr.server = server
  ctx.nr.baseUrl = baseUrl
  ctx.nr.responses = responses
  ctx.nr.expectedExternalPath = (modelId, method = 'invoke') => `External/${host}:${port}/model/${encodeURIComponent(modelId)}/${method}`

  ctx.nr.client = new bedrock.BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl,
    maxAttempts: 1
  })
})

test.afterEach(afterEach)
;[
  { modelId: 'amazon.titan-text-express-v1', resKey: 'amazon' },
  { modelId: 'anthropic.claude-v2', resKey: 'claude' },
  { modelId: 'us.anthropic.claude-v2', resKey: 'claude' },
  { modelId: 'anthropic.claude-3-haiku-20240307-v1:0', resKey: 'claude3' },
  { modelId: 'us.anthropic.claude-3-haiku-20240307-v1:0', resKey: 'claude3' },
  { modelId: 'cohere.command-text-v14', resKey: 'cohere' },
  { modelId: 'meta.llama3-8b-instruct-v1:0', resKey: 'llama' }
].forEach(({ modelId, resKey }) => {
  test(`${modelId}: should properly create completion segment`, async (t) => {
    const { bedrock, client, responses, agent, expectedExternalPath } = t.nr
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)

    const command = new bedrock.InvokeModelCommand(input)

    const expected = responses[resKey].get(prompt)
    await helper.runInTransaction(agent, async (tx) => {
      const response = await client.send(command)
      const body = JSON.parse(response.body.transformToString('utf8'))
      assert.equal(response.$metadata.requestId, expected.headers['x-amzn-requestid'])
      assert.deepEqual(body, expected.body)
      assertSegments(
        tx.trace,
        tx.trace.root,
        ['Llm/completion/Bedrock/InvokeModelCommand', [expectedExternalPath(modelId)]],
        { exact: false }
      )
      tx.end()
    })
  })

  test(`${modelId}:  properly create the LlmChatCompletionMessage(s) and LlmChatCompletionSummary events`, async (t) => {
    const { bedrock, client, agent } = t.nr
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    const api = helper.getAgentApi()
    await helper.runInTransaction(agent, async (tx) => {
      api.addCustomAttribute('llm.conversation_id', 'convo-id')
      await client.send(command)
      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 3)
      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')

      assertChatCompletionMessages({
        modelId,
        prompt,
        resContent: '42',
        tx,
        expectedId: modelId.includes('ai21') || modelId.includes('cohere') ? '1234' : null,
        chatMsgs
      })

      assertChatCompletionSummary({ tx, modelId, chatSummary })

      tx.end()
    })
  })

  test(`${modelId}:  supports custom attributes on LlmChatCompletionMessage(s) and LlmChatCompletionSummary events`, async (t) => {
    const { bedrock, client, agent } = t.nr
    const { promise, resolve } = promiseResolvers()
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    const api = helper.getAgentApi()
    helper.runInTransaction(agent, (tx) => {
      api.addCustomAttribute('llm.conversation_id', 'convo-id')
      api.withLlmCustomAttributes({ 'llm.contextAttribute': 'someValue' }, async () => {
        await client.send(command)
        const events = agent.customEventAggregator.events.toArray()

        const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
        const [, message] = chatSummary
        assert.equal(message['llm.contextAttribute'], 'someValue')

        tx.end()
        resolve()
      })
    })
    await promise
  })

  test(`${modelId}: text answer (streamed)`, async (t) => {
    const { bedrock, client, agent } = t.nr
    const prompt = `text ${resKey} ultimate question streamed`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelWithResponseStreamCommand(input)

    const api = helper.getAgentApi()
    await helper.runInTransaction(agent, async (tx) => {
      api.addCustomAttribute('llm.conversation_id', 'convo-id')

      const response = await client.send(command)
      for await (const event of response.body) {
        // no-op iteration over the stream in order to exercise the instrumentation
        consumeStreamChunk(event)
      }

      const events = agent.customEventAggregator.events.toArray()
      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      assert.equal(events.length > 2, true)

      assertChatCompletionMessages({
        modelId,
        prompt,
        resContent: '42',
        tx,
        expectedId: modelId.includes('ai21') || modelId.includes('cohere') ? '1234' : null,
        chatMsgs
      })

      assertChatCompletionSummary({ tx, modelId, chatSummary, numMsgs: events.length - 1 })

      tx.end()
    })
  })

  test('should record feedback message accordingly', async (t) => {
    const { bedrock, client, agent } = t.nr
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    const api = helper.getAgentApi()
    await helper.runInTransaction(agent, async (tx) => {
      await client.send(command)
      const { traceId } = api.getTraceMetadata()
      api.recordLlmFeedbackEvent({
        traceId,
        category: 'test-event',
        rating: '5 star',
        message: 'You are a mathematician.',
        metadata: { foo: 'foo' }
      })
      const recordedEvents = agent.customEventAggregator.getEvents()
      const [[, feedback]] = recordedEvents.filter(([{ type }]) => type === 'LlmFeedbackMessage')

      match(feedback, {
        id: /\w{32}/,
        trace_id: traceId,
        category: 'test-event',
        rating: '5 star',
        message: 'You are a mathematician.',
        ingest_source: 'Node',
        foo: 'foo'
      })

      tx.end()
    })
  })

  test(`${modelId}: should increment tracking metric for each chat completion event`, async (t) => {
    const { bedrock, client, agent } = t.nr
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)
    await helper.runInTransaction(agent, async (tx) => {
      await client.send(command)
      const metrics = getPrefixedMetric({
        agent,
        metricPrefix: 'Supportability/Nodejs/ML/Bedrock'
      })
      assert.equal(metrics.callCount > 0, true)
      tx.end()
    })
  })

  test(`${modelId}: should properly create errors on create completion`, async (t) => {
    const { bedrock, client, agent, expectedExternalPath } = t.nr
    const prompt = `text ${resKey} ultimate question error`
    const input = requests[resKey](prompt, modelId)

    const command = new bedrock.InvokeModelCommand(input)
    const expectedMsg =
      'Malformed input request: 2 schema violations found, please reformat your input and try again.'
    const expectedType = 'ValidationException'

    const api = helper.getAgentApi()
    await helper.runInTransaction(agent, async (tx) => {
      api.addCustomAttribute('llm.conversation_id', 'convo-id')
      try {
        await client.send(command)
      } catch (err) {
        assert.equal(err.message, expectedMsg)
        assert.equal(err.name, expectedType)
      }

      assert.equal(tx.exceptions.length, 1)
      match(tx.exceptions[0], {
        error: {
          name: expectedType,
          message: expectedMsg
        },
        customAttributes: {
          'http.statusCode': 400,
          'error.message': expectedMsg,
          'error.code': expectedType,
          completion_id: /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/
        },
        agentAttributes: {
          spanId: /\w+/
        }
      })

      assertSegments(
        tx.trace,
        tx.trace.root,
        ['Llm/completion/Bedrock/InvokeModelCommand', [expectedExternalPath(modelId)]],
        { exact: false }
      )

      const events = agent.customEventAggregator.events.toArray()
      assert.equal(events.length, 2)
      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')

      assertChatCompletionMessages({
        modelId,
        prompt,
        tx,
        chatMsgs
      })

      assertChatCompletionSummary({ tx, modelId, chatSummary, error: true })
      tx.end()
    })
  })

  test(`{${modelId}:}: should add llm attribute to transaction`, async (t) => {
    const { bedrock, client, agent } = t.nr
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    await helper.runInTransaction(agent, async (tx) => {
      await client.send(command)
      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      assert.equal(attributes.llm, true)

      tx.end()
    })
  })

  test(`${modelId}: should decorate messages with custom attrs`, async (t) => {
    const { bedrock, client, agent } = t.nr
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    await helper.runInTransaction(agent, async (tx) => {
      const api = helper.getAgentApi()
      api.addCustomAttribute('llm.foo', 'bar')

      await client.send(command)

      const events = tx.agent.customEventAggregator.events.toArray()
      const summary = events
        .filter((e) => e[0].type === 'LlmChatCompletionSummary')
        .map((e) => e[1])
        .pop()
      const completion = events
        .filter((e) => e[0].type === 'LlmChatCompletionMessage')
        .map((e) => e[1])
        .pop()

      assert.equal(summary['llm.foo'], 'bar')
      assert.equal(completion['llm.foo'], 'bar')

      tx.end()
    })
  })
})

test('cohere embedding streaming works', async (t) => {
  const { bedrock, client, agent } = t.nr
  const prompt = 'embed text cohere stream'
  const input = {
    body: JSON.stringify({
      texts: prompt.split(' '),
      input_type: 'search_document'
    }),
    modelId: 'cohere.embed-english-v3'
  }
  const command = new bedrock.InvokeModelWithResponseStreamCommand(input)

  const api = helper.getAgentApi()
  await helper.runInTransaction(agent, async (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')

    const response = await client.send(command)
    for await (const event of response.body) {
      // no-op iteration over the stream in order to exercise the instrumentation
      consumeStreamChunk(event)
    }

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 1)
    const embedding = events.shift()[1]
    assert.equal(embedding.error, false)
    assert.equal(embedding.input, prompt)

    tx.end()
  })
})

test('anthropic-claude-3: should properly create events for chunked messages', async (t) => {
  const { bedrock, client, agent } = t.nr
  const modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  const prompt = 'text claude3 ultimate question chunked'
  const promptFollowUp = 'And please include an image in the response'
  const input = requests.claude3Chunked(
    [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: promptFollowUp
          }
        ]
      }
    ],
    modelId
  )

  const command = new bedrock.InvokeModelCommand(input)

  const api = helper.getAgentApi()
  await helper.runInTransaction(agent, async (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')
    await client.send(command)

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 4)
    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    const chatMsgs = events
      .filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      .sort(([, a], [, b]) => a.sequence - b.sequence)

    assertChatCompletionMessage({
      tx,
      message: chatMsgs[0],
      modelId,
      expectedContent: prompt,
      isResponse: false,
      expectedRole: 'user'
    })

    assertChatCompletionMessage({
      tx,
      message: chatMsgs[1],
      modelId,
      expectedContent: promptFollowUp,
      isResponse: false,
      expectedRole: 'user'
    })

    // Note the <image> placeholder for the image chunk
    assertChatCompletionMessage({
      tx,
      message: chatMsgs[2],
      modelId,
      expectedContent: "Here's a nice picture of a 42\n\n<image>",
      isResponse: true,
      expectedRole: 'assistant'
    })

    assertChatCompletionSummary({ tx, modelId, chatSummary, numMsgs: 3 })
    tx.end()
  })
})

test('region specific anthropic-claude-3: should properly create events for chunked messages', async (t) => {
  const { bedrock, client, agent } = t.nr
  const modelId = 'us.anthropic.claude-3-5-sonnet-20240620-v1:0'
  const prompt = 'text claude3 ultimate question chunked'
  const promptFollowUp = 'And please include an image in the response'
  const input = requests.claude3Chunked(
    [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: promptFollowUp
          }
        ]
      }
    ],
    modelId
  )

  const command = new bedrock.InvokeModelCommand(input)

  const api = helper.getAgentApi()
  await helper.runInTransaction(agent, async (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')
    await client.send(command)

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 4)
    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    const chatMsgs = events
      .filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      .sort(([, a], [, b]) => a.sequence - b.sequence)

    assertChatCompletionMessage({
      tx,
      message: chatMsgs[0],
      modelId,
      expectedContent: prompt,
      isResponse: false,
      expectedRole: 'user'
    })

    assertChatCompletionMessage({
      tx,
      message: chatMsgs[1],
      modelId,
      expectedContent: promptFollowUp,
      isResponse: false,
      expectedRole: 'user'
    })

    // Note the <image> placeholder for the image chunk
    assertChatCompletionMessage({
      tx,
      message: chatMsgs[2],
      modelId,
      expectedContent: "Here's a nice picture of a 42\n\n<image>",
      isResponse: true,
      expectedRole: 'assistant'
    })

    assertChatCompletionSummary({ tx, modelId, chatSummary, numMsgs: 3 })
    tx.end()
  })
})

test('models that do not support streaming should be handled', async (t) => {
  const { bedrock, client, agent, expectedExternalPath } = t.nr
  const modelId = 'amazon.titan-embed-text-v1'
  const prompt = 'embed text amazon error streamed'
  const input = requests.amazon(prompt, modelId)

  const command = new bedrock.InvokeModelWithResponseStreamCommand(input)
  const expectedMsg = 'The model is unsupported for streaming'
  const expectedType = 'ValidationException'

  const api = helper.getAgentApi()
  await helper.runInTransaction(agent, async (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')
    try {
      await client.send(command)
    } catch (err) {
      assert.equal(err.message, expectedMsg)
      assert.equal(err.name, expectedType)
    }

    assert.equal(tx.exceptions.length, 1)
    match(tx.exceptions[0], {
      error: {
        name: expectedType,
        message: expectedMsg
      },
      customAttributes: {
        'http.statusCode': 400,
        'error.message': expectedMsg,
        'error.code': expectedType,
        completion_id: undefined
      },
      agentAttributes: {
        spanId: /\w+/
      }
    })

    assertSegments(
      tx.trace,
      tx.trace.root,
      [
        'Llm/embedding/Bedrock/InvokeModelWithResponseStreamCommand',
        [expectedExternalPath(modelId, 'invoke-with-response-stream')]
      ],
      { exact: false }
    )

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 1)
    const embedding = events.shift()[1]
    assert.equal(embedding.error, true)

    tx.end()
  })
})

test('models should properly create errors on stream interruption', async (t) => {
  const { bedrock, client, agent } = t.nr
  const modelId = 'amazon.titan-text-express-v1'
  const prompt = 'text amazon bad stream'
  const input = requests.amazon(prompt, modelId)

  const httpError = {
    code: 'ECONNRESET',
    message: /aborted/,
    $response: {
      statusCode: 500
    }
  }
  const http2Error = {
    message: /Unterminated string in JSON|Unexpected non-whitespace character/,
    $response: {
      statusCode: 500
    }
  }

  const command = new bedrock.InvokeModelWithResponseStreamCommand(input)
  await helper.runInTransaction(agent, async (tx) => {
    try {
      await client.send(command)
    } catch (error) {
      // http errors are different from http2 errors
      if (error.code) {
        match(error, httpError)
      } else {
        match(error, http2Error)
      }
    }

    const events = agent.customEventAggregator.events.toArray()
    const summary = events.find((e) => e[0].type === 'LlmChatCompletionSummary')[1]
    assert.equal(tx.exceptions.length, 1)
    assert.equal(events.length, 2)
    assert.equal(summary.error, true)

    tx.end()
  })
})

test('should not instrument stream when disabled', async (t) => {
  const modelId = 'amazon.titan-text-express-v1'
  const { bedrock, client, agent } = t.nr
  agent.config.ai_monitoring.streaming.enabled = false
  const prompt = 'text amazon ultimate question streamed'
  const input = requests.amazon(prompt, modelId)
  const command = new bedrock.InvokeModelWithResponseStreamCommand(input)

  await helper.runInTransaction(agent, async (tx) => {
    const response = await client.send(command)
    let chunk = {}
    let inputCount = null
    let completion = ''
    // build up the response to assert it does not get tainted when streaming is disabled
    for await (const event of response.body) {
      const obj = JSON.parse(new TextDecoder('utf-8').decode(event.chunk.bytes))
      chunk = { ...obj }
      completion += obj.outputText
      if (obj.inputTextTokenCount) {
        inputCount = obj.inputTextTokenCount
      }
    }
    chunk.inputTextTokenCount = inputCount
    chunk.outputText = completion
    assert.deepEqual(
      chunk,
      {
        outputText: '42',
        index: 0,
        totalOutputTextTokenCount: 75,
        completionReason: 'endoftext',
        inputTextTokenCount: 13,
        'amazon-bedrock-invocationMetrics': {
          inputTokenCount: 8,
          outputTokenCount: 4,
          invocationLatency: 3879,
          firstByteLatency: 3291
        }
      },
      'should not interfere with stream'
    )

    const events = agent.customEventAggregator.events.toArray()
    assert.equal(events.length, 0, 'should not create Llm events when streaming is disabled')
    const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
    assert.equal(attributes.llm, true, 'should assign llm attribute to transaction trace')
    const metrics = getPrefixedMetric({
      agent,
      metricPrefix: 'Supportability/Nodejs/ML/Bedrock'
    })
    assert.equal(metrics.callCount > 0, true, 'should set framework metric')
    const supportabilityMetrics = agent.metrics.getOrCreateMetric(
      'Supportability/Nodejs/ML/Streaming/Disabled'
    )
    assert.equal(
      supportabilityMetrics.callCount > 0,
      true,
      'should increment streaming disabled metric'
    )

    tx.end()
  })
})

test('should utilize tokenCountCallback when set', async (t) => {
  const plan = tspl(t, { plan: 5 })

  const { bedrock, client, agent } = t.nr
  const prompt = 'text amazon user token count callback response'
  const input = requests.amazon(prompt, 'amazon.titan-text-express-v1')

  agent.config.ai_monitoring.record_content.enabled = false
  agent.llm.tokenCountCallback = function (model, content) {
    plan.equal(model, 'amazon.titan-text-express-v1')
    plan.equal([prompt, '42'].includes(content), true)
    return content?.split(' ')?.length
  }
  const command = new bedrock.InvokeModelCommand(input)

  await helper.runInTransaction(agent, async (tx) => {
    await client.send(command)

    // Chat completion messages should have the correct `token_count` value.
    const events = agent.customEventAggregator.events.toArray()
    const completions = events.filter((e) => e[0].type === 'LlmChatCompletionMessage')
    plan.equal(
      completions.some((e) => e[1].token_count === 7),
      true
    )

    tx.end()
  })
})

function getPrefixedMetric({ agent, metricPrefix }) {
  for (const [key, value] of Object.entries(agent.metrics._metrics.unscoped)) {
    if (key.startsWith(metricPrefix) === false) {
      continue
    }
    return value
  }
}
