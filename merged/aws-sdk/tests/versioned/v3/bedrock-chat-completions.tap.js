/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
utils(tap)
const common = require('../common')
const createAiResponseServer = require('./ai-server')
const { FAKE_CREDENTIALS } = require('../aws-server-stubs')
const { version: pkgVersion } = require('@smithy/smithy-client/package.json')
const { DESTINATIONS } = require('../../../lib/util')

const requests = {
  ai21: (prompt, modelId) => ({
    body: JSON.stringify({ prompt, temperature: 0.5, maxTokens: 100 }),
    modelId
  }),
  amazon: (prompt, modelId) => ({
    body: JSON.stringify({
      inputText: prompt,
      textGenerationConfig: { temperature: 0.5, maxTokenCount: 100 }
    }),
    modelId
  }),
  claude: (prompt, modelId) => ({
    body: JSON.stringify({ prompt, temperature: 0.5, max_tokens_to_sample: 100 }),
    modelId
  }),
  cohere: (prompt, modelId) => ({
    body: JSON.stringify({ prompt, temperature: 0.5, max_tokens: 100 }),
    modelId
  }),
  llama2: (prompt, modelId) => ({
    body: JSON.stringify({ prompt, max_gen_length: 100, temperature: 0.5 }),
    modelId
  })
}

tap.beforeEach(async (t) => {
  const helper = utils.TestAgent.makeInstrumented({
    ai_monitoring: {
      enabled: true
    }
  })
  common.registerInstrumentation(helper)
  t.context.helper = helper

  const bedrock = require('@aws-sdk/client-bedrock-runtime')
  t.context.bedrock = bedrock

  const { server, baseUrl, responses, host, port } = await createAiResponseServer()
  t.context.server = server
  t.context.baseUrl = baseUrl
  t.context.responses = responses
  t.context.expectedExternalPath = (modelId) => `External/${host}:${port}/model/${modelId}/invoke`

  const client = new bedrock.BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: FAKE_CREDENTIALS,
    endpoint: baseUrl,
    maxAttempts: 1
  })
  t.context.client = client
})

tap.afterEach(async (t) => {
  t.context.helper.unload()
  t.context.server.destroy()
  Object.keys(require.cache).forEach((key) => {
    if (
      key.includes('@smithy/smithy-client') ||
      key.includes('@aws-sdk/smithy-client') ||
      key.includes('@aws-sdk/client-bedrock-runtime')
    ) {
      delete require.cache[key]
    }
  })
})
;[
  { modelId: 'ai21.j2-ultra-v1', resKey: 'ai21' },
  { modelId: 'amazon.titan-text-express-v1', resKey: 'amazon' },
  { modelId: 'anthropic.claude-v2', resKey: 'claude' },
  { modelId: 'cohere.command-text-v14', resKey: 'cohere' },
  { modelId: 'meta.llama2-13b-chat-v1', resKey: 'llama2' }
].forEach(({ modelId, resKey }) => {
  tap.test(`${modelId}: should properly create completion segment`, (t) => {
    const { bedrock, client, responses, helper, expectedExternalPath } = t.context
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)

    const command = new bedrock.InvokeModelCommand(input)

    const expected = responses[resKey].get(prompt)
    helper.runInTransaction(async (tx) => {
      const response = await client.send(command)
      const body = JSON.parse(response.body.transformToString('utf8'))
      t.equal(response.$metadata.requestId, expected.headers['x-amzn-requestid'])
      t.same(body, expected.body)
      t.segments(tx.trace.root, [
        {
          name: 'Llm/completion/Bedrock/InvokeModelCommand',
          children: [{ name: expectedExternalPath(modelId) }]
        }
      ])
      tx.end()
      t.end()
    })
  })

  tap.test(
    `${modelId}:  properly create the LlmChatCompletionMessage(s) and LlmChatCompletionSummary events`,
    (t) => {
      const { bedrock, client, helper } = t.context
      const prompt = `text ${resKey} ultimate question`
      const input = requests[resKey](prompt, modelId)
      const command = new bedrock.InvokeModelCommand(input)

      const { agent } = helper
      const api = helper.getAgentApi()
      helper.runInTransaction(async (tx) => {
        api.addCustomAttribute('llm.conversation_id', 'convo-id')
        await client.send(command)
        const events = agent.customEventAggregator.events.toArray()
        t.equal(events.length, 3)
        const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
        const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')

        t.llmMessages({
          modelId,
          prompt,
          resContent: '42',
          tx,
          expectedId: modelId.includes('ai21') || modelId.includes('cohere') ? '1234' : null,
          chatMsgs
        })

        t.llmSummary({ tx, modelId, chatSummary, tokenUsage: true })

        tx.end()
        t.end()
      })
    }
  )

  tap.test(`${modelId}: text answer (streamed)`, (t) => {
    if (modelId.includes('ai21')) {
      t.skip('model does not support streaming')
      t.end()
      return
    }

    const { bedrock, client, helper } = t.context
    const prompt = `text ${resKey} ultimate question streamed`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelWithResponseStreamCommand(input)

    const { agent } = helper
    const api = helper.getAgentApi()
    helper.runInTransaction(async (tx) => {
      api.addCustomAttribute('llm.conversation_id', 'convo-id')

      const response = await client.send(command)
      for await (const event of response.body) {
        // no-op iteration over the stream in order to exercise the instrumentation
        event
      }

      const events = agent.customEventAggregator.events.toArray()
      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      t.equal(events.length > 2, true)

      t.llmMessages({
        modelId,
        prompt,
        resContent: '42',
        tx,
        expectedId: modelId.includes('ai21') || modelId.includes('cohere') ? '1234' : null,
        chatMsgs
      })

      t.llmSummary({ tx, modelId, chatSummary, tokenUsage: true, numMsgs: events.length - 1 })

      tx.end()
      t.end()
    })
  })

  tap.test('should store ids and record feedback message accordingly', (t) => {
    const { bedrock, client, helper } = t.context
    const conversationId = 'convo-id'
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    const { agent } = helper
    const api = helper.getAgentApi()
    helper.runInTransaction(async (tx) => {
      api.addCustomAttribute('llm.conversation_id', conversationId)
      const response = await client.send(command)
      const responseId = response.$metadata.requestId
      const events = agent.customEventAggregator.events.toArray()
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')
      const ids = api.getLlmMessageIds({ responseId })
      const messageIds = chatMsgs.map((msg) => msg[1].id)
      t.equal(ids.request_id, responseId)
      t.equal(ids.conversation_id, conversationId)
      // message_ids order varies over test run, sort them to assure consistency
      t.same(ids.message_ids.sort(), messageIds.sort())
      api.recordLlmFeedbackEvent({
        conversationId: ids.conversation_id,
        requestId: ids.request_id,
        messageId: ids.message_ids[0],
        category: 'test-event',
        rating: '5 star',
        message: 'You are a mathematician.',
        metadata: { foo: 'foo' }
      })
      const recordedEvents = agent.customEventAggregator.getEvents()
      const [[, feedback]] = recordedEvents.filter(([{ type }]) => type === 'LlmFeedbackMessage')

      t.match(feedback, {
        id: /[\w\d]{32}/,
        conversation_id: ids.conversation_id,
        request_id: ids.request_id,
        message_id: ids.message_ids[0],
        category: 'test-event',
        rating: '5 star',
        message: 'You are a mathematician.',
        ingest_source: 'Node',
        foo: 'foo'
      })

      tx.end()
      t.end()
    })
  })

  tap.test(`${modelId}: should increment tracking metric for each chat completion event`, (t) => {
    const { bedrock, client, helper } = t.context
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)
    const { agent } = helper
    helper.runInTransaction(async (tx) => {
      await client.send(command)
      const metrics = agent.metrics.getOrCreateMetric(`Nodejs/ML/Bedrock/${pkgVersion}`)
      t.equal(metrics.callCount > 0, true)
      tx.end()
      t.end()
    })
  })

  tap.test(`${modelId}: should properly create errors on create completion`, (t) => {
    const { bedrock, client, helper, expectedExternalPath } = t.context
    const prompt = `text ${resKey} ultimate question error`
    const input = requests[resKey](prompt, modelId)

    const command = new bedrock.InvokeModelCommand(input)
    const expectedMsg =
      'Malformed input request: 2 schema violations found, please reformat your input and try again.'
    const expectedType = 'ValidationException'

    const { agent } = helper
    const api = helper.getAgentApi()
    helper.runInTransaction(async (tx) => {
      api.addCustomAttribute('llm.conversation_id', 'convo-id')
      try {
        await client.send(command)
      } catch (err) {
        t.equal(err.message, expectedMsg)
        t.equal(err.name, expectedType)
      }

      t.equal(tx.exceptions.length, 1)
      t.match(tx.exceptions[0], {
        error: {
          name: expectedType,
          message: expectedMsg
        },
        customAttributes: {
          'http.statusCode': 400,
          'error.message': expectedMsg,
          'error.code': expectedType,
          'completion_id': /[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}/
        },
        agentAttributes: {
          spanId: /[\w\d]+/
        }
      })

      t.segments(tx.trace.root, [
        {
          name: 'Llm/completion/Bedrock/InvokeModelCommand',
          children: [{ name: expectedExternalPath(modelId) }]
        }
      ])

      const events = agent.customEventAggregator.events.toArray()
      t.equal(events.length, 2)
      const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
      const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')

      t.llmMessages({
        modelId,
        prompt,
        tx,
        chatMsgs
      })

      t.llmSummary({ tx, modelId, chatSummary, error: true })
      tx.end()
      t.end()
    })
  })

  tap.test(`{${modelId}:}: should add llm attribute to transaction`, (t) => {
    const { bedrock, client, helper } = t.context
    const prompt = `text ${resKey} ultimate question`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelCommand(input)

    helper.runInTransaction(async (tx) => {
      await client.send(command)
      const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attributes.llm, true)

      tx.end()
      t.end()
    })
  })
})

tap.test(`cohere embedding streaming works`, (t) => {
  const { bedrock, client, helper } = t.context
  const prompt = `embed text cohere stream`
  const input = {
    body: JSON.stringify({
      texts: prompt.split(' '),
      input_type: 'search_document'
    }),
    modelId: 'cohere.embed-english-v3'
  }
  const command = new bedrock.InvokeModelWithResponseStreamCommand(input)

  const { agent } = helper
  const api = helper.getAgentApi()
  helper.runInTransaction(async (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')

    const response = await client.send(command)
    for await (const event of response.body) {
      // no-op iteration over the stream in order to exercise the instrumentation
      event
    }

    const events = agent.customEventAggregator.events.toArray()
    t.equal(events.length, 1)
    const embedding = events.shift()[1]
    t.equal(embedding.error, false)
    t.equal(embedding.input, prompt)

    tx.end()
    t.end()
  })
})

tap.test(`ai21: should properly create errors on create completion (streamed)`, (t) => {
  const { bedrock, client, helper, expectedExternalPath } = t.context
  const modelId = 'ai21.j2-mid-v1'
  const prompt = `text ai21 ultimate question error streamed`
  const input = requests.ai21(prompt, modelId)

  const command = new bedrock.InvokeModelWithResponseStreamCommand(input)
  const expectedMsg = 'The model is unsupported for streaming'
  const expectedType = 'ValidationException'

  const { agent } = helper
  const api = helper.getAgentApi()
  helper.runInTransaction(async (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')
    try {
      await client.send(command)
    } catch (err) {
      t.equal(err.message, expectedMsg)
      t.equal(err.name, expectedType)
    }

    t.equal(tx.exceptions.length, 1)
    t.match(tx.exceptions[0], {
      error: {
        name: expectedType,
        message: expectedMsg
      },
      customAttributes: {
        'http.statusCode': 400,
        'error.message': expectedMsg,
        'error.code': expectedType,
        'completion_id': /[\w]{8}-[\w]{4}-[\w]{4}-[\w]{4}-[\w]{12}/
      },
      agentAttributes: {
        spanId: /[\w\d]+/
      }
    })

    t.segments(tx.trace.root, [
      {
        name: 'Llm/completion/Bedrock/InvokeModelWithResponseStreamCommand',
        children: [{ name: expectedExternalPath(modelId) }]
      }
    ])

    const events = agent.customEventAggregator.events.toArray()
    t.equal(events.length, 2)
    const chatSummary = events.filter(([{ type }]) => type === 'LlmChatCompletionSummary')[0]
    const chatMsgs = events.filter(([{ type }]) => type === 'LlmChatCompletionMessage')

    t.llmMessages({
      modelId,
      prompt,
      tx,
      chatMsgs
    })

    t.llmSummary({ tx, modelId, chatSummary, error: true })
    tx.end()
    t.end()
  })
})

tap.test(`models that do not support streaming should be handled`, (t) => {
  const { bedrock, client, helper, expectedExternalPath } = t.context
  const modelId = 'amazon.titan-embed-text-v1'
  const prompt = `embed text amazon error streamed`
  const input = requests.amazon(prompt, modelId)

  const command = new bedrock.InvokeModelWithResponseStreamCommand(input)
  const expectedMsg = 'The model is unsupported for streaming'
  const expectedType = 'ValidationException'

  const { agent } = helper
  const api = helper.getAgentApi()
  helper.runInTransaction(async (tx) => {
    api.addCustomAttribute('llm.conversation_id', 'convo-id')
    try {
      await client.send(command)
    } catch (err) {
      t.equal(err.message, expectedMsg)
      t.equal(err.name, expectedType)
    }

    t.equal(tx.exceptions.length, 1)
    t.match(tx.exceptions[0], {
      error: {
        name: expectedType,
        message: expectedMsg
      },
      customAttributes: {
        'http.statusCode': 400,
        'error.message': expectedMsg,
        'error.code': expectedType,
        'completion_id': undefined
      },
      agentAttributes: {
        spanId: /[\w\d]+/
      }
    })

    t.segments(tx.trace.root, [
      {
        name: 'Llm/embedding/Bedrock/InvokeModelWithResponseStreamCommand',
        children: [{ name: expectedExternalPath(modelId) }]
      }
    ])

    const events = agent.customEventAggregator.events.toArray()
    t.equal(events.length, 1)
    const embedding = events.shift()[1]
    t.equal(embedding.error, true)

    tx.end()
    t.end()
  })
})

tap.test(`models should properly create errors on stream interruption`, (t) => {
  const { bedrock, client, helper } = t.context
  const modelId = 'amazon.titan-text-express-v1'
  const prompt = `text amazon bad stream`
  const input = requests.amazon(prompt, modelId)

  const { agent } = helper
  const command = new bedrock.InvokeModelWithResponseStreamCommand(input)
  helper.runInTransaction(async (tx) => {
    try {
      await client.send(command)
    } catch (error) {
      t.match(error, {
        code: 'ECONNRESET',
        message: 'aborted',
        $response: {
          statusCode: 500
        }
      })
    }

    const events = agent.customEventAggregator.events.toArray()
    const summary = events.find((e) => e[0].type === 'LlmChatCompletionSummary')[1]
    t.equal(tx.exceptions.length, 1)
    t.equal(events.length, 2)
    t.equal(summary.error, true)

    tx.end()
    t.end()
  })
})
