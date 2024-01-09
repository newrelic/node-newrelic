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
    body: JSON.stringify({ prompt }),
    modelId
  }),
  amazon: (prompt, modelId) => ({
    body: JSON.stringify({ inputText: prompt }),
    modelId
  }),
  claude: (prompt, modelId) => ({
    body: JSON.stringify({ prompt }),
    modelId
  }),
  cohere: (prompt, modelId) => ({
    body: JSON.stringify({ prompt }),
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
  { modelId: 'cohere.command-text-v14', resKey: 'cohere' }
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
      helper.runInTransaction(async (tx) => {
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
})
