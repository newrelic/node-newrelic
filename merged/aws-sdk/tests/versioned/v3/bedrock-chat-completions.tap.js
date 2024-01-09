/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
utils(tap)
const common = require('../common')
const createAiResponseServer = require('../aws-server-stubs/ai-server')
const { FAKE_CREDENTIALS } = require('../aws-server-stubs')
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
    },
    feature_flag: {
      aws_bedrock_instrumentation: true
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
    endpoint: baseUrl
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

  tap.test(`${modelId}: text answer (streamed)`, async (t) => {
    const { bedrock, client, responses } = t.context
    const prompt = `text ${resKey} ultimate question streamed`
    const input = requests[resKey](prompt, modelId)
    const command = new bedrock.InvokeModelWithResponseStreamCommand(input)

    const expected = responses[resKey].get(prompt)
    try {
      await client.send(command)
    } catch (error) {
      t.equal(error.message, expected.body.message)
    }
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
})
